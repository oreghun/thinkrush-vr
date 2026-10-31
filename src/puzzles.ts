import content from '../content/puzzles.json';
import type { PatternFamily, PatternRule } from './patterns.js';

/** One entry of content/puzzles.json; see CLAUDE.md for what each field means. */
export interface Puzzle {
  id: string;
  lang: 'en' | 'sw';
  type: 'visual' | 'riddle' | 'proverb' | 'mafumbo' | 'pattern';
  prompt: string;
  question?: string;
  answer: string;
  accepted: string[];
  options: string[];
  tiles?: string[];
  // Pattern puzzles only: the look and the logic of the generated board.
  family?: PatternFamily;
  rule?: PatternRule;
  answer_mode: 'grab' | 'voice+orbs' | 'orbs';
  hint: string;
  explanation: string;
  subtitle_en: string | null;
  difficulty: number;
  status: 'draft' | 'tested';
}

// scripts/validate-content.mjs checks this shape before every build.
export const PUZZLES = content.puzzles as Puzzle[];
