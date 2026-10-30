// Which code-built miniature a visual tile shows. Kept free of runtime
// imports so Node's test runner can check the puzzle bank against it.

/**
 * Tile labels that get a miniature, matched by the text they contain. The
 * first match wins, so "keyboard" and "keyring" come before "key". Labels
 * with no match (a password, a shadow, a tyre track) show as a word on the
 * tile: abstract things read better as words than as vague shapes.
 */
const MODELS = [
  'seed',
  'egg',
  'house',
  'keyboard',
  'keyring',
  'key',
  'padlock',
  'umbrella',
  'piano',
  'typewriter',
  'paper clip',
  'nail',
  'screw',
  'megaphone',
  'trumpet',
  'loudspeaker',
  'thermometer',
  'ruler',
  'telescope',
  'scale',
  'blueprint',
  'kite',
  'sail',
  'parachute',
  'envelope',
  'bottle',
  'usb',
  'solar panel',
  'battery',
  'candle',
  'frying pan',
  'wooden block',
] as const;

export type TileModel = (typeof MODELS)[number];

/** The miniature for `label`, or undefined when the tile shows the word. */
export function tileModelFor(label: string): TileModel | undefined {
  const lower = label.toLowerCase();
  return MODELS.find((model) => lower.includes(model));
}
