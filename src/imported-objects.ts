import type { TileModel } from './tile-models.js';

// Miniatures the owner generated (art/SOURCES.md) and scripts/optimize-model.mjs
// prepared in public/models/objects/. Any other miniature is built in code.
// No runtime imports, so Node's test runner can check the files exist.
export const IMPORTED_OBJECTS: readonly TileModel[] = [
  'kite',
  'sail',
  'parachute',
  'umbrella',
  'thermometer',
  'ruler',
  'scale',
  'telescope',
  'seed',
  'egg',
  'blueprint',
  'house',
  'piano',
  'keyboard',
  'typewriter',
  'keyring',
  'key',
  'padlock',
  'nail',
  'screw',
  'paper clip',
  'wooden block',
  'battery',
  'candle',
  'solar panel',
  'trumpet',
  'loudspeaker',
];

const slug = (model: TileModel) => model.replace(/ /gu, '-');

/** The manifest id of an imported miniature. */
export function objectAssetId(model: TileModel): string {
  return `object-${slug(model)}`;
}

/** Its file under public/. */
export function objectFile(model: TileModel): string {
  return `models/objects/${slug(model)}.glb`;
}
