// RUSH, the companion: its mood and size, worked out from the puzzle board.
// No runtime imports, so Node's test runner can check them.

/** What RUSH's eyes show. */
export const Mood = {
  Idle: 'idle',
  Happy: 'happy',
  Worried: 'worried',
  Surprised: 'surprised',
  Sleepy: 'sleepy',
} as const;
export type MoodName = (typeof Mood)[keyof typeof Mood];

/** A short reaction to something that just happened, played over the mood. */
export const Reaction = {
  /** A new puzzle: a small hop, as if presenting it. */
  Present: 'present',
  /** A solve: a bigger hop with happy eyes. */
  Cheer: 'cheer',
  /** A wrong answer: a shake with worried eyes. */
  Worried: 'worried',
  /** The right object with the wrong move: a shake with surprised eyes. */
  Surprised: 'surprised',
} as const;
export type ReactionName = (typeof Reaction)[keyof typeof Reaction];

/** The board values RUSH watches (status and mode as their enum strings). */
export interface BoardView {
  puzzleIndex: number;
  status: string;
  mode: string;
  wrongAnswers: number;
  wrongMoves: number;
  /** Paused (palm up, menu button, headset off): RUSH dozes. */
  paused?: boolean;
}

/** The mood that lasts while the board stays as it is. */
export function baseMood(view: BoardView): MoodName {
  if (view.paused) {
    return Mood.Sleepy;
  }
  if (view.mode === 'runOver' || view.status === 'solved') {
    return Mood.Happy;
  }
  if (view.status === 'timeUp') {
    return Mood.Sleepy;
  }
  if (view.status === 'wrongMove') {
    return Mood.Surprised;
  }
  if (view.status === 'wrongPick') {
    return Mood.Worried;
  }
  return Mood.Idle;
}

/** The reaction to the change from `before` to `after`, if any. */
export function reactionTo(
  before: BoardView,
  after: BoardView,
): ReactionName | undefined {
  if (after.status === 'solved' && before.status !== 'solved') {
    return Reaction.Cheer;
  }
  if (after.wrongMoves > before.wrongMoves) {
    return Reaction.Surprised;
  }
  if (after.wrongAnswers > before.wrongAnswers) {
    return Reaction.Worried;
  }
  if (
    after.puzzleIndex !== before.puzzleIndex ||
    (after.mode === 'run' && before.mode !== 'run') ||
    (after.mode === 'tour' && before.mode !== 'tour')
  ) {
    return Reaction.Present;
  }
  return undefined;
}

/** The eyes a reaction shows; Present keeps the current mood's eyes. */
export function reactionMood(reaction: ReactionName, mood: MoodName): MoodName {
  switch (reaction) {
    case Reaction.Cheer:
      return Mood.Happy;
    case Reaction.Worried:
      return Mood.Worried;
    case Reaction.Surprised:
      return Mood.Surprised;
    default:
      return mood;
  }
}

/** Share of the clock left, 0 to 1. */
export function timeFraction(secondsLeft: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, secondsLeft / total)) : 1;
}

// RUSH shrinks to this share of its size as the clock runs out, so it can
// still be seen (and its eyes read) at the very end.
const SMALLEST = 0.45;

/** RUSH is the timer: full size with a full clock, smallest at zero. */
export function rushScale(fraction: number): number {
  return SMALLEST + (1 - SMALLEST) * fraction;
}

// Below this share of the clock the glow warms from gold towards red.
const WARNING = 0.35;
const GOLD = [1, 0.69, 0.13] as const;
const RED = [0.95, 0.25, 0.15] as const;

/** RUSH's glow colour (r, g, b from 0 to 1) for the share of time left. */
export function glowColor(fraction: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (WARNING - fraction) / WARNING));
  return [
    GOLD[0] + (RED[0] - GOLD[0]) * t,
    GOLD[1] + (RED[1] - GOLD[1]) * t,
    GOLD[2] + (RED[2] - GOLD[2]) * t,
  ];
}
