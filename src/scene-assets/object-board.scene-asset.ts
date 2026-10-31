import {
  createSceneMaterial,
  createScenePrimitiveObject,
  Group,
} from '@iwsdk/core';

/**
 * The object board: a small wooden lectern on the table, where the tray
 * sits for other puzzles, holding the figure of an object puzzle (see
 * src/object-puzzle.ts). Its square plate leans 26 degrees toward the
 * player, low enough not to hide the tiles behind it. Origin at the centre
 * of its footprint on the table top, +Z toward the player.
 *
 * The group BED_NAME sits on the plate's face: its local x runs right, y up
 * the slope and z out of the face. src/object-play.ts builds the figure, its
 * gap and the snapping piece in that frame at runtime.
 */

export const BED_NAME = 'ObjectBoard/Bed';
/** The bed's usable square: a figure of 10 x 10 blocks of 2.1 cm fits. */
export const BED_SIZE = 0.23;
const PLATE_SIZE = 0.25;
const PLATE_THICK = 0.012;
// The same lean as the pattern board's plate.
const TILT = 0.45;

const frameWood = createSceneMaterial({
  id: 'object-board-wood',
  model: 'standard',
  baseColor: '#5A3A22',
  roughness: 0.7,
});
const feltBed = createSceneMaterial({
  id: 'object-board-bed',
  model: 'standard',
  baseColor: '#1A1F3A',
  roughness: 0.95,
});

export function createObjectBoard(): Group {
  const root = new Group();
  root.name = 'ObjectBoard';

  // The plate hinges on its near edge; the footprint is centred on the origin.
  const span = Math.cos(TILT) * PLATE_SIZE;
  const plate = new Group();
  plate.name = 'ObjectBoard/Plate';
  plate.position.z = span / 2;
  plate.rotation.x = TILT;
  root.add(plate);

  const slab = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [PLATE_SIZE, PLATE_THICK, PLATE_SIZE],
        radius: 0.004,
        segments: 2,
      },
    },
    frameWood,
  );
  slab.name = 'ObjectBoard/Slab';
  slab.position.set(0, PLATE_THICK / 2, -PLATE_SIZE / 2);
  plate.add(slab);

  const felt = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [BED_SIZE, 0.002, BED_SIZE] } },
    feltBed,
  );
  felt.name = 'ObjectBoard/Felt';
  felt.position.set(0, PLATE_THICK + 0.001, -PLATE_SIZE / 2);
  plate.add(felt);

  // The frame for runtime content: x right, y up the slope, z out of the face.
  const bed = new Group();
  bed.name = BED_NAME;
  bed.position.set(0, PLATE_THICK + 0.002, -PLATE_SIZE / 2);
  bed.rotation.x = -Math.PI / 2;
  plate.add(bed);

  // A block under the raised far edge, so the plate rests on something.
  const rise = Math.sin(TILT) * PLATE_SIZE;
  const prop = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [PLATE_SIZE - 0.06, rise, 0.016] } },
    frameWood,
  );
  prop.name = 'ObjectBoard/Prop';
  prop.position.set(0, rise / 2, -span / 2 + 0.012);
  root.add(prop);
  return root;
}
