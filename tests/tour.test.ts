import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IMPORTED_OBJECTS } from '../src/imported-objects.ts';
import type { Puzzle } from '../src/puzzles.ts';
import { tileModelFor } from '../src/tile-models.ts';
import {
  CLOCK_DEMO_SECONDS,
  clockDemoDone,
  clockDemoFraction,
  startsTourOnEnter,
  TOUR_PUZZLE_IDS,
  TOUR_STEP_COUNT,
  tourAfter,
  type TourEvent,
  tourPuzzles,
  TourStep,
  type TourStepName,
  tourStepNumber,
} from '../src/tour.ts';

const { puzzles } = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8'),
) as { puzzles: Puzzle[] };

const EVENTS: TourEvent[] = [
  'grabbed',
  'solved',
  'clockShown',
  'paused',
  'resumed',
  'timedOut',
  'next',
];

test('played through, each step waits for its own action', () => {
  const path: Array<[TourStepName, TourEvent, TourStepName]> = [
    [TourStep.Grab, 'grabbed', TourStep.Drop],
    [TourStep.Drop, 'solved', TourStep.Orb],
    [TourStep.Orb, 'solved', TourStep.Clock],
    [TourStep.Clock, 'clockShown', TourStep.Pause],
    [TourStep.Pause, 'paused', TourStep.Resume],
    [TourStep.Resume, 'resumed', TourStep.Done],
  ];
  for (const [step, event, next] of path) {
    assert.equal(tourAfter(step, event), next, `${step} + ${event}`);
    // Nothing else moves the step on, except Next (flat pages) and the
    // ways out named below.
    for (const other of EVENTS) {
      if (other === event || other === 'next') continue;
      if (step === TourStep.Grab && other === 'solved') continue;
      if (step === TourStep.Pause && other === 'timedOut') continue;
      assert.equal(tourAfter(step, other), step, `${step} + ${other}`);
    }
  }
});

test('Next moves every step on, so a flat page can finish the tour', () => {
  let step: TourStepName = TourStep.Grab;
  const seen: TourStepName[] = [step];
  while (step !== TourStep.Done) {
    step = tourAfter(step, 'next');
    seen.push(step);
    assert.ok(seen.length < 10, 'Next must reach the end');
  }
  assert.deepEqual(seen, [
    TourStep.Grab,
    TourStep.Drop,
    TourStep.Orb,
    TourStep.Clock,
    TourStep.Pause,
    TourStep.Done,
  ]);
  assert.equal(tourAfter(TourStep.Resume, 'next'), TourStep.Done);
});

test('the tour never gets stuck on the pause step', () => {
  assert.equal(tourAfter(TourStep.Pause, 'timedOut'), TourStep.Done);
  // Picked up and answered at once: straight on to the riddle.
  assert.equal(tourAfter(TourStep.Grab, 'solved'), TourStep.Orb);
  for (const event of EVENTS) {
    assert.equal(tourAfter(TourStep.Done, event), TourStep.Done);
  }
});

test('steps are numbered 1 to 5, pausing and resuming sharing the last', () => {
  assert.equal(TOUR_STEP_COUNT, 5);
  assert.equal(tourStepNumber(TourStep.Grab), 1);
  assert.equal(tourStepNumber(TourStep.Drop), 2);
  assert.equal(tourStepNumber(TourStep.Orb), 3);
  assert.equal(tourStepNumber(TourStep.Clock), 4);
  assert.equal(tourStepNumber(TourStep.Pause), 5);
  assert.equal(tourStepNumber(TourStep.Resume), 5);
});

test('the clock demo runs down, stays out, then fills again', () => {
  assert.equal(clockDemoFraction(0), 1);
  assert.equal(clockDemoFraction(0.5), 1);
  let last = 1;
  let reachedZero = 0;
  let refilled = false;
  for (let s = 0; s <= CLOCK_DEMO_SECONDS + 1; s += 0.05) {
    const fraction = clockDemoFraction(s);
    assert.ok(fraction >= 0 && fraction <= 1, `${s}: ${fraction}`);
    if (fraction === 0) reachedZero += 0.05;
    if (reachedZero > 0 && fraction > last) refilled = true;
    // Down first: it never rises before it has been empty.
    if (reachedZero === 0) assert.ok(fraction <= last, `${s}: rose early`);
    last = fraction;
  }
  // Out long enough for the music to change on a bar line (a bar of the
  // fastest loop is under 2 s).
  assert.ok(reachedZero >= 2, `empty for ${reachedZero} s`);
  assert.ok(refilled);
  assert.equal(clockDemoFraction(CLOCK_DEMO_SECONDS), 1);
});

test('the clock demo waits for RUSH to finish speaking, but not forever', () => {
  assert.equal(clockDemoDone(CLOCK_DEMO_SECONDS - 0.1, false), false);
  assert.equal(clockDemoDone(CLOCK_DEMO_SECONDS, false), true);
  assert.equal(clockDemoDone(CLOCK_DEMO_SECONDS + 2, true), false);
  assert.equal(clockDemoDone(CLOCK_DEMO_SECONDS + 8, true), true);
});

test('the tour starts on entering VR only at home, and only once', () => {
  assert.equal(startsTourOnEnter(false, 'home'), true);
  assert.equal(startsTourOnEnter(true, 'home'), false);
  // A world already picked on the flat page is left alone.
  assert.equal(startsTourOnEnter(false, 'practice'), false);
  assert.equal(startsTourOnEnter(false, 'run'), false);
});

test('the tour puzzles are in the bank, English and easy', () => {
  const { visual, riddle } = tourPuzzles(puzzles);
  assert.ok(visual >= 0, `${TOUR_PUZZLE_IDS.visual} is missing from the bank`);
  assert.ok(riddle >= 0, `${TOUR_PUZZLE_IDS.riddle} is missing from the bank`);
  const picture = puzzles[visual];
  const question = puzzles[riddle];
  assert.equal(picture.type, 'visual');
  assert.equal(question.type, 'riddle');
  for (const puzzle of [picture, question]) {
    assert.equal(puzzle.lang, 'en');
    assert.ok(puzzle.difficulty <= 2, `${puzzle.id} is too hard for the tour`);
  }
  // Every object on the table is one of the owner's models, not a word.
  for (const label of picture.tiles ?? []) {
    const model = tileModelFor(label);
    assert.ok(
      model && IMPORTED_OBJECTS.includes(model),
      `${label} has no imported model`,
    );
  }
});
