// Object puzzles: "Complete the object." A small figure built from blocks
// (a giraffe, a hut, a dhow...) stands on the table with a chunk of 4 or 5
// blocks missing. Four candidate chunks stand on the tiles, each shown
// turned a little; the player picks the one that fits, turns it the right
// way and lets it go at the gap, where it snaps in.
//
// The wrong chunks are near misses: the right chunk's mirror image (no
// amount of turning makes it fit, and flipping it shows its plain back), a
// chunk from somewhere else on the figure, and the right chunk with one
// block moved. Solving needs only shapes and colours, never cultural
// knowledge.
//
// Plain data and arithmetic, no runtime imports: src/object-art.ts builds
// the blocks, and Node's test runner checks that every board this deals has
// exactly one piece that fits.

/** A block: column x (right) and row y (up) on the figure, and its colour. */
export interface Cell {
  x: number;
  y: number;
  color: string;
}

/** Block colours by letter, as drawn in FIGURES. */
export const PALETTE: Record<string, string> = {
  A: '#8A8F98', // elephant grey
  B: '#9A5B2C', // spots, mid brown
  D: '#4A2C17', // dark wood and hooves
  G: '#3F8A44', // leaves
  K: '#1F1B18', // eyes, door
  N: '#D9B26A', // thatch, sand
  O: '#E8873A', // orange bands
  R: '#C8553D', // terracotta
  T: '#35B7AE', // turquoise
  W: '#F2E6CF', // cream, sails
  Y: '#E8B04A', // giraffe yellow
  a: '#C9B8B0', // elephant ear
  g: '#8CC063', // young leaves
  n: '#8A6A34', // dark thatch, bark
};

/**
 * The figures, drawn row by row from the top; "." is empty. Original
 * drawings, simple enough to read from a seat at arm's length.
 */
export const FIGURES = {
  giraffe: [
    '......D.D.',
    '......YYYY',
    '......YKYY',
    '.....YY...',
    '.....BY...',
    '.....YB...',
    'YBYBYBY...',
    'BYYBYYB...',
    'Y.Y.Y.Y...',
    'D.D.D.D...',
  ],
  elephant: [
    '...AAAAA..',
    '..AAAAAAAA',
    '.AKaaAAAAA',
    '.AaaaAAAAA',
    '.AWaaAAAAA',
    '.A..AAAAAA',
    'AA..AA..AA',
    '....AA..AA',
  ],
  baobab: [
    'gG..Gg..gG',
    'GGg.GGg.GG',
    '.D...D..D.',
    '.DD..D.DD.',
    '..DDDDDD..',
    '...DnDD...',
    '...DDnD...',
    '...DnDD...',
    '..DDDDnD..',
    '.NNNNNNNN.',
  ],
  hut: [
    '....nn....',
    '...nNNn...',
    '..nNNNNn..',
    '.nNNnNNNn.',
    'nNNNNNNNNn',
    '.RRRRRRRR.',
    '.RWRRKKRR.',
    '.RRRRKKRR.',
    '.RRRRKKRR.',
  ],
  dhow: [
    '.....D....',
    '.....DW...',
    '....WDWW..',
    '...WWDWWW.',
    '..WWWDWWWW',
    '.WWWWDWWW.',
    '.....D....',
    'DDDDDDDDDD',
    '.DRRRRRRD.',
    '..DDDDDD..',
  ],
  drum: [
    '..WWWWWW..',
    '.DDDDDDDD.',
    '.RORORORR.',
    '..RRRRRR..',
    '...ROOR...',
    '....RR....',
    '....RR....',
    '...RRRR...',
    '..DDDDDD..',
  ],
  kettle: [
    '.....K....',
    '....TTT...',
    'T..TTTTT..',
    'TT.TTWTTTT',
    '.TTOOOOT.T',
    '..TTTTTTTT',
    '...TTTTT..',
  ],
} as const;

export type FigureName = keyof typeof FIGURES;
export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

/** Candidates on the table, as for the other tile puzzles. */
export const OPTION_COUNT = 4;

/** A candidate chunk on a tile. */
export interface ShownPiece {
  /** Its blocks the way that fits the gap (normalised, see `normalize`). */
  cells: Cell[];
  /** Quarter turns, counter-clockwise as the player sees it, it is shown at. */
  turn: number;
}

export interface ObjectBoard {
  figure: FigureName;
  /** Every block of the whole figure, gap included. */
  cells: Cell[];
  /** The missing blocks, where they belong on the figure. */
  gap: Cell[];
  /** The four candidates, shuffled; options[answerIndex] fits. */
  options: ShownPiece[];
  answerIndex: number;
}

/** How the puzzle file's difficulty (1-5) shapes the board. */
export function settingsFor(difficulty: number): {
  size: number;
  turned: boolean;
  colorful: boolean;
} {
  return {
    // Bigger chunks are harder to turn in your head.
    size: difficulty <= 2 ? 4 : 5,
    // The first ones fit as shown, to teach the snap; then they need a turn.
    turned: difficulty >= 2,
    // Easier boards cut chunks with at least two colours, which read faster.
    colorful: difficulty <= 3,
  };
}

/** The blocks of a figure, with y counted up from its bottom row. */
export function figureCells(name: FigureName): Cell[] {
  const rows = FIGURES[name];
  const cells: Cell[] = [];
  rows.forEach((row, r) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '.') {
        cells.push({ x, y: rows.length - 1 - r, color: row[x] });
      }
    }
  });
  return cells;
}

/** Moved so its lowest x and y are 0, and sorted, so equal shapes match. */
export function normalize(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY, color: cell.color }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** A text key: two pieces with the same key look exactly alike. */
export function shapeKey(cells: readonly Cell[]): string {
  return normalize(cells)
    .map((cell) => `${cell.x},${cell.y}${cell.color}`)
    .join(' ');
}

/** Turned `quarters` quarter turns counter-clockwise (negative: clockwise). */
export function turnCells(cells: readonly Cell[], quarters: number): Cell[] {
  const turns = ((quarters % 4) + 4) % 4;
  let turned = cells.map((cell) => ({ ...cell }));
  for (let i = 0; i < turns; i += 1) {
    turned = turned.map((cell) => ({ x: -cell.y, y: cell.x, color: cell.color }));
  }
  return normalize(turned);
}

/** Its mirror image, as if seen from behind. */
export function mirrorCells(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map((cell) => ({ ...cell, x: -cell.x })));
}

/** The quarter turns (0-3) that make `piece` look exactly like `target`. */
export function fitTurns(piece: readonly Cell[], target: readonly Cell[]): number[] {
  const goal = shapeKey(target);
  return [0, 1, 2, 3].filter((k) => shapeKey(turnCells(piece, k)) === goal);
}

/** Whether some amount of turning makes `a` look exactly like `b`. */
export function sameUpToTurn(a: readonly Cell[], b: readonly Cell[]): boolean {
  return fitTurns(a, b).length > 0;
}

/** Whether every block touches the others edge to edge. */
export function isConnected(cells: readonly Cell[]): boolean {
  if (cells.length === 0) {
    return false;
  }
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const seen = new Set<string>([`${cells[0].x},${cells[0].y}`]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of STEPS) {
      const key = `${x + dx},${y + dy}`;
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        stack.push({ x: x + dx, y: y + dy, color: '' });
      }
    }
  }
  return seen.size === keys.size;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A connected chunk of `size` blocks of the figure, grown from a random block. */
function randomChunk(
  cells: readonly Cell[],
  size: number,
  random: () => number,
): Cell[] | undefined {
  const byKey = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const chunk = [cells[Math.floor(random() * cells.length)]];
  const taken = new Set([`${chunk[0].x},${chunk[0].y}`]);
  while (chunk.length < size) {
    const frontier: Cell[] = [];
    for (const { x, y } of chunk) {
      for (const [dx, dy] of STEPS) {
        const key = `${x + dx},${y + dy}`;
        const next = byKey.get(key);
        if (next && !taken.has(key) && !frontier.includes(next)) {
          frontier.push(next);
        }
      }
    }
    if (frontier.length === 0) {
      return undefined;
    }
    const next = frontier[Math.floor(random() * frontier.length)];
    chunk.push(next);
    taken.add(`${next.x},${next.y}`);
  }
  return chunk;
}

/** `piece` with one block moved to another free spot beside the rest. */
function nudge(piece: readonly Cell[], random: () => number): Cell[] | undefined {
  const from = Math.floor(random() * piece.length);
  const rest = piece.filter((_, i) => i !== from);
  if (!isConnected(rest)) {
    return undefined;
  }
  const used = new Set(piece.map((cell) => `${cell.x},${cell.y}`));
  const spots: Cell[] = [];
  for (const { x, y } of rest) {
    for (const [dx, dy] of STEPS) {
      if (!used.has(`${x + dx},${y + dy}`)) {
        spots.push({ x: x + dx, y: y + dy, color: piece[from].color });
      }
    }
  }
  if (spots.length === 0) {
    return undefined;
  }
  return normalize([...rest, spots[Math.floor(random() * spots.length)]]);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** A shown turn: -1, 0 or 1 quarter turns. */
function smallTurn(random: () => number): number {
  return Math.floor(random() * 3) - 1;
}

/**
 * Deals a board: a chunk of `size` blocks cut from `figure`, and four
 * candidates, of which only the chunk itself can be turned to fit. With
 * `turned`, the right chunk is shown a quarter turn off, so it has to be
 * turned; the others are shown up to a quarter turn either way.
 */
export function dealObject(
  figure: FigureName,
  difficulty: number,
  random: () => number,
): ObjectBoard {
  const { size, turned, colorful } = settingsFor(difficulty);
  const cells = figureCells(figure);
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const gap = randomChunk(cells, size, random);
    if (!gap) {
      continue;
    }
    if (colorful && attempt < 1000 && new Set(gap.map((c) => c.color)).size < 2) {
      continue;
    }
    const answer = normalize(gap);
    const mirrored = mirrorCells(answer);
    // A chunk that looks the same in a mirror would have two right answers.
    if (sameUpToTurn(mirrored, answer)) {
      continue;
    }
    const chosen = [answer, mirrored];
    const differs = (piece: Cell[]) =>
      chosen.every((other) => !sameUpToTurn(piece, other));

    let elsewhere: Cell[] | undefined;
    for (let i = 0; i < 60 && !elsewhere; i += 1) {
      const other = randomChunk(cells, size, random);
      if (other && differs(normalize(other))) {
        elsewhere = normalize(other);
      }
    }
    if (!elsewhere) {
      continue;
    }
    chosen.push(elsewhere);

    let nudged: Cell[] | undefined;
    for (let i = 0; i < 60 && !nudged; i += 1) {
      const other = nudge(answer, random);
      if (other && differs(other)) {
        nudged = other;
      }
    }
    if (!nudged) {
      continue;
    }

    const right: ShownPiece = {
      cells: answer,
      turn: turned ? (random() < 0.5 ? -1 : 1) : 0,
    };
    const options = shuffle(
      [
        right,
        { cells: mirrored, turn: smallTurn(random) },
        { cells: elsewhere, turn: smallTurn(random) },
        { cells: nudged, turn: smallTurn(random) },
      ],
      random,
    );
    return {
      figure,
      cells,
      gap,
      options,
      answerIndex: options.indexOf(right),
    };
  }
  throw new Error(`could not deal a fair board for "${figure}"`);
}

/** How far off a quarter turn a piece may be held and still fit. */
export const TURN_TOLERANCE = (35 * Math.PI) / 180;
/** The piece's face must point at least this much the same way as the figure's. */
export const FACING_MIN = 0.2;

/**
 * What letting a piece go at the gap does. `roll` is how far the player has
 * turned the tile, counter-clockwise as seen from the front, in radians;
 * `facing` is how much its face points the same way as the figure's (1:
 * the same, below 0: its plain back shows). A wrong piece is a wrong
 * answer; the right piece fits only facing out and turned the right way,
 * otherwise it just needs turning.
 */
export function judgeFit(
  board: ObjectBoard,
  optionIndex: number,
  roll: number,
  facing: number,
): 'fits' | 'turn' | 'wrong' {
  if (optionIndex !== board.answerIndex) {
    return 'wrong';
  }
  if (facing < FACING_MIN) {
    return 'turn';
  }
  const quarters = Math.round(roll / (Math.PI / 2));
  if (Math.abs(roll - quarters * (Math.PI / 2)) > TURN_TOLERANCE) {
    return 'turn';
  }
  const piece = board.options[optionIndex];
  const net = (((piece.turn + quarters) % 4) + 4) % 4;
  return fitTurns(piece.cells, piece.cells).includes(net) ? 'fits' : 'turn';
}
