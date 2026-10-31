import {
  BoxGeometry,
  createSceneMaterial,
  createScenePrimitiveObject,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from '@iwsdk/core';

/**
 * The pattern board: a small wooden lectern on the table, where the tray
 * sits for other puzzles. A strip of six cloth pieces lies on it, tilted
 * toward the player; one cell is the gap, outlined in turquoise. Origin at
 * the centre of its footprint on the table top, +Z toward the player.
 * PuzzleSystem gives each cell its piece's texture and moves the outline.
 */

export const PATTERN_CELLS = 6;
const CELL = 0.058;
const CELL_STEP = 0.066;
const PLATE_WIDTH = 0.42;
const PLATE_DEPTH = 0.1;
const PLATE_THICK = 0.012;
// The plate leans 26 degrees toward the player, like a lectern.
const TILT = 0.45;

const frameWood = createSceneMaterial({
  id: 'pattern-board-wood',
  model: 'standard',
  baseColor: '#5A3A22',
  roughness: 0.7,
});
const clothBed = createSceneMaterial({
  id: 'pattern-board-bed',
  model: 'standard',
  baseColor: '#1A1F3A',
  roughness: 0.95,
});

/** The x of cell `index` along the strip. */
export function cellX(index: number): number {
  return (index - (PATTERN_CELLS - 1) / 2) * CELL_STEP;
}

export function cellName(index: number): string {
  return `PatternBoard/Cell${index}`;
}
export const GAP_NAME = 'PatternBoard/Gap';

export function createPatternBoard(): Group {
  const root = new Group();
  root.name = 'PatternBoard';

  // The plate hinges on its near edge; everything on it tilts with it.
  const plate = new Group();
  plate.name = 'PatternBoard/Plate';
  plate.position.z = PLATE_DEPTH / 2 - 0.005;
  plate.rotation.x = TILT;
  root.add(plate);

  const slab = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [PLATE_WIDTH, PLATE_THICK, PLATE_DEPTH],
        radius: 0.004,
        segments: 2,
      },
    },
    frameWood,
  );
  slab.position.set(0, PLATE_THICK / 2, -PLATE_DEPTH / 2);
  plate.add(slab);

  const bed = createScenePrimitiveObject(
    {
      geometry: {
        type: 'box',
        size: [PLATE_WIDTH - 0.02, 0.002, PLATE_DEPTH - 0.016],
      },
    },
    clothBed,
  );
  bed.position.set(0, PLATE_THICK + 0.001, -PLATE_DEPTH / 2);
  plate.add(bed);

  const cellGeometry = new PlaneGeometry(CELL, CELL);
  for (let i = 0; i < PATTERN_CELLS; i += 1) {
    const cell = new Mesh(
      cellGeometry,
      new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }),
    );
    cell.name = cellName(i);
    cell.rotation.x = -Math.PI / 2;
    cell.position.set(cellX(i), PLATE_THICK + 0.0025, -PLATE_DEPTH / 2);
    plate.add(cell);
  }

  // The gap's outline: four thin bars around a cell.
  const gap = new Group();
  gap.name = GAP_NAME;
  const glow = new MeshBasicMaterial({ color: '#62E3D6', toneMapped: false });
  const outer = CELL + 0.008;
  const bar = 0.003;
  const long = new BoxGeometry(outer, 0.002, bar);
  const short = new BoxGeometry(bar, 0.002, outer);
  for (const [geometry, x, z] of [
    [long, 0, -outer / 2],
    [long, 0, outer / 2],
    [short, -outer / 2, 0],
    [short, outer / 2, 0],
  ] as const) {
    const piece = new Mesh(geometry, glow);
    piece.position.set(x, 0, z);
    gap.add(piece);
  }
  gap.position.set(0, PLATE_THICK + 0.003, -PLATE_DEPTH / 2);
  plate.add(gap);

  // A block under the raised far edge, so the plate rests on something.
  const rise = Math.sin(TILT) * PLATE_DEPTH;
  const prop = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [PLATE_WIDTH - 0.06, rise, 0.014] } },
    frameWood,
  );
  prop.position.set(0, rise / 2, plate.position.z - Math.cos(TILT) * PLATE_DEPTH + 0.01);
  root.add(prop);
  return root;
}

/**
 * A pattern piece for a tile: a square of cloth on a thin wooden backing,
 * leaning back a little in the tile's display stand. Origin at its bottom
 * edge. Made at runtime (it carries the piece's texture); its geometry and
 * materials are freed with the tile's model, the texture by PieceTextures.
 */
export function createSwatch(texture: Texture): Group {
  const root = new Group();
  root.name = 'Swatch';
  root.userData.ownsMaterials = true;
  const lean = new Group();
  lean.rotation.x = -0.25;
  root.add(lean);
  const side = 0.078;
  const back = new Mesh(
    new BoxGeometry(side, side, 0.008),
    new MeshStandardMaterial({ color: '#6B4426', roughness: 0.7 }),
  );
  back.position.y = side / 2;
  lean.add(back);
  const cloth = new Mesh(
    new PlaneGeometry(side - 0.008, side - 0.008),
    new MeshStandardMaterial({ map: texture, roughness: 0.85 }),
  );
  cloth.position.set(0, side / 2, 0.0042);
  lean.add(cloth);
  return root;
}
