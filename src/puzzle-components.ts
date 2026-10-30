import { createComponent, Types } from '@iwsdk/core';
import { PuzzleCategory } from './categories.js';
import { Move } from './moves.js';

export const PuzzleStatus = {
  Playing: 'playing',
  Solved: 'solved',
  TimeUp: 'timeUp',
  /** A run puzzle lost to the right object with the wrong move. */
  WrongMove: 'wrongMove',
} as const;

export const PuzzleMode = {
  /** Browse the bank one puzzle at a time, 60 s each, no score. */
  Practice: 'practice',
  /** A 3-minute run: mixed puzzles, auto-advance on solve, score. */
  Run: 'run',
  /** The run ended; the panel shows the summary. */
  RunOver: 'runOver',
} as const;

/** The state of the current round, kept on the puzzle table. */
export const PuzzleBoard = createComponent('PuzzleBoard', {
  status: {
    type: Types.Enum,
    enum: PuzzleStatus,
    default: PuzzleStatus.Playing,
  },
  secondsLeft: { type: Types.Float32, default: 60 },
  wrongAnswers: { type: Types.Int8, default: 0 },
  // Which puzzle from content/puzzles.json is being played.
  puzzleIndex: { type: Types.Int16, default: 0 },
  mode: {
    type: Types.Enum,
    enum: PuzzleMode,
    default: PuzzleMode.Practice,
  },
  // Run totals; both stay 0 outside a run.
  score: { type: Types.Int16, default: 0 },
  solved: { type: Types.Int8, default: 0 },
  // Which part of the bank Next and runs draw from.
  category: {
    type: Types.Enum,
    enum: PuzzleCategory,
    default: PuzzleCategory.All,
  },
  // What a visual puzzle asks you to do with your pick (see src/moves.ts).
  move: { type: Types.Enum, enum: Move, default: Move.Drop },
});

/**
 * A tile the player can grab. slot is its place in the row on the table
 * (0-3); correct is set at the start of each round, after shuffling.
 */
export const PuzzleTile = createComponent('PuzzleTile', {
  slot: { type: Types.Int8, default: 0 },
  correct: { type: Types.Boolean, default: false },
});

/**
 * A floating answer orb for riddle, proverb and mafumbo puzzles. slot is its
 * place in the row (0-2); correct is set each round, after shuffling.
 */
export const AnswerOrb = createComponent('AnswerOrb', {
  slot: { type: Types.Int8, default: 0 },
  correct: { type: Types.Boolean, default: false },
});
