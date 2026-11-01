// RUSH's cheeky lines: a short quip after each answer, said in her voice
// when read-aloud is on. The words live in src/i18n (rush.* keys); this
// module only picks which one, never the same twice in a row.
//
// No runtime imports, so Node's test runner can check it.

export type LineEvent = 'solved' | 'fast' | 'wrongPick' | 'wrongMove' | 'timeUp';

export const RUSH_LINES: Record<LineEvent, readonly string[]> = {
  solved: [
    'rush.solved.1',
    'rush.solved.2',
    'rush.solved.3',
    'rush.solved.4',
    'rush.solved.5',
  ],
  fast: ['rush.fast.1', 'rush.fast.2', 'rush.fast.3'],
  wrongPick: [
    'rush.wrongPick.1',
    'rush.wrongPick.2',
    'rush.wrongPick.3',
    'rush.wrongPick.4',
  ],
  wrongMove: ['rush.wrongMove.1', 'rush.wrongMove.2', 'rush.wrongMove.3'],
  timeUp: ['rush.timeUp.1', 'rush.timeUp.2', 'rush.timeUp.3', 'rush.timeUp.4'],
};

/** A solve with at least this share of the clock left earns a "fast" line. */
export const FAST_SHARE = 0.6;

/** Which kind of line a solve gets, from the share of the clock left. */
export function solvedEvent(shareLeft: number): LineEvent {
  return shareLeft >= FAST_SHARE ? 'fast' : 'solved';
}

/**
 * A line for `event`, chosen with `random` (0 to 1), never `last` (the key
 * said last time) when another is available.
 */
export function pickLine(event: LineEvent, random: number, last?: string): string {
  const lines = RUSH_LINES[event];
  const choices = lines.length > 1 ? lines.filter((key) => key !== last) : lines;
  const index = Math.min(choices.length - 1, Math.floor(random * choices.length));
  return choices[Math.max(0, index)];
}
