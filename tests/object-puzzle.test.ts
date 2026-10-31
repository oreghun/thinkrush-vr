import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dealObject,
  FIGURE_NAMES,
  FIGURES,
  figureCells,
  fitTurns,
  isConnected,
  judgeFit,
  mirrorCells,
  normalize,
  PALETTE,
  sameUpToTurn,
  shapeKey,
  turnCells,
} from '../src/object-puzzle.ts';
import { makeRandom } from '../src/patterns.ts';

const QUARTER = Math.PI / 2;
const DEALS = 300;

test('every figure is drawn in even rows with known colours, at most 10 x 10', () => {
  for (const name of FIGURE_NAMES) {
    const rows = FIGURES[name];
    assert.ok(rows.length <= 10, name);
    for (const row of rows) {
      assert.equal(row.length, rows[0].length, `${name}: "${row}"`);
      assert.ok(row.length <= 10, name);
      for (const ch of row) {
        assert.ok(ch === '.' || ch in PALETTE, `${name}: "${ch}"`);
      }
    }
  }
});

test('an L turned four times comes back, and its mirror never matches it', () => {
  const l = normalize([
    { x: 0, y: 0, color: 'R' },
    { x: 1, y: 0, color: 'R' },
    { x: 0, y: 1, color: 'R' },
    { x: 0, y: 2, color: 'R' },
  ]);
  assert.equal(shapeKey(turnCells(l, 4)), shapeKey(l));
  assert.equal(shapeKey(turnCells(turnCells(l, 1), -1)), shapeKey(l));
  assert.notEqual(shapeKey(turnCells(l, 1)), shapeKey(l));
  assert.equal(sameUpToTurn(mirrorCells(l), l), false);
  // A square of one colour looks the same at every turn.
  const square = normalize([
    { x: 0, y: 0, color: 'R' },
    { x: 1, y: 0, color: 'R' },
    { x: 0, y: 1, color: 'R' },
    { x: 1, y: 1, color: 'R' },
  ]);
  assert.deepEqual(fitTurns(square, square), [0, 1, 2, 3]);
});

for (const figure of FIGURE_NAMES) {
  for (const difficulty of [1, 2, 3, 4, 5]) {
    test(`${figure}, difficulty ${difficulty}: only the right piece can fit`, () => {
      const all = new Set(figureCells(figure).map((c) => `${c.x},${c.y}${c.color}`));
      for (let seed = 1; seed <= DEALS; seed += 1) {
        const board = dealObject(figure, difficulty, makeRandom(seed * 7919 + difficulty));
        const size = difficulty <= 2 ? 4 : 5;
        assert.equal(board.gap.length, size);
        assert.ok(isConnected(board.gap));
        for (const cell of board.gap) {
          assert.ok(all.has(`${cell.x},${cell.y}${cell.color}`), 'gap is on the figure');
        }
        assert.equal(board.options.length, 4);
        const answer = board.options[board.answerIndex];
        assert.equal(shapeKey(answer.cells), shapeKey(board.gap));
        board.options.forEach((option, i) => {
          assert.equal(option.cells.length, size);
          assert.ok(isConnected(option.cells), 'every piece holds together');
          assert.ok(option.turn >= -1 && option.turn <= 1, 'at most a quarter turn off');
          if (i !== board.answerIndex) {
            assert.equal(sameUpToTurn(option.cells, board.gap), false, 'a wrong piece never fits');
          }
          for (let j = i + 1; j < board.options.length; j += 1) {
            assert.equal(
              sameUpToTurn(option.cells, board.options[j].cells),
              false,
              'no two pieces look alike',
            );
          }
        });
        if (difficulty === 1) {
          assert.equal(answer.turn, 0, 'the first boards fit as shown');
        } else {
          assert.notEqual(answer.turn, 0, 'later boards need a turn');
        }
        if (difficulty <= 3) {
          assert.ok(new Set(board.gap.map((c) => c.color)).size >= 2, 'two colours or more');
        }
      }
    });
  }
}

test('the right piece fits once turned back, face out, within tolerance', () => {
  for (let seed = 1; seed <= DEALS; seed += 1) {
    const board = dealObject('giraffe', 3, makeRandom(seed));
    const answer = board.options[board.answerIndex];
    const undo = -answer.turn * QUARTER;
    assert.equal(judgeFit(board, board.answerIndex, undo, 1), 'fits');
    assert.equal(judgeFit(board, board.answerIndex, undo + 0.5, 0.6), 'fits');
    assert.equal(judgeFit(board, board.answerIndex, undo - 0.5, 0.6), 'fits');
    // Not turned back (it is shown a quarter turn off), or turned too far.
    assert.equal(judgeFit(board, board.answerIndex, 0, 1), 'turn');
    assert.equal(judgeFit(board, board.answerIndex, undo + 0.8, 1), 'turn');
    // Its plain back facing out.
    assert.equal(judgeFit(board, board.answerIndex, undo, -0.9), 'turn');
    // Any wrong piece is wrong, however it is held.
    for (let i = 0; i < 4; i += 1) {
      if (i !== board.answerIndex) {
        for (const roll of [-QUARTER, 0, QUARTER]) {
          assert.equal(judgeFit(board, i, roll, 1), 'wrong');
        }
      }
    }
  }
});

test('the same seed deals the same board', () => {
  const a = dealObject('dhow', 4, makeRandom(42));
  const b = dealObject('dhow', 4, makeRandom(42));
  assert.deepEqual(a, b);
});

test('every object puzzle in the bank names a figure and deals a fair board', async () => {
  const { readFileSync } = await import('node:fs');
  const bank = JSON.parse(readFileSync('content/puzzles.json', 'utf8')) as {
    puzzles: { id: string; type: string; figure?: string; difficulty: number }[];
  };
  const objects = bank.puzzles.filter((puzzle) => puzzle.type === 'object');
  assert.ok(objects.length > 0);
  for (const puzzle of objects) {
    assert.ok(FIGURE_NAMES.includes(puzzle.figure as never), puzzle.id);
    const board = dealObject(puzzle.figure as never, puzzle.difficulty, makeRandom(1));
    assert.equal(board.options.length, 4, puzzle.id);
  }
});
