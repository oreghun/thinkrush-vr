import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baseMood,
  type BoardView,
  glowColor,
  Mood,
  Reaction,
  reactionMood,
  reactionTo,
  rushScale,
  timeFraction,
} from '../src/rush-mood.ts';

const board = (change: Partial<BoardView> = {}): BoardView => ({
  puzzleIndex: 0,
  status: 'playing',
  mode: 'practice',
  wrongAnswers: 0,
  wrongMoves: 0,
  ...change,
});

test('the lasting mood follows the round', () => {
  assert.equal(baseMood(board()), Mood.Idle);
  assert.equal(baseMood(board({ status: 'solved' })), Mood.Happy);
  assert.equal(baseMood(board({ status: 'timeUp' })), Mood.Sleepy);
  assert.equal(baseMood(board({ status: 'wrongMove' })), Mood.Surprised);
  assert.equal(baseMood(board({ mode: 'runOver' })), Mood.Happy);
});

test('RUSH reacts to what just changed', () => {
  assert.equal(
    reactionTo(board(), board({ status: 'solved' })),
    Reaction.Cheer,
  );
  assert.equal(
    reactionTo(board(), board({ wrongAnswers: 1 })),
    Reaction.Worried,
  );
  assert.equal(
    reactionTo(board(), board({ wrongMoves: 1 })),
    Reaction.Surprised,
  );
  assert.equal(
    reactionTo(board(), board({ puzzleIndex: 3 })),
    Reaction.Present,
  );
  assert.equal(reactionTo(board(), board({ mode: 'run' })), Reaction.Present);
  assert.equal(reactionTo(board(), board()), undefined);
  // A new round resets the wrong-answer count: that is no reaction of its own.
  assert.equal(
    reactionTo(
      board({ wrongAnswers: 2 }),
      board({ wrongAnswers: 0, puzzleIndex: 1 }),
    ),
    Reaction.Present,
  );
});

test('a reaction shows its own eyes, except presenting', () => {
  assert.equal(reactionMood(Reaction.Cheer, Mood.Idle), Mood.Happy);
  assert.equal(reactionMood(Reaction.Worried, Mood.Idle), Mood.Worried);
  assert.equal(reactionMood(Reaction.Present, Mood.Sleepy), Mood.Sleepy);
});

test('RUSH shrinks and warms as the clock runs out', () => {
  assert.equal(timeFraction(30, 60), 0.5);
  assert.equal(timeFraction(-1, 60), 0);
  assert.equal(rushScale(1), 1);
  assert.equal(rushScale(0), 0.45);
  assert.deepEqual(glowColor(1), glowColor(0.35));
  const [, greenFull] = glowColor(1);
  const [, greenEnd] = glowColor(0);
  assert.ok(greenEnd < greenFull, 'the glow turns red at the end');
});

test('RUSH dozes while the game is paused', () => {
  assert.equal(
    baseMood({ puzzleIndex: 0, status: 'playing', mode: 'practice', wrongAnswers: 0, wrongMoves: 0, paused: true }),
    Mood.Sleepy,
  );
});
