import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  categoryIndices,
  nextCategory,
  nextIndexInCategory,
} from '../src/categories.ts';
import type { Puzzle } from '../src/puzzles.ts';

// Only the type field matters to the category logic.
const bank = ['visual', 'riddle', 'visual', 'mafumbo', 'riddle'].map(
  (type, i) => ({ type, id: `p${i}` }) as Puzzle,
);

test('categoryIndices filters by type; all keeps everything', () => {
  assert.deepEqual(categoryIndices(bank, 'all'), [0, 1, 2, 3, 4]);
  assert.deepEqual(categoryIndices(bank, 'visual'), [0, 2]);
  assert.deepEqual(categoryIndices(bank, 'riddle'), [1, 4]);
  assert.deepEqual(categoryIndices(bank, 'proverb'), []);
});

test('nextCategory cycles and skips empty categories', () => {
  assert.equal(nextCategory(bank, 'all'), 'visual');
  assert.equal(nextCategory(bank, 'visual'), 'riddle');
  // No proverbs in the bank, so riddle jumps straight to mafumbo.
  assert.equal(nextCategory(bank, 'riddle'), 'mafumbo');
  assert.equal(nextCategory(bank, 'mafumbo'), 'all');
});

test('nextCategory falls back to all when only one type exists', () => {
  const only = [{ type: 'riddle', id: 'r' } as Puzzle];
  assert.equal(nextCategory(only, 'riddle'), 'all');
  assert.equal(nextCategory(only, 'all'), 'riddle');
});

test('nextIndexInCategory walks the category in order and wraps', () => {
  assert.equal(nextIndexInCategory(bank, 'visual', 0), 2);
  assert.equal(nextIndexInCategory(bank, 'visual', 2), 0);
  assert.equal(nextIndexInCategory(bank, 'riddle', 1), 4);
  assert.equal(nextIndexInCategory(bank, 'all', 4), 0);
});

test('nextIndexInCategory enters the category from a foreign index', () => {
  // Current puzzle is a riddle (1); switching to visual lands on 2.
  assert.equal(nextIndexInCategory(bank, 'visual', 1), 2);
  // Past the last visual it wraps to the first.
  assert.equal(nextIndexInCategory(bank, 'visual', 3), 0);
  // An empty category leaves the index unchanged.
  assert.equal(nextIndexInCategory(bank, 'proverb', 3), 3);
});
