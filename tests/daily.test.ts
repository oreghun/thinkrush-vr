import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  currentStreak,
  dailyPuzzles,
  dayKey,
  doneToday,
  EMPTY_RECORD,
  parseRecord,
  previousDay,
  recordDaily,
} from '../src/daily.ts';
import type { Puzzle } from '../src/puzzles.ts';

const bank = JSON.parse(
  readFileSync(new URL('../content/puzzles.json', import.meta.url), 'utf8'),
).puzzles as Puzzle[];

test('days are local calendar dates', () => {
  assert.equal(dayKey(new Date(2026, 10, 3, 23, 59)), '2026-11-03');
  assert.equal(dayKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
});

test('the day before crosses months, years and leap days', () => {
  assert.equal(previousDay('2026-11-01'), '2026-10-31');
  assert.equal(previousDay('2027-01-01'), '2026-12-31');
  assert.equal(previousDay('2028-03-01'), '2028-02-29');
});

test("everyone gets the same puzzles on the same day, one per world, easy first", () => {
  const a = dailyPuzzles(bank, '2026-11-10');
  assert.deepEqual(a, dailyPuzzles(bank, '2026-11-10'));
  const worlds = new Set(bank.map((p) => p.type));
  assert.equal(a.length, worlds.size);
  assert.equal(new Set(a.map((i) => bank[i].type)).size, worlds.size);
  for (let i = 1; i < a.length; i += 1) {
    assert.ok(bank[a[i - 1]].difficulty <= bank[a[i]].difficulty);
  }
});

test('the set changes from day to day', () => {
  const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];
  const sets = new Set(days.map((d) => dailyPuzzles(bank, d).join(',')));
  assert.ok(sets.size >= 4);
});

test('a streak grows on consecutive days and restarts after a gap', () => {
  let record = recordDaily(EMPTY_RECORD, '2026-11-10', 80);
  assert.equal(record.streak, 1);
  record = recordDaily(record, '2026-11-11', 120);
  assert.equal(record.streak, 2);
  // Playing again the same day keeps the streak and the better score.
  record = recordDaily(record, '2026-11-11', 60);
  assert.equal(record.streak, 2);
  assert.equal(record.lastScore, 120);
  record = recordDaily(record, '2026-11-13', 50);
  assert.equal(record.streak, 1);
  assert.equal(record.bestStreak, 2);
  assert.equal(record.bestScore, 120);
});

test('the streak shows until a whole day is missed', () => {
  const record = recordDaily(EMPTY_RECORD, '2026-11-10', 80);
  assert.equal(currentStreak(record, '2026-11-10'), 1);
  assert.equal(currentStreak(record, '2026-11-11'), 1);
  assert.equal(currentStreak(record, '2026-11-12'), 0);
  assert.equal(doneToday(record, '2026-11-10'), true);
  assert.equal(doneToday(record, '2026-11-11'), false);
});

test('a damaged saved record starts fresh rather than breaking the game', () => {
  assert.deepEqual(parseRecord(null), EMPTY_RECORD);
  assert.deepEqual(parseRecord('not json'), EMPTY_RECORD);
  assert.deepEqual(parseRecord('{"lastDay":"x","streak":-3}'), EMPTY_RECORD);
  const saved = recordDaily(EMPTY_RECORD, '2026-11-10', 80);
  assert.deepEqual(parseRecord(JSON.stringify(saved)), saved);
});
