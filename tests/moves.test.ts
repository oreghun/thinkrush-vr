import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judge, Move, pickMove, releaseMove } from '../src/moves.ts';

test('two plain drops, then one new move at a time', () => {
  assert.deepEqual(pickMove(0, 0.9), { move: Move.Drop, isNew: false });
  assert.deepEqual(pickMove(1, 0.9), { move: Move.Drop, isNew: false });
  assert.deepEqual(pickMove(2, 0.1), { move: Move.Flip, isNew: true });
  assert.deepEqual(pickMove(4, 0.1), { move: Move.Lift, isNew: true });
});

test('between and after introductions, only known moves come up', () => {
  // After flip arrives but before lift: drop or flip.
  assert.equal(pickMove(3, 0).move, Move.Drop);
  assert.equal(pickMove(3, 0.99).move, Move.Flip);
  // Once all three are known, each can come up.
  const seen = new Set([0, 0.4, 0.8].map((r) => pickMove(9, r).move));
  assert.deepEqual(seen, new Set([Move.Drop, Move.Flip, Move.Lift]));
  assert.equal(pickMove(9, 0.5).isNew, false);
});

test('a flip counts wherever it lands; a drop needs the tray', () => {
  assert.equal(releaseMove(true, false), Move.Flip);
  assert.equal(releaseMove(true, true), Move.Flip);
  assert.equal(releaseMove(false, true), Move.Drop);
  assert.equal(releaseMove(false, false), undefined);
});

test('right object, wrong move is its own verdict', () => {
  assert.equal(judge(Move.Flip, Move.Flip, true), 'solved');
  assert.equal(judge(Move.Drop, Move.Flip, true), 'wrongMove');
  assert.equal(judge(Move.Flip, Move.Flip, false), 'wrong');
  assert.equal(judge(Move.Drop, Move.Lift, false), 'wrong');
});
