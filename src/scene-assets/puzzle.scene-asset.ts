import {
  createSceneMaterial,
  createScenePrimitiveObject,
  Group,
  Mesh,
  SphereGeometry,
} from '@iwsdk/core';

/**
 * The puzzle table set, built in code: a lap-height pedestal table, the tray
 * a tile is dropped on to answer, and the tiles themselves. Each is
 * registered in src/assets.ts and placed by the scene.
 */

// The table stands on the 3.5 cm stage, so its top ends up at 0.68 m: lap
// height for a seated player, like an airplane tray table.
const TABLE_HEIGHT = 0.645;

const woodMaterial = createSceneMaterial({
  id: 'puzzle-wood',
  model: 'standard',
  baseColor: '#A8774F',
  roughness: 0.7,
});

const clayMaterial = createSceneMaterial({
  id: 'puzzle-clay',
  model: 'standard',
  baseColor: '#EEE9E0',
  roughness: 0.9,
});

// Warm ochre marks where an answer goes.
const trayMaterial = createSceneMaterial({
  id: 'puzzle-tray',
  model: 'standard',
  baseColor: '#D9A440',
  roughness: 0.5,
});

const trayInsetMaterial = createSceneMaterial({
  id: 'puzzle-tray-inset',
  model: 'standard',
  baseColor: '#B9862C',
  roughness: 0.6,
});

// Dark, glossy graphite marks everything you can interact with.
const graphiteMaterial = createSceneMaterial({
  id: 'puzzle-graphite',
  model: 'physical',
  baseColor: '#464950',
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.15,
  envMapIntensity: 2.6,
  textures: {
    roughness: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 3,
      bands: [
        { frequency: [12, 12], amplitude: 0.6 },
        { frequency: [48, 48], amplitude: 0.4 },
      ],
      range: [0.26, 0.52],
    },
    bump: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 43,
      bands: [
        { frequency: [32, 32], amplitude: 0.6 },
        { frequency: [96, 96], amplitude: 0.4 },
      ],
      scale: 0.04,
      sampler: { repeat: [3, 3] },
    },
  },
});

/** Pedestal table with its origin at floor contact. */
export function createPuzzleTable(width = 0.84, depth = 0.44): Group {
  const pillar = createScenePrimitiveObject(
    {
      geometry: {
        type: 'lathe',
        profile: [
          [0.001, 0],
          [0.16, 0],
          [0.17, 0.018],
          [0.16, 0.04],
          [0.09, 0.085],
          [0.06, 0.25],
          [0.055, TABLE_HEIGHT - 0.1],
          [0.1, TABLE_HEIGHT - 0.04],
          [0.001, TABLE_HEIGHT - 0.035],
        ],
        segments: 48,
      },
    },
    clayMaterial,
  );
  const top = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [width, 0.035, depth],
        radius: 0.012,
        segments: 3,
      },
    },
    woodMaterial,
  );
  top.position.y = TABLE_HEIGHT - 0.0175;
  const table = new Group();
  table.add(pillar, top);
  return table;
}

/** Shallow ochre tray with its origin at the bottom center. */
export function createAnswerTray(width = 0.19, depth = 0.13): Group {
  const base = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [width, 0.012, depth],
        radius: 0.005,
        segments: 3,
      },
    },
    trayMaterial,
  );
  base.position.y = 0.006;
  const inset = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [width - 0.022, 0.004, depth - 0.022],
        radius: 0.002,
        segments: 2,
      },
    },
    trayInsetMaterial,
  );
  inset.position.y = 0.0122;
  const tray = new Group();
  tray.add(base, inset);
  return tray;
}

/** Upright graphite tile, origin at its center; its label faces +Z. */
export function createPuzzleTile(): Mesh {
  return createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [0.15, 0.09, 0.035],
        radius: 0.008,
        segments: 4,
      },
    },
    graphiteMaterial,
  );
}

/** Floating answer orb, origin at its center; its label floats in front. */
export function createAnswerOrb(radius = 0.055): Mesh {
  return new Mesh(new SphereGeometry(radius, 32, 24), graphiteMaterial);
}
