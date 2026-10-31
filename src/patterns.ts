// Pattern puzzles: "Complete the pattern." A strip of six pieces of cloth
// follows a rule and one piece is missing. Four candidate pieces stand on
// the table; the player drops the right one in the gap.
//
// The puzzle file names a family (the look) and a rule (the logic); the
// board is generated here, so the same puzzle can deal a fresh board each
// time. Solving never needs cultural knowledge: only the rule.
//
// Plain data and arithmetic, no runtime imports: src/pattern-art.ts draws
// the pieces, and Node's test runner checks that every board this makes
// has exactly one right answer among the four pieces.

export const PATTERN_FAMILIES = [
  'kitenge',
  'beadwork',
  'tessellation',
  'weave',
  'abstract',
] as const;
export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

export const PATTERN_RULES = [
  'repeat-2',
  'repeat-3',
  'mirror',
  'turn',
  'grow',
  'two-cycles',
] as const;
export type PatternRule = (typeof PATTERN_RULES)[number];

/** One piece of cloth: motif, colourway, quarter turns and copies. */
export interface Piece {
  motif: number;
  colors: number;
  turn: number;
  count: number;
}

export const MOTIFS_PER_FAMILY = 4;
export const COLORWAYS_PER_FAMILY = 4;
export const STRIP_LENGTH = 6;
export const OPTION_COUNT = 4;
export const MAX_COUNT = 7;

/**
 * How many different looks each motif has as it turns by quarter turns:
 * 4 when every turn looks different, 2 when a half turn looks the same,
 * 1 when turning changes nothing. Must match src/pattern-art.ts.
 */
export const MOTIF_TURNS: Record<PatternFamily, readonly number[]> = {
  // sun, leaf, half-moon, rings
  kitenge: [1, 4, 4, 1],
  // bead stripes, bead triangle, bead diamond, bead corner
  beadwork: [2, 4, 1, 4],
  // split square, chevron, diamond, hourglass
  tessellation: [4, 4, 1, 2],
  // plain weave, twill, basket weave, banded stripes
  weave: [2, 2, 2, 2],
  // dots, arrow, half block, cross
  abstract: [1, 4, 4, 1],
};

/** Two pieces with the same key look exactly alike. */
export function lookKey(family: PatternFamily, piece: Piece): string {
  const turns = MOTIF_TURNS[family][piece.motif];
  return `${piece.motif}:${piece.colors}:${piece.turn % turns}:${piece.count}`;
}

/** Whether `rule` can make a fair board in `family`. */
export function ruleFits(family: PatternFamily, rule: PatternRule): boolean {
  // Turning needs a motif that looks different at every quarter turn.
  return rule !== 'turn' || MOTIF_TURNS[family].includes(4);
}

export interface PatternBoard {
  family: PatternFamily;
  rule: PatternRule;
  /** STRIP_LENGTH pieces; strip[gap] is the missing one (the answer). */
  strip: Piece[];
  gap: number;
  /** The four candidate pieces, shuffled; options[answerIndex] is right. */
  options: Piece[];
  answerIndex: number;
}

/** A small seeded random generator (mulberry32): numbers in [0, 1). */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from text (FNV-1a), e.g. a puzzle id plus a date. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const piece = (motif: number, colors: number, turn = 0, count = 1): Piece => ({
  motif,
  colors,
  turn,
  count,
});

/** `n` different numbers from 0 to `range - 1`, in random order. */
function distinct(n: number, range: number, random: () => number): number[] {
  const pool = Array.from({ length: range }, (_, i) => i);
  shuffle(pool, random);
  return pool.slice(0, n);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** A whole number from `low` to `high`, both included. */
function between(low: number, high: number, random: () => number): number {
  return low + Math.floor(random() * (high - low + 1));
}

/**
 * Deals a board for `rule` in `family`. The three wrong pieces are near
 * misses: pieces that appear elsewhere in the strip, or the answer with one
 * thing changed, so the rule (not a stray detail) picks the right one.
 */
export function generatePattern(
  family: PatternFamily,
  rule: PatternRule,
  random: () => number,
): PatternBoard {
  if (!ruleFits(family, rule)) {
    throw new Error(`rule "${rule}" does not fit family "${family}"`);
  }
  const motifs = distinct(MOTIFS_PER_FAMILY, MOTIFS_PER_FAMILY, random);
  const colors = distinct(COLORWAYS_PER_FAMILY, COLORWAYS_PER_FAMILY, random);
  let strip: Piece[];
  let gap: number;
  // Wrong pieces to try, best first; the first three that look different
  // from the answer and from each other are used.
  let misses: Piece[];

  switch (rule) {
    case 'repeat-2':
    case 'repeat-3': {
      const period = rule === 'repeat-2' ? 2 : 3;
      const units = Array.from({ length: period }, (_, i) =>
        piece(motifs[i], colors[i]),
      );
      strip = Array.from({ length: STRIP_LENGTH }, (_, i) => units[i % period]);
      gap = between(period, STRIP_LENGTH - 1, random);
      const answer = strip[gap];
      misses = [
        ...units.filter((unit) => unit !== answer),
        piece(answer.motif, colors[3]),
        piece(motifs[3], answer.colors),
        piece(motifs[3], colors[3]),
      ];
      break;
    }
    case 'mirror': {
      const units = [0, 1, 2].map((i) => piece(motifs[i], colors[i]));
      strip = [units[0], units[1], units[2], units[2], units[1], units[0]];
      // The gap is on the second half, so its partner is always in view.
      gap = between(3, 5, random);
      const answer = strip[gap];
      misses = [
        ...units.filter((unit) => unit !== answer),
        piece(answer.motif, colors[3]),
        piece(motifs[3], answer.colors),
      ];
      break;
    }
    case 'turn': {
      const turning = motifs.find((m) => MOTIF_TURNS[family][m] === 4)!;
      const start = between(0, 3, random);
      strip = Array.from({ length: STRIP_LENGTH }, (_, i) =>
        piece(turning, colors[0], (start + i) % 4),
      );
      gap = between(1, STRIP_LENGTH - 1, random);
      // The other three quarter turns: only the direction tells them apart.
      misses = [1, 2, 3].map((step) =>
        piece(turning, colors[0], (strip[gap].turn + step) % 4),
      );
      break;
    }
    case 'grow': {
      // Counts run 2 to 7: every piece shows simple tokens to count.
      strip = Array.from({ length: STRIP_LENGTH }, (_, i) =>
        piece(motifs[0], colors[0], 0, i + 2),
      );
      gap = between(1, STRIP_LENGTH - 2, random);
      const count = strip[gap].count;
      misses = [count - 1, count + 1, count + 2, count - 2]
        .filter((n) => n >= 2 && n <= MAX_COUNT)
        .map((n) => piece(motifs[0], colors[0], 0, n));
      break;
    }
    case 'two-cycles': {
      // Shapes swap every piece, colours repeat every three: across six
      // pieces each shape-and-colour pair appears once, so the gap's pair
      // is the one missing from the strip.
      strip = Array.from({ length: STRIP_LENGTH }, (_, i) =>
        piece(motifs[i % 2], colors[i % 3]),
      );
      gap = between(2, STRIP_LENGTH - 1, random);
      const answer = strip[gap];
      const otherMotif = answer.motif === motifs[0] ? motifs[1] : motifs[0];
      const otherColors = [0, 1, 2]
        .map((i) => colors[i])
        .filter((c) => c !== answer.colors);
      misses = [
        piece(otherMotif, answer.colors),
        piece(answer.motif, otherColors[0]),
        piece(otherMotif, otherColors[1]),
        piece(answer.motif, otherColors[1]),
      ];
      break;
    }
  }

  const answer = strip[gap];
  const seen = new Set([lookKey(family, answer)]);
  const wrong: Piece[] = [];
  for (const miss of misses) {
    const key = lookKey(family, miss);
    if (!seen.has(key) && wrong.length < OPTION_COUNT - 1) {
      seen.add(key);
      wrong.push(miss);
    }
  }
  if (wrong.length < OPTION_COUNT - 1) {
    throw new Error(`could not deal three wrong pieces for "${rule}"`);
  }
  const options = shuffle([answer, ...wrong], random);
  return {
    family,
    rule,
    strip,
    gap,
    options,
    answerIndex: options.indexOf(answer),
  };
}
