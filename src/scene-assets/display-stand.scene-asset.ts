import {
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
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
