import { createComponent, Types } from '@iwsdk/core';
import { PuzzleCategory } from './categories.js';
import { Move } from './moves.js';
import { TourStep } from './tour.js';
import { RoundPhase } from './round-flow.js';

export const PuzzleStatus = {
  Playing: 'playing',
  Solved: 'solved',
  TimeUp: 'timeUp',
  /** A run puzzle lost to the right object with the wrong move. */
  WrongMove: 'wrongMove',
  /** A run puzzle lost to a wrong pick: no guessing your way through. */
  WrongPick: 'wrongPick',
} as const;

export const PuzzleMode = {
  /** The home page is up: the table is clear until a world is picked. */
  Home: 'home',
  /** Browse the bank one puzzle at a time, 60 s each, no score. */
  Practice: 'practice',
  /** A run: a set of puzzles, one try each, auto-advance, score. */
  Run: 'run',
  /** The run ended; the panel shows the summary. */
  RunOver: 'runOver',
  /** How to play: RUSH's played tour, one action at a time (src/tour.ts). */
  Tour: 'tour',
} as const;

/** The state of the current round, kept on the puzzle table. */
export const PuzzleBoard = createComponent('PuzzleBoard', {
  status: {
    type: Types.Enum,
    enum: PuzzleStatus,
    default: PuzzleStatus.Playing,
  },
  // The answer clock: it runs only in the answering phase, from
  // answerSeconds (which depends on the kind of puzzle, see round-flow.ts).
  secondsLeft: { type: Types.Float32, default: 10 },
  answerSeconds: { type: Types.Float32, default: 10 },
  // Reading (the question types out and is read), choices (they appear and
  // are named), answering (the clock runs).
  phase: { type: Types.Enum, enum: RoundPhase, default: RoundPhase.Reading },
  wrongAnswers: { type: Types.Int8, default: 0 },
  // Right object, wrong move, this round (RUSH reacts to each one).
  wrongMoves: { type: Types.Int8, default: 0 },
  // Which puzzle from content/puzzles.json is being played.
  puzzleIndex: { type: Types.Int16, default: 0 },
  mode: {
    type: Types.Enum,
    enum: PuzzleMode,
    default: PuzzleMode.Home,
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
  // Paused by the palm-up gesture, the menu button or taking the headset
  // off mid-puzzle: the clock, music and voice wait for Resume.
  paused: { type: Types.Boolean, default: false },
  // What a visual puzzle asks you to do with your pick (see src/moves.ts).
  move: { type: Types.Enum, enum: Move, default: Move.Drop },
  // Where the tour is, while mode is tour.
  tourStep: { type: Types.Enum, enum: TourStep, default: TourStep.Grab },
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
