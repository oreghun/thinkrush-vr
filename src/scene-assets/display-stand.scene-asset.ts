import {
  Box3,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Shape,
  Vector3,
} from '@iwsdk/core';

/**
 * The display stand every visual-puzzle choice sits on: a low two-tier
 * wooden plinth, the same for all four, so the choices read as four equal
 * cards whatever the object on top. Word cards stand set into it.
 *
 * Origin: bottom centre, resting on the table; +Z faces the player.
 * Envelope: 0.156 m wide, 0.116 m deep, STAND_HEIGHT tall. To swap in an
 * imported glTF later, keep that origin and envelope.
 */
export const STAND_HEIGHT = 0.022;

const BASE = { width: 0.156, depth: 0.116, height: 0.012, radius: 0.012 };
const TOP = { width: 0.142, depth: 0.102, height: 0.01, radius: 0.01 };
const BEVEL = 0.002;

const baseWood = new MeshStandardMaterial({
  color: '#7A5235',
  roughness: 0.72,
});
const topWood = new MeshStandardMaterial({ color: '#B8875A', roughness: 0.66 });

/** A rounded-corner slab with softened edges, bottom face at y = 0. */
function roundedSlab(
  width: number,
  depth: number,
  height: number,
  radius: number,
): ExtrudeGeometry {
  const x = width / 2 - BEVEL;
  const z = depth / 2 - BEVEL;
  const r = radius - BEVEL;
  const outline = new Shape();
  outline.moveTo(-x + r, -z);
  outline.lineTo(x - r, -z);
  outline.quadraticCurveTo(x, -z, x, -z + r);
  outline.lineTo(x, z - r);
  outline.quadraticCurveTo(x, z, x - r, z);
  outline.lineTo(-x + r, z);
  outline.quadraticCurveTo(-x, z, -x, z - r);
  outline.lineTo(-x, -z + r);
  outline.quadraticCurveTo(-x, -z, -x + r, -z);
  const geometry = new ExtrudeGeometry(outline, {
    depth: height - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Extruded along +Z; stand it up so the slab rises along +Y from y = 0.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, BEVEL, 0);
  return geometry;
}

const baseGeometry = roundedSlab(
  BASE.width,
  BASE.depth,
  BASE.height,
  BASE.radius,
);
const topGeometry = roundedSlab(TOP.width, TOP.depth, TOP.height, TOP.radius);

/** A stand placed under a choice, and the height its objects rest at. */
export interface DisplayStand {
  object: Object3D;
  seatHeight: number;
}

// The imported stand (public/models/display-stand.glb, see art/SOURCES.md)
// has a recessed tray top: its floor is at 92% of the model's height.
const IMPORTED_SEAT_FRACTION = 0.92;

/**
 * Fits the imported stand model to the code-built stand's width, bottom
 * centre at the origin, keeping its own proportions.
 */
export function fitImportedStand(model: Object3D): DisplayStand {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const scale = BASE.width / size.x;
  const center = bounds.getCenter(new Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(
    -center.x * scale,
    -bounds.min.y * scale,
    -center.z * scale,
  );
  const stand = new Group();
  stand.name = 'DisplayStand';
  stand.add(model);
  return { object: stand, seatHeight: size.y * scale * IMPORTED_SEAT_FRACTION };
}

/** The code-built stand, used when the imported one is unavailable. */
export function builtStand(): DisplayStand {
  return { object: createDisplayStand(), seatHeight: STAND_HEIGHT };
}

/** A new stand; its meshes share one geometry and material set. */
export function createDisplayStand(): Group {
  const stand = new Group();
  stand.name = 'DisplayStand';
  const base = new Mesh(baseGeometry, baseWood);
  base.name = 'Base';
  const top = new Mesh(topGeometry, topWood);
  top.name = 'Top';
  top.position.y = BASE.height;
  stand.add(base, top);
  return stand;
}
