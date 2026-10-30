import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Puzzle } from '../src/puzzles.ts';
import { tileModelFor } from '../src/tile-models.ts';

const { puzzles } = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8'),
) as { puzzles: Puzzle[] };

test('labels pick the most specific miniature', () => {
  assert.equal(tileModelFor('computer keyboard'), 'keyboard');
  assert.equal(tileModelFor('keyring'), 'keyring');
  assert.equal(tileModelFor('key'), 'key');
  assert.equal(tileModelFor('Steel Paper Clip'), 'paper clip');
  assert.equal(tileModelFor('dry seed'), 'seed');
});

test('abstract labels show as words', () => {
  for (const label of ['password', 'shadow', 'footprint', 'tyre track']) {
    assert.equal(tileModelFor(label), undefined, label);
  }
});

// If the answer were the only word among miniatures (or the only miniature
// among words), the tiles would give it away without any thinking.
test('a tile never stands out from the rest by how it is shown', () => {
  for (const puzzle of puzzles.filter((p) => p.type === 'visual')) {
    const tiles = puzzle.tiles ?? [];
    const isModel = (label: string) => tileModelFor(label) !== undefined;
    const sameKind = tiles.filter(
      (label) => isModel(label) === isModel(puzzle.answer),
    );
    assert.ok(
      sameKind.length >= 2,
      `${puzzle.id}: "${puzzle.answer}" is the only tile shown as ${
        isModel(puzzle.answer) ? 'a miniature' : 'a word'
      }`,
    );
  }
});
