// Checks content/puzzles.json and the src/i18n message files. Runs before
// every build; exits non-zero on any error so a bad file never deploys.
// Run: node scripts/validate-content.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LANGS = ['en', 'sw'];
const TYPES = ['visual', 'riddle', 'proverb', 'mafumbo'];
const DIFFICULTIES = [1, 2, 3];
const FIELDS = new Set([
  'id',
  'placeholder',
  'lang',
  'type',
  'prompt',
  'answer',
  'options',
  'hint',
  'subtitle_en',
  'difficulty',
]);

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

function checkPuzzles() {
  const puzzles = readJson('content/puzzles.json');
  if (puzzles === undefined) {
    return;
  }
  if (!Array.isArray(puzzles)) {
    errors.push('content/puzzles.json: must be an array of puzzles');
    return;
  }
  const ids = new Set();
  let placeholders = 0;
  puzzles.forEach((puzzle, index) => {
    const where = `content/puzzles.json[${index}]${isText(puzzle?.id) ? ` (${puzzle.id})` : ''}`;
    const fail = (message) => errors.push(`${where}: ${message}`);
    if (
      puzzle === null ||
      typeof puzzle !== 'object' ||
      Array.isArray(puzzle)
    ) {
      fail('must be an object');
      return;
    }
    for (const field of Object.keys(puzzle)) {
      if (!FIELDS.has(field)) {
        fail(`unknown field "${field}"`);
      }
    }
    if (!isText(puzzle.id)) {
      fail('"id" must be a non-empty string');
    } else if (ids.has(puzzle.id)) {
      fail('"id" is used by another puzzle');
    } else {
      ids.add(puzzle.id);
    }
    if (!LANGS.includes(puzzle.lang)) {
      fail(`"lang" must be one of ${LANGS.join(', ')}`);
    }
    if (!TYPES.includes(puzzle.type)) {
      fail(`"type" must be one of ${TYPES.join(', ')}`);
    }
    for (const field of ['prompt', 'answer', 'hint']) {
      if (!isText(puzzle[field])) {
        fail(`"${field}" must be a non-empty string`);
      }
    }
    if (
      !Array.isArray(puzzle.options) ||
      puzzle.options.length !== 3 ||
      !puzzle.options.every(isText)
    ) {
      fail('"options" must be 3 non-empty strings, one per answer orb');
    } else {
      if (new Set(puzzle.options).size !== 3) {
        fail('"options" must all be different');
      }
      if (!puzzle.options.includes(puzzle.answer)) {
        fail('"answer" must be one of "options"');
      }
    }
    if (puzzle.lang === 'sw' && !isText(puzzle.subtitle_en)) {
      fail('"subtitle_en" is required for Swahili puzzles');
    }
    if (puzzle.lang === 'en' && puzzle.subtitle_en != null) {
      fail('"subtitle_en" is only for Swahili puzzles; use null');
    }
    if (!DIFFICULTIES.includes(puzzle.difficulty)) {
      fail(`"difficulty" must be one of ${DIFFICULTIES.join(', ')}`);
    }
    if (
      puzzle.placeholder !== undefined &&
      typeof puzzle.placeholder !== 'boolean'
    ) {
      fail('"placeholder" must be true or false');
    }
    if (puzzle.placeholder === true) {
      placeholders += 1;
    }
  });
  const counts = LANGS.map(
    (lang) =>
      `${puzzles.filter((puzzle) => puzzle?.lang === lang).length} ${lang}`,
  );
  notes.push(
    `puzzles: ${counts.join(', ')}, ${placeholders} marked placeholder`,
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
