// Where the right answer lands among the choices (tiles, orbs, pattern and
// object pieces). It must never be learnable: every round places it by a
// fresh, fair shuffle, independent of the round before, so no order of
// guessing ("first, then second...") beats chance.
//
// A rule such as "never the same place twice" would itself be a pattern:
// with three orbs it would lift a blind guess from 1 in 3 to 1 in 2. So
// there is no rule, only a uniform shuffle (Fisher-Yates).
//
// No runtime imports, so Node's test runner can use it.

/** A fair shuffle of a copy of `items`: every order equally likely. */
export function shuffled<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Puts `options` in a fresh fair order, in place, and returns where the
 * right one (at `answerIndex` before) is now. Boards dealt from a set seed
 * (the Daily Challenge) keep their pieces but not their places, so a replay
 * cannot be answered from memory of where things stood.
 */
export function reorder<T>(
  options: T[],
  answerIndex: number,
  random: () => number = Math.random,
): number {
  // Shuffle positions, not values, so equal-looking options can't confuse
  // where the answer went.
  const order = shuffled(
    options.map((_, i) => i),
    random,
  );
  const before = [...options];
  order.forEach((from, i) => {
    options[i] = before[from];
  });
  return order.indexOf(answerIndex);
}
