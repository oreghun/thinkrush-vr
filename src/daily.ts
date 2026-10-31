// The Daily Challenge and streaks. Each day has its own five puzzles, one
// from each world, picked from the date alone: everyone playing that day
// gets the same set (and the same pattern boards). Finishing the challenge
// on consecutive days builds a streak. Everything is kept on the device
// (localStorage); nothing is sent anywhere.
//
// No runtime imports, so Node's test runner can check it (the two small
// seeded helpers below match the ones in src/patterns.ts).

import type { Puzzle } from './puzzles.js';

/** A seed from text (FNV-1a). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small seeded random generator (mulberry32): numbers in [0, 1). */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The worlds the challenge draws one puzzle from, in tie-break order. */
const WORLD_ORDER: Puzzle['type'][] = ['visual', 'pattern', 'riddle', 'proverb', 'mafumbo'];

/** A day as YYYY-MM-DD in the player's own time zone. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The day before `day` (both YYYY-MM-DD), month and year ends included. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const before = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  const month = String(before.getUTCMonth() + 1).padStart(2, '0');
  const date = String(before.getUTCDate()).padStart(2, '0');
  return `${before.getUTCFullYear()}-${month}-${date}`;
}

/** The seed for everything random in one day's challenge. */
export function dailySeed(day: string, salt = ''): number {
  return seedFrom(`thinkrush-daily:${day}:${salt}`);
}

/**
 * Today's puzzles as bank indices: one from each world that has content,
 * easiest first (ties in world order), the same for everyone on `day`.
 */
export function dailyPuzzles(puzzles: readonly Puzzle[], day: string): number[] {
  const random = makeRandom(dailySeed(day));
  const picked: number[] = [];
  for (const type of WORLD_ORDER) {
    const indices = puzzles
      .map((puzzle, index) => (puzzle.type === type ? index : -1))
      .filter((index) => index >= 0);
    if (indices.length > 0) {
      picked.push(indices[Math.floor(random() * indices.length)]);
    }
  }
  return picked.sort(
    (a, b) =>
      puzzles[a].difficulty - puzzles[b].difficulty ||
      WORLD_ORDER.indexOf(puzzles[a].type) - WORLD_ORDER.indexOf(puzzles[b].type),
  );
}

/** What the device remembers about the Daily Challenge. */
export interface DailyRecord {
  /** The last day a challenge was finished, or null. */
  lastDay: string | null;
  /** Days in a row ending on lastDay. */
  streak: number;
  bestStreak: number;
  /** The best score on lastDay. */
  lastScore: number;
  bestScore: number;
}

export const EMPTY_RECORD: DailyRecord = {
  lastDay: null,
  streak: 0,
  bestStreak: 0,
  lastScore: 0,
  bestScore: 0,
};

/** The record after finishing `day`'s challenge with `score`. */
export function recordDaily(record: DailyRecord, day: string, score: number): DailyRecord {
  let streak: number;
  let lastScore: number;
  if (record.lastDay === day) {
    // Played again today: the streak stands, the better score counts.
    streak = record.streak;
    lastScore = Math.max(record.lastScore, score);
  } else {
    streak = record.lastDay === previousDay(day) ? record.streak + 1 : 1;
    lastScore = score;
  }
  return {
    lastDay: day,
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    lastScore,
    bestScore: Math.max(record.bestScore, score),
  };
}

/** The streak still alive on `today`: kept until a whole day is missed. */
export function currentStreak(record: DailyRecord, today: string): number {
  return record.lastDay === today || record.lastDay === previousDay(today)
    ? record.streak
    : 0;
}

export function doneToday(record: DailyRecord, today: string): boolean {
  return record.lastDay === today;
}

/** Reads a stored record, falling back to an empty one for anything odd. */
export function parseRecord(text: string | null): DailyRecord {
  try {
    const data = JSON.parse(text ?? '');
    const count = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : 0;
    return {
      lastDay:
        typeof data.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(data.lastDay)
          ? data.lastDay
          : null,
      streak: count(data.streak),
      bestStreak: count(data.bestStreak),
      lastScore: count(data.lastScore),
      bestScore: count(data.bestScore),
    };
  } catch {
    return { ...EMPTY_RECORD };
  }
}
