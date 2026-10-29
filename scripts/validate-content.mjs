// Checks content/puzzles.json and the src/i18n message files. Runs before
// every build; exits non-zero on any error so a bad file never deploys.
// Run: node scripts/validate-content.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LANGS = ['en', 'sw'];
const TYPES = ['visual', 'riddle', 'proverb', 'mafumbo'];
const ANSWER_MODES = ['grab', 'voice+orbs', 'orbs'];
const STATUSES = ['draft', 'tested'];
const DIFFICULTIES = [1, 2, 3, 4, 5];
const FILE_FIELDS = new Set(['version', 'notes', 'puzzles']);
const REQUIRED_FIELDS = [
  'id',
  'lang',
  'type',
  'prompt',
  'answer',
  'accepted',
  'options',
  'answer_mode',
  'hint',
  'explanation',
  'subtitle_en',
  'difficulty',
  'status',
];
// question is for mafumbo only, tiles for visual puzzles only.
const FIELDS = new Set([...REQUIRED_FIELDS, 'question', 'tiles']);

const errors = [];
const notes = [];

function readJson(relativePath) {
  const file = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return undefined;
  }
}

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isTextList = (value, length) =>
  Array.isArray(value) &&
  (length === undefined || value.length === length) &&
  value.every(isText);

// The game font only has printable ASCII, so curly quotes, long dashes and
// the like would show as gaps. Swahili needs no other letters.
function checkPlainText(value, label, fail) {
  for (const text of Array.isArray(value) ? value : [value]) {
    if (typeof text !== 'string') {
      continue;
    }
    const unsupported = [...new Set(text.replace(/[\x20-\x7e]/g, ''))];
    if (unsupported.length > 0) {
      fail(
        `${label} has characters the game font cannot show: ${unsupported.join(' ')} (use plain ' " -)`,
      );
    }
  }
}

function checkPuzzle(puzzle, fail) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in puzzle)) {
      fail(`missing "${field}"`);
    }
  }
  for (const [field, value] of Object.entries(puzzle)) {
    if (!FIELDS.has(field)) {
      fail(`unknown field "${field}"`);
    }
    checkPlainText(value, `"${field}"`, fail);
  }
  if (!LANGS.includes(puzzle.lang)) {
    fail(`"lang" must be one of ${LANGS.join(', ')}`);
  }
  if (!TYPES.includes(puzzle.type)) {
    fail(`"type" must be one of ${TYPES.join(', ')}`);
  }
  if (!ANSWER_MODES.includes(puzzle.answer_mode)) {
    fail(`"answer_mode" must be one of ${ANSWER_MODES.join(', ')}`);
  }
  if (!STATUSES.includes(puzzle.status)) {
    fail(`"status" must be one of ${STATUSES.join(', ')}`);
  }
  if (!DIFFICULTIES.includes(puzzle.difficulty)) {
    fail(`"difficulty" must be one of ${DIFFICULTIES.join(', ')}`);
  }
  for (const field of ['prompt', 'answer', 'hint', 'explanation']) {
    if (!isText(puzzle[field])) {
      fail(`"${field}" must be a non-empty string`);
    }
  }
  if (!isTextList(puzzle.accepted)) {
    fail('"accepted" must be a list of non-empty strings (or [])');
  }

  if (puzzle.type === 'mafumbo') {
    if (!isText(puzzle.question)) {
      fail('"question" is required for mafumbo');
    }
  } else if ('question' in puzzle) {
    fail('"question" is only for mafumbo');
  }

  if (puzzle.type === 'visual') {
    if (!isTextList(puzzle.tiles, 4) || new Set(puzzle.tiles).size !== 4) {
      fail('"tiles" must be 4 different non-empty strings');
    } else if (!puzzle.tiles.includes(puzzle.answer)) {
      fail('"answer" must be one of "tiles"');
    }
    if (!Array.isArray(puzzle.options) || puzzle.options.length !== 0) {
      fail('"options" must be [] for visual puzzles');
    }
    if (puzzle.answer_mode !== 'grab') {
      fail('"answer_mode" must be "grab" for visual puzzles');
    }
  } else {
    if ('tiles' in puzzle) {
      fail('"tiles" is only for visual puzzles');
    }
    if (!isTextList(puzzle.options, 3) || new Set(puzzle.options).size !== 3) {
      fail('"options" must be 3 different non-empty strings, one per orb');
    } else if (puzzle.options[0] !== puzzle.answer) {
      fail('"options" must list the answer first');
    }
    if (puzzle.answer_mode === 'grab') {
      fail('"answer_mode" "grab" is only for visual puzzles');
    }
  }

  if (puzzle.lang === 'sw' && !isText(puzzle.subtitle_en)) {
    fail('"subtitle_en" is required for Swahili puzzles');
  }
  if (puzzle.lang === 'en' && puzzle.subtitle_en !== null) {
    fail('"subtitle_en" is only for Swahili puzzles; use null');
  }
}

function checkPuzzles() {
  const file = readJson('content/puzzles.json');
  if (file === undefined) {
    return;
  }
  if (!isObject(file) || !Array.isArray(file.puzzles)) {
    errors.push(
      'content/puzzles.json: must be an object with a "puzzles" list',
    );
    return;
  }
  for (const field of Object.keys(file)) {
    if (!FILE_FIELDS.has(field)) {
      errors.push(`content/puzzles.json: unknown field "${field}"`);
    }
  }
  const ids = new Set();
  file.puzzles.forEach((puzzle, index) => {
    const where = `content/puzzles.json puzzles[${index}]${isText(puzzle?.id) ? ` (${puzzle.id})` : ''}`;
    const fail = (message) => errors.push(`${where}: ${message}`);
    if (!isObject(puzzle)) {
      fail('must be an object');
      return;
    }
    if (!isText(puzzle.id)) {
      fail('"id" must be a non-empty string');
    } else if (ids.has(puzzle.id)) {
      fail('"id" is used by another puzzle');
    } else {
      ids.add(puzzle.id);
    }
    checkPuzzle(puzzle, fail);
  });
  const count = (field, value) =>
    `${file.puzzles.filter((puzzle) => puzzle?.[field] === value).length} ${value}`;
  notes.push(
    `puzzles: ${LANGS.map((lang) => count('lang', lang)).join(', ')}; ${STATUSES.map((status) => count('status', status)).join(', ')}`,
  );
}

function checkMessages() {
  const en = readJson('src/i18n/en.json');
  const sw = readJson('src/i18n/sw.json');
  if (en === undefined || sw === undefined) {
    return;
  }
  for (const key of Object.keys(en)) {
    if (!isText(en[key])) {
      errors.push(`src/i18n/en.json: "${key}" must be a non-empty string`);
    }
    checkPlainText(en[key], `"${key}"`, (message) =>
      errors.push(`src/i18n/en.json: ${message}`),
    );
    if (!(key in sw)) {
      errors.push(
        `src/i18n/sw.json: missing "${key}" (use "" until it is written)`,
      );
    }
  }
  const unwritten = [];
  for (const key of Object.keys(sw)) {
    if (!(key in en)) {
      errors.push(`src/i18n/sw.json: "${key}" is not in en.json`);
    } else if (typeof sw[key] !== 'string') {
      errors.push(`src/i18n/sw.json: "${key}" must be a string`);
    } else if (sw[key].trim() === '') {
      unwritten.push(key);
    }
    checkPlainText(sw[key], `"${key}"`, (message) =>
      errors.push(`src/i18n/sw.json: ${message}`),
    );
  }
  notes.push(
    `messages: ${Object.keys(en).length} keys, ${unwritten.length} not yet written in Swahili (shown in English)`,
  );
}

checkPuzzles();
checkMessages();

if (errors.length > 0) {
  console.error(`Content check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Content check passed. ${notes.join('; ')}.`);
