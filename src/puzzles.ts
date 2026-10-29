import content from '../content/puzzles.json';

/** One entry of content/puzzles.json; see CLAUDE.md for what each field means. */
export interface Puzzle {
  id: string;
  lang: 'en' | 'sw';
  type: 'visual' | 'riddle' | 'proverb' | 'mafumbo';
  prompt: string;
  question?: string;
  answer: string;
  accepted: string[];
  options: string[];
  tiles?: string[];
  answer_mode: 'grab' | 'voice+orbs' | 'orbs';
  hint: string;
  explanation: string;
  subtitle_en: string | null;
  difficulty: number;
  status: 'draft' | 'tested';
}

// scripts/validate-content.mjs checks this shape before every build.
export const PUZZLES = content.puzzles as Puzzle[];
