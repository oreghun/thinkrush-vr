// How one puzzle plays out, and how long each part takes. The question
// types out word by word while RUSH reads it; then the choices appear one
// at a time while RUSH names each one (patterns and missing pieces have
// nothing to name, so their pieces appear together); the moment RUSH stops,
// the answer clock starts. Time up, a wrong pick or the right pick with the
// wrong move loses the puzzle. Runs are a set number of puzzles, and a
// solve scores more the faster it is.
//
// No runtime imports, so the ECS component schema and Node's test runner
// can both use it.

export const RoundPhase = {
  /** The question types out while RUSH reads it; the choices are hidden. */
  Reading: 'reading',
  /** The choices appear one at a time while RUSH names them. */
  Choices: 'choices',
  /** The answer clock runs. */
  Answering: 'answering',
} as const;

export type RoundPhaseName = (typeof RoundPhase)[keyof typeof RoundPhase];

/**
 * Seconds to answer once the choices are out. Orbs only need a point and a
 * pinch; a picture puzzle needs a reach, a pinch and its move; a pattern
 * needs studying the strip, and a missing piece turning to fit.
 */
const ANSWER_SECONDS: Record<string, number> = {
  riddle: 10,
  proverb: 10,
  mafumbo: 10,
  visual: 15,
  pattern: 20,
  object: 20,
};

export function answerSeconds(type: string): number {
  return ANSWER_SECONDS[type] ?? 10;
}

/** Whether RUSH names this type's choices (patterns and pieces have no names). */
export function namesChoices(type: string): boolean {
  return type !== 'pattern' && type !== 'object';
}

// Typing pace, characters per second, at each read-aloud pace: close to how
// fast the voice reads (about 160 words a minute at Normal), so the words
// appear about as they are said. With read-aloud off it types at Normal.
const TYPING = { slow: 12, normal: 15, fast: 19 } as const;

export function typingPace(speed: string): number {
  return TYPING[speed as keyof typeof TYPING] ?? TYPING.normal;
}

/**
 * The part of `text` shown once `chars` characters have been typed, whole
 * words only: a word appears when it is complete, so the line never shows
 * half a word.
 */
export function typedWords(text: string, chars: number): string {
  if (chars >= text.length) return text;
  if (chars <= 0) return '';
  // The word ending at or before `chars`: cut at the last space up to there
  // (counting a space right at the cut, which ends the word before it).
  const cut = text.lastIndexOf(' ', Math.floor(chars));
  return cut <= 0 ? '' : text.slice(0, cut);
}

// After the last word appears, a short beat before the choices; and the
// longest wait for a voice still reading (a voice that never reports the
// end must not hold the game).
const READ_BEAT = 0.4;
const VOICE_WAIT = 8;

/** Whether the question is done: all typed, a beat passed and RUSH quiet. */
export function readingDone(
  typedAll: boolean,
  sinceTyped: number,
  speaking: boolean,
): boolean {
  return (
    typedAll &&
    sinceTyped >= READ_BEAT &&
    (!speaking || sinceTyped >= VOICE_WAIT)
  );
}

// Each named choice stays the focus at least this long; without a voice,
// each gets this long on its own; and no name holds the game longer.
const CHOICE_MIN = 0.35;
const CHOICE_SILENT = 0.7;
const CHOICE_MAX = 4;
/** Pieces that are not named appear together, then the clock starts after this. */
export const UNNAMED_BEAT = 0.5;

/** Whether the current choice has been named and the next can appear. */
export function choiceDone(
  elapsed: number,
  voiced: boolean,
  speaking: boolean,
): boolean {
  if (!voiced) return elapsed >= CHOICE_SILENT;
  return elapsed >= CHOICE_MIN && (!speaking || elapsed >= CHOICE_MAX);
}

/** Puzzles in a run (the Daily Challenge plays its own set, one per world). */
export const RUN_PUZZLES = 10;

/** A solve's points: its difficulty times ten, plus a point per whole second left. */
export function solvePoints(difficulty: number, secondsLeft: number): number {
  return difficulty * 10 + Math.max(0, Math.floor(secondsLeft));
}

/** The answer clock the tour's clock step shows (an orb puzzle's). */
export const TOUR_CLOCK_SECONDS = 10;
