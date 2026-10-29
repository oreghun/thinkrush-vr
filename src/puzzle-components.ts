import { createComponent, Types } from '@iwsdk/core';

export const PuzzleStatus = {
  Playing: 'playing',
  Solved: 'solved',
  TimeUp: 'timeUp',
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
});

/**
 * A tile the player can grab. slot is its place in the row on the table
 * (0-3); correct is set at the start of each round, after shuffling.
 */
export const PuzzleTile = createComponent('PuzzleTile', {
  slot: { type: Types.Int8, default: 0 },
  correct: { type: Types.Boolean, default: false },
});
