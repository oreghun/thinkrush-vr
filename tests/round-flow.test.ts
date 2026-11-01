import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Puzzle } from '../src/puzzles.ts';
import {
  answerSeconds,
  choiceDone,
  namesChoices,
  readingDone,
  RUN_PUZZLES,
  solvePoints,
  typedWords,
  typingPace,
} from '../src/round-flow.ts';

const { puzzles } = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8'),
) as { puzzles: Puzzle[] };

test('each kind of puzzle gets the answer time it needs', () => {
  for (const type of ['riddle', 'proverb', 'mafumbo']) {
    assert.equal(answerSeconds(type), 10, type);
  }
  assert.equal(answerSeconds('visual'), 15);
  assert.equal(answerSeconds('pattern'), 20);
  assert.equal(answerSeconds('object'), 20);
  // Every puzzle in the bank has a set time, none shorter than an orb's.
  for (const puzzle of puzzles) {
    assert.ok(answerSeconds(puzzle.type) >= 10, puzzle.id);
  }
});

test('RUSH names orbs and objects, not pattern or missing pieces', () => {
  for (const type of ['riddle', 'proverb', 'mafumbo', 'visual']) {
    assert.equal(namesChoices(type), true, type);
  }
  assert.equal(namesChoices('pattern'), false);
  assert.equal(namesChoices('object'), false);
});

test('typing keeps pace with the voice', () => {
  assert.ok(typingPace('slow') < typingPace('normal'));
  assert.ok(typingPace('normal') < typingPace('fast'));
  // Read-aloud off types at the normal pace.
  assert.equal(typingPace('off'), typingPace('normal'));
});

test('the question appears a whole word at a time', () => {
  const text = 'A magnet is coming. Which one stays put?';
  let last = '';
  for (let chars = 0; chars <= text.length + 2; chars += 1) {
    const shown = typedWords(text, chars);
    // Only ever whole words from the start of the text, never shrinking.
    assert.ok(text.startsWith(shown), `${chars}: ${shown}`);
    assert.ok(shown.length >= last.length, `${chars}: shrank`);
    if (shown.length > 0 && shown.length < text.length) {
      assert.equal(text[shown.length], ' ', `${chars}: half a word`);
    }
    last = shown;
  }
  assert.equal(typedWords(text, 0), '');
  // A word shows once its last letter is typed.
  assert.equal(typedWords(text, 1), 'A');
  assert.equal(typedWords(text, 7), 'A');
  assert.equal(typedWords(text, 8), 'A magnet');
  assert.equal(typedWords(text, text.length), text);
});

test('the choices wait for the last word and for RUSH to finish reading', () => {
  assert.equal(readingDone(false, 5, false), false);
  assert.equal(readingDone(true, 0.1, false), false);
  assert.equal(readingDone(true, 0.5, false), true);
  assert.equal(readingDone(true, 3, true), false);
  // A voice that never says it has finished does not hold the game.
  assert.equal(readingDone(true, 8, true), true);
});

test('each choice is named before the next appears', () => {
  // With a voice: at least a moment each, then as soon as RUSH is quiet.
  assert.equal(choiceDone(0.2, true, false), false);
  assert.equal(choiceDone(0.4, true, false), true);
  assert.equal(choiceDone(2, true, true), false);
  assert.equal(choiceDone(4, true, true), true);
  // Without one, a steady beat each.
  assert.equal(choiceDone(0.5, false, false), false);
  assert.equal(choiceDone(0.7, false, false), true);
});

test('a quicker solve scores more', () => {
  assert.equal(solvePoints(2, 0), 20);
  assert.equal(solvePoints(2, 7.9), 27);
  assert.equal(solvePoints(5, 20), 70);
  assert.ok(solvePoints(3, 9) > solvePoints(3, 2));
  assert.equal(solvePoints(1, -1), 10);
  assert.equal(RUN_PUZZLES, 10);
});
