import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorder, shuffled } from '../src/answer-order.ts';
import { dealObject } from '../src/object-puzzle.ts';
import { generatePattern, makeRandom } from '../src/patterns.ts';

// Many rounds, with a seeded generator so the test never flakes; the game
// uses the browser's own random numbers the same way.
const ROUNDS = 60000;

/** Where the answer (listed first, as content/puzzles.json lists it) lands, round after round. */
function answerSlots(choices: number, random: () => number): number[] {
  const items = Array.from({ length: choices }, (_, i) => i);
  return Array.from({ length: ROUNDS }, () => shuffled(items, random).indexOf(0));
}

for (const choices of [3, 4]) {
  test(`with ${choices} choices the answer lands in every place equally often`, () => {
    const slots = answerSlots(choices, makeRandom(choices * 101));
    for (let slot = 0; slot < choices; slot += 1) {
      const share = slots.filter((s) => s === slot).length / ROUNDS;
      assert.ok(Math.abs(share - 1 / choices) < 0.01, `slot ${slot}: ${share}`);
    }
  });

  test(`with ${choices} choices the last answer's place says nothing about the next`, () => {
    const slots = answerSlots(choices, makeRandom(choices * 977));
    const counts = Array.from({ length: choices }, () => new Array(choices).fill(0));
    for (let i = 1; i < ROUNDS; i += 1) {
      counts[slots[i - 1]][slots[i]] += 1;
    }
    // Every step, from any place to any place, is equally likely.
    for (const row of counts) {
      const total = row.reduce((a: number, b: number) => a + b, 0);
      for (const n of row) {
        assert.ok(Math.abs(n / total - 1 / choices) < 0.015, `${n} of ${total}`);
      }
    }
  });

  test(`with ${choices} choices no guessing order beats chance`, () => {
    const slots = answerSlots(choices, makeRandom(choices * 31337));
    const strategies: Record<string, (i: number) => number> = {
      'always the first': () => 0,
      'same place as last time': (i) => slots[i - 1],
      'the place after last time': (i) => (slots[i - 1] + 1) % choices,
      'first, second, third... in turn': (i) => i % choices,
    };
    for (const [name, guess] of Object.entries(strategies)) {
      let wins = 0;
      for (let i = 1; i < ROUNDS; i += 1) {
        if (guess(i) === slots[i]) wins += 1;
      }
      const rate = wins / (ROUNDS - 1);
      assert.ok(Math.abs(rate - 1 / choices) < 0.01, `${name}: ${rate}`);
    }
  });
}

test('reorder keeps every option and tracks where the answer went', () => {
  const random = makeRandom(5);
  for (let i = 0; i < 1000; i += 1) {
    const options = ['a', 'b', 'c', 'd'];
    const answerIndex = i % 4;
    const answer = options[answerIndex];
    const now = reorder(options, answerIndex, random);
    assert.deepEqual([...options].sort(), ['a', 'b', 'c', 'd']);
    assert.equal(options[now], answer);
  }
});

test('a replayed Daily board keeps its pieces but not their places', () => {
  // The Daily Challenge deals the same board from the same seed; reorder
  // runs after it with fresh random numbers on every play.
  const random = makeRandom(77);
  let samePlace = 0;
  const plays = 4000;
  for (let i = 0; i < plays; i += 1) {
    const first = dealObject('giraffe', 3, makeRandom(2026));
    const replay = dealObject('giraffe', 3, makeRandom(2026));
    assert.deepEqual(replay, first, 'the same board');
    const a = reorder(first.options, first.answerIndex, random);
    const b = reorder(replay.options, replay.answerIndex, random);
    if (a === b) samePlace += 1;
  }
  assert.ok(Math.abs(samePlace / plays - 1 / 4) < 0.03, `${samePlace} of ${plays}`);
});

test('pattern and object boards put the right piece in every place equally often', () => {
  const deals = 8000;
  const patternSlots = new Array(4).fill(0);
  const objectSlots = new Array(4).fill(0);
  for (let seed = 1; seed <= deals; seed += 1) {
    patternSlots[generatePattern('kitenge', 'repeat-2', makeRandom(seed)).answerIndex] += 1;
    if (seed <= deals / 4) {
      objectSlots[dealObject('hut', 2, makeRandom(seed)).answerIndex] += 1;
    }
  }
  for (const n of patternSlots) {
    assert.ok(Math.abs(n / deals - 0.25) < 0.02, `pattern ${patternSlots}`);
  }
  for (const n of objectSlots) {
    assert.ok(Math.abs(n / (deals / 4) - 0.25) < 0.035, `object ${objectSlots}`);
  }
});
