const ARTICLES = new Set(['a', 'an', 'the']);

/**
 * Lower case, punctuation dropped, and the words "a", "an" and "the"
 * removed: "A Mirror." becomes "mirror".
 */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((word) => word !== '' && !ARTICLES.has(word))
    .join(' ');
}

/**
 * The first of the recognizer's alternatives that matches the answer or one
 * of the accepted answers (see CLAUDE.md), or undefined if none does.
 */
export function findSpokenMatch(
  heard: readonly string[],
  answer: string,
  accepted: readonly string[],
): string | undefined {
  const targets = new Set([answer, ...accepted].map(normalizeAnswer));
  return heard.find((alternative) => targets.has(normalizeAnswer(alternative)));
}
