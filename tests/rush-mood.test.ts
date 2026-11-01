import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baseMood,
  type BoardView,
  glowColor,
  Mood,
  Reaction,
  reactionMood,
  mouthShape,
  talkOpenness,
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
  // A run puzzle lost to a wrong pick: RUSH stays worried until the next one.
  assert.equal(baseMood(board({ status: 'wrongPick' })), Mood.Worried);
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
  // The tour starts with a hop, as if RUSH says hello.
  assert.equal(reactionTo(board(), board({ mode: 'tour' })), Reaction.Present);
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

test('the mouth chatters while RUSH talks, never quite shut', () => {
  let opened = 0;
  let nearlyShut = 0;
  for (let time = 0; time < 5; time += 0.01) {
    const open = talkOpenness(time);
    assert.ok(open >= 0.15 && open <= 1, `${time}: ${open}`);
    if (open > 0.7) opened += 1;
    if (open < 0.3) nearlyShut += 1;
    // Talking shows the open mouth, not the smile.
    const shape = mouthShape(Mood.Happy, true, time);
    assert.equal(shape.smile, 0);
    assert.equal(shape.open, open);
  }
  // It both opens wide and nearly closes: it reads as speech.
  assert.ok(opened > 20 && nearlyShut > 20, `${opened} ${nearlyShut}`);
});

test('a quiet mouth shows the mood', () => {
  assert.equal(mouthShape(Mood.Idle, false, 0).smile, 1);
  assert.equal(mouthShape(Mood.Worried, false, 0).smile, -1);
  const happy = mouthShape(Mood.Happy, false, 0);
  assert.ok(happy.smile === 1 && happy.smileSize > 1);
  // Surprised: a small round "o"; sleepy: a thin line.
  const surprised = mouthShape(Mood.Surprised, false, 0);
  assert.ok(surprised.open > 0.5 && surprised.width < 0.7 && surprised.smile === 0);
  const sleepy = mouthShape(Mood.Sleepy, false, 0);
  assert.ok(sleepy.open < 0.3 && sleepy.smile === 0);
});
