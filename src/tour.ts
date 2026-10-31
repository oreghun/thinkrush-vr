// "How to play": a short tour that is played, not read. RUSH asks for one
// small action at a time and moves on once it is done: pick up an object,
// drop the odd one out on the tray, pinch an answer orb, watch RUSH be the
// clock, turn a palm up to pause. Every line is read aloud and shown on the
// screen. It starts on its own the first time a device enters VR at home,
// and the home page's "How to play" button replays it.
//
// No runtime imports, so the ECS component schema and Node's test runner
// can both use it.

export const TourStep = {
  /** Pick up any object on the table. */
  Grab: 'grab',
  /** Drop the odd one out on the tray: an easy picture puzzle. */
  Drop: 'drop',
  /** Pinch the orb with the answer to an easy riddle. */
  Orb: 'orb',
  /** RUSH shrinks and reddens, then grows back: it is the clock. */
  Clock: 'clock',
  /** Turn a palm up to pause. */
  Pause: 'pause',
  /** Paused: turn the palm up again (or press Resume) to carry on. */
  Resume: 'resume',
  /** The tour is over; the home page is up. */
  Done: 'done',
} as const;

export type TourStepName = (typeof TourStep)[keyof typeof TourStep];

/** What can move the tour on. */
export type TourEvent =
  | 'grabbed'
  | 'solved'
  | 'clockShown'
  | 'paused'
  | 'resumed'
  | 'timedOut'
  | 'next';

/** The steps as numbered on the screen ("2/5"); Resume shares Pause's number. */
const NUMBERED: readonly TourStepName[] = [
  TourStep.Grab,
  TourStep.Drop,
  TourStep.Orb,
  TourStep.Clock,
  TourStep.Pause,
];

export const TOUR_STEP_COUNT = NUMBERED.length;

/** The step's number on the screen, 1 to TOUR_STEP_COUNT. */
export function tourStepNumber(step: TourStepName): number {
  if (step === TourStep.Resume) return TOUR_STEP_COUNT;
  if (step === TourStep.Done) return TOUR_STEP_COUNT;
  return NUMBERED.indexOf(step) + 1;
}

/**
 * The step after `event` in `step`; the same step when the event does not
 * move this step on. "next" (the flat page's Next step button, where there
 * are no hands) moves every step on.
 */
export function tourAfter(step: TourStepName, event: TourEvent): TourStepName {
  switch (step) {
    case TourStep.Grab:
      if (event === 'grabbed' || event === 'next') return TourStep.Drop;
      // Picked up and answered in one go.
      if (event === 'solved') return TourStep.Orb;
      return step;
    case TourStep.Drop:
      return event === 'solved' || event === 'next' ? TourStep.Orb : step;
    case TourStep.Orb:
      return event === 'solved' || event === 'next' ? TourStep.Clock : step;
    case TourStep.Clock:
      return event === 'clockShown' || event === 'next' ? TourStep.Pause : step;
    case TourStep.Pause:
      if (event === 'paused') return TourStep.Resume;
      // No pause after a while (or Next): the tour ends anyway.
      return event === 'timedOut' || event === 'next' ? TourStep.Done : step;
    case TourStep.Resume:
      return event === 'resumed' || event === 'next' ? TourStep.Done : step;
    default:
      return step;
  }
}

// The clock demo, in seconds: a moment at full size while RUSH starts to
// speak, then the whole clock runs down, stays out long enough for the music
// to reach its fastest loop (it changes only on a bar line), and fills again.
const DEMO_LEAD = 0.8;
const DEMO_SHRINK = 2.5;
const DEMO_HOLD = 2.5;
const DEMO_GROW = 1.5;
export const CLOCK_DEMO_SECONDS = DEMO_LEAD + DEMO_SHRINK + DEMO_HOLD + DEMO_GROW;
// The demo waits for RUSH to finish speaking, but never longer than this
// past its end (a voice that never reports the end must not stall the tour).
const DEMO_SPEECH_WAIT = 8;

/** Share of the clock shown `seconds` into the demo, 1 (full) to 0. */
export function clockDemoFraction(seconds: number): number {
  let t = seconds - DEMO_LEAD;
  if (t <= 0) return 1;
  if (t < DEMO_SHRINK) return 1 - t / DEMO_SHRINK;
  t -= DEMO_SHRINK;
  if (t < DEMO_HOLD) return 0;
  t -= DEMO_HOLD;
  return t < DEMO_GROW ? t / DEMO_GROW : 1;
}

/** Whether the clock demo is over: shown in full and RUSH done speaking. */
export function clockDemoDone(seconds: number, speaking: boolean): boolean {
  return (
    seconds >= CLOCK_DEMO_SECONDS &&
    (!speaking || seconds >= CLOCK_DEMO_SECONDS + DEMO_SPEECH_WAIT)
  );
}

/** With no pause this long into the pause step, the tour ends anyway. */
export const PAUSE_WAIT_SECONDS = 15;

/**
 * The tour's two puzzles from content/puzzles.json: an easy picture puzzle
 * whose four objects are all the owner's models, and an easy riddle.
 * tests/tour.test.ts checks they exist and stay easy.
 */
export const TOUR_PUZZLE_IDS = {
  visual: 'en-visual-07',
  riddle: 'en-riddle-01',
} as const;

/** Where the tour's puzzles are in `puzzles`; -1 when one is missing. */
export function tourPuzzles(puzzles: readonly { id: string }[]): {
  visual: number;
  riddle: number;
} {
  return {
    visual: puzzles.findIndex((puzzle) => puzzle.id === TOUR_PUZZLE_IDS.visual),
    riddle: puzzles.findIndex((puzzle) => puzzle.id === TOUR_PUZZLE_IDS.riddle),
  };
}

/** Saved once the tour is finished or skipped: it then waits for its button. */
export const TOUR_SEEN_KEY = 'thinkrush.tourSeen';

/**
 * Whether entering VR starts the tour: only on a device that has not seen
 * it, and only from the home page (a puzzle already picked is left alone).
 */
export function startsTourOnEnter(seen: boolean, mode: string): boolean {
  return !seen && mode === 'home';
}
