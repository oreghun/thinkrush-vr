import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  generatePattern,
  lookKey,
  makeRandom,
  MAX_COUNT,
  OPTION_COUNT,
  PATTERN_FAMILIES,
  PATTERN_RULES,
  type PatternBoard,
  ruleFits,
  seedFrom,
  STRIP_LENGTH,
} from '../src/patterns.ts';

// The strip really follows its rule, so the gap has one fair answer.
function followsRule(board: PatternBoard): boolean {
  const { strip, rule } = board;
  const same = (a: number, b: number) =>
    lookKey(board.family, strip[a]) === lookKey(board.family, strip[b]);
  switch (rule) {
    case 'repeat-2':
      return strip.every((_, i) => i < 2 || same(i, i - 2)) && !same(0, 1);
    case 'repeat-3':
      return strip.every((_, i) => i < 3 || same(i, i - 3)) && !same(0, 1);
    case 'mirror':
      return [0, 1, 2].every((i) => same(i, STRIP_LENGTH - 1 - i));
    case 'turn':
      return strip.every(
        (p, i) => i === 0 || p.turn === (strip[i - 1].turn + 1) % 4,
      );
    case 'grow':
      return strip.every((p, i) => p.count === i + 2);
    case 'two-cycles':
      return (
        new Set(strip.map((p) => lookKey(board.family, p))).size ===
        STRIP_LENGTH
      );
  }
}

for (const family of PATTERN_FAMILIES) {
  for (const rule of PATTERN_RULES) {
    if (!ruleFits(family, rule)) {
      continue;
    }
    test(`${family} / ${rule}: one right piece among four, every time`, () => {
      for (let seed = 1; seed <= 300; seed += 1) {
        const board = generatePattern(family, rule, makeRandom(seed));
        assert.equal(board.strip.length, STRIP_LENGTH);
        assert.equal(board.options.length, OPTION_COUNT);
        assert.ok(followsRule(board), `seed ${seed}: strip breaks the rule`);
        const keys = board.options.map((p) => lookKey(family, p));
        assert.equal(new Set(keys).size, OPTION_COUNT, `seed ${seed}: two pieces look alike`);
        assert.equal(
          keys[board.answerIndex],
          lookKey(family, board.strip[board.gap]),
          `seed ${seed}: the marked answer is not the missing piece`,
        );
        for (const p of [...board.strip, ...board.options]) {
          assert.ok(p.count >= 1 && p.count <= MAX_COUNT);
        }
      }
    });
  }
}

test('turning needs a motif that looks different at every quarter turn', () => {
  assert.equal(ruleFits('weave', 'turn'), false);
  assert.throws(() => generatePattern('weave', 'turn', makeRandom(1)));
});

test('the same seed deals the same board', () => {
  const a = generatePattern('kitenge', 'two-cycles', makeRandom(seedFrom('x')));
  const b = generatePattern('kitenge', 'two-cycles', makeRandom(seedFrom('x')));
  assert.deepEqual(a, b);
});

// Every pattern puzzle in the bank names a family and rule that deal fairly.
const bank = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8'),
).puzzles as Array<{ id: string; type: string; family?: string; rule?: string }>;
for (const puzzle of bank.filter((p) => p.type === 'pattern')) {
  test(`${puzzle.id}: its family and rule make a fair board`, () => {
    const family = puzzle.family as (typeof PATTERN_FAMILIES)[number];
    const rule = puzzle.rule as (typeof PATTERN_RULES)[number];
    assert.ok(PATTERN_FAMILIES.includes(family), `unknown family ${family}`);
    assert.ok(PATTERN_RULES.includes(rule), `unknown rule ${rule}`);
    assert.ok(ruleFits(family, rule), `${rule} does not fit ${family}`);
    generatePattern(family, rule, makeRandom(seedFrom(puzzle.id)));
  });
}
