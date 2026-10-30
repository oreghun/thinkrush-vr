// The action twist: a visual puzzle asks for the right object AND a move.
// Choosing the right object with the wrong move fails with "Right answer,
// wrong move". The game picks the move, never the puzzle file, so the same
// puzzle can ask for a different move next time.
//
// No runtime imports, so both the ECS component schema and Node's test
// runner can use it.

export const Move = {
  Drop: 'drop',
  Flip: 'flip',
  Lift: 'lift',
} as const;

export type MoveName = (typeof Move)[keyof typeof Move];

const MOVES: MoveName[] = [Move.Drop, Move.Flip, Move.Lift];

/**
 * The visual puzzle (counted from 0 across visits) where each move first
 * appears. Two plain drops teach the table first; then one new move at a
 * time, each with a "New move!" call-out.
 */
const INTRODUCED_AT: Record<MoveName, number> = {
  drop: 0,
  flip: 2,
  lift: 4,
};

/**
 * The move for the visual puzzle after `seen` earlier ones, and whether it
 * is being introduced. `random` is a number in [0, 1) that picks among the
 * moves already introduced.
 */
export function pickMove(
  seen: number,
  random: number,
): { move: MoveName; isNew: boolean } {
  for (const move of MOVES) {
    if (move !== Move.Drop && seen === INTRODUCED_AT[move]) {
      return { move, isNew: true };
    }
  }
  const known = MOVES.filter((move) => INTRODUCED_AT[move] <= seen);
  const index = Math.min(Math.floor(random * known.length), known.length - 1);
  return { move: known[index], isNew: false };
}

/**
 * The move a released tile made: turned upside down counts as a flip
 * wherever it lands, otherwise letting go over the tray is a drop. Putting
 * it down anywhere else is no answer at all.
 */
export function releaseMove(
  upsideDown: boolean,
  overTray: boolean,
): MoveName | undefined {
  if (upsideDown) {
    return Move.Flip;
  }
  return overTray ? Move.Drop : undefined;
}

export type Verdict = 'solved' | 'wrongMove' | 'wrong';

/** The wrong object is a wrong answer whatever the move. */
export function judge(
  made: MoveName,
  wanted: MoveName,
  rightObject: boolean,
): Verdict {
  if (!rightObject) {
    return 'wrong';
  }
  return made === wanted ? 'solved' : 'wrongMove';
}
