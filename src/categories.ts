import type { Puzzle } from './puzzles.js';

// Declared here, in a module with no runtime imports, so both the ECS
// component schema and Node's test runner can use it.
export const PuzzleCategory = {
  All: 'all',
  Visual: 'visual',
  Riddle: 'riddle',
  Proverb: 'proverb',
  Mafumbo: 'mafumbo',
} as const;

export type Category = (typeof PuzzleCategory)[keyof typeof PuzzleCategory];

/** The cycle order of the category button. */
const CYCLE: Category[] = [
  PuzzleCategory.All,
  PuzzleCategory.Visual,
  PuzzleCategory.Riddle,
  PuzzleCategory.Proverb,
  PuzzleCategory.Mafumbo,
];

/** The bank indices that belong to `category`, in bank order. */
export function categoryIndices(
  puzzles: readonly Puzzle[],
  category: Category,
): number[] {
  const indices: number[] = [];
  puzzles.forEach((puzzle, index) => {
    if (category === PuzzleCategory.All || puzzle.type === category) {
      indices.push(index);
    }
  });
  return indices;
}

/**
 * The category after `current` on the button's cycle. Categories without
 * any content are skipped, so Proverbs stays hidden until methali arrive;
 * All always exists.
 */
export function nextCategory(
  puzzles: readonly Puzzle[],
  current: Category,
): Category {
  const start = CYCLE.indexOf(current);
  for (let step = 1; step <= CYCLE.length; step += 1) {
    const candidate = CYCLE[(start + step) % CYCLE.length];
    if (categoryIndices(puzzles, candidate).length > 0) {
      return candidate;
    }
  }
  return PuzzleCategory.All;
}

/**
 * The first bank index of `category` after `currentIndex`, wrapping, so
 * Next walks the category in bank order. Works whether or not
 * `currentIndex` itself belongs to the category.
 */
export function nextIndexInCategory(
  puzzles: readonly Puzzle[],
  category: Category,
  currentIndex: number,
): number {
  const indices = categoryIndices(puzzles, category);
  if (indices.length === 0) {
    return currentIndex;
  }
  return indices.find((index) => index > currentIndex) ?? indices[0];
}
