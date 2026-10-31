import {
  BufferGeometry,
  Color,
  createSceneMaterial,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from '@iwsdk/core';

/**
 * The room around the studio: clay walls, a beamed ceiling, two windows
 * that show the sky and the horizon outside, and a closed plank door behind
 * the seat. Origin at the floor under
 * the seat, +Z toward the player's back, inner faces at x = +-ROOM_HALF_WIDTH,
 * z = ROOM_BACK and z = ROOM_FRONT, ceiling at ROOM_HEIGHT. The floor is
 * the studio floor; the furniture corners stand against the back walls.
 *
 * Built from boxes merged per material, so the whole room is six draw
 * calls (eight with the door). It casts no shadows: the key light shines
 * through the ceiling.
 * The band's accent triangles (BAND_ACCENT_NAME) take each world's colour
 * at runtime, like the stage.
 */

export const ROOM_HALF_WIDTH = 4.9;
export const ROOM_BACK = -5.4;
export const ROOM_FRONT = 3.5;
export const ROOM_HEIGHT = 3.4;
export const BAND_ACCENT_NAME = 'Room/BandAccent';
const WALL = 0.2;
const DADO_TOP = 0.95;
const BAND_TOP = 1.08;
// Side windows: their openings along z and from sill to head.
const WINDOW_Z: readonly [number, number] = [-2.6, 0.4];
const WINDOW_Y: readonly [number, number] = [1.15, 2.55];
// The doorway behind the seat, closed by a plank door whose room-side face
// stands DOOR_SET into the opening.
const DOOR_HALF_WIDTH = 0.8;
const DOOR_TOP = 2.4;
const DOOR_SET = 0.02;
const BEAMS_Z = [-4.4, -2.6, -0.8, 1.0, 2.6];

const plaster = createSceneMaterial({
  id: 'room-plaster',
  model: 'standard',
  baseColor: '#C9935E',
  roughness: 0.95,
});
const dado = createSceneMaterial({
  id: 'room-dado',
  model: 'standard',
  baseColor: '#6E4A32',
  roughness: 0.9,
});
const ceiling = createSceneMaterial({
  id: 'room-ceiling',
  model: 'standard',
  baseColor: '#D7B98F',
  roughness: 0.95,
});
const wood = createSceneMaterial({
  id: 'room-wood',
  model: 'standard',
  baseColor: '#4A2C17',
  roughness: 0.75,
});
const doorWood = createSceneMaterial({
  id: 'room-door',
  model: 'standard',
  // Lighter than the frames: the back wall gets no direct light.
  baseColor: '#946038',
  roughness: 0.8,
});
const doorMetal = createSceneMaterial({
  id: 'room-door-metal',
  model: 'standard',
  baseColor: '#9C7A45',
  roughness: 0.35,
  metalness: 0.7,
});
const accent = createSceneMaterial({
  id: 'room-band-accent',
  model: 'standard',
  baseColor: '#D9A440',
  roughness: 0.8,
});

/** An axis-aligned box from its min and max corners. */
type Box = readonly [number, number, number, number, number, number];

// Unit-cube faces, counter-clockwise from outside: normal, then corners.
const FACES: ReadonlyArray<readonly [number[], number[][]]> = [
  [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
  [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
  [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
];

/** One geometry holding every box. */
function boxesGeometry(boxes: readonly Box[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    for (const [normal, corners] of FACES) {
      const quad = corners.map(([cx, cy, cz]) => [
        x0 + cx * (x1 - x0),
        y0 + cy * (y1 - y0),
        z0 + cz * (z1 - z0),
      ]);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        positions.push(...quad[i]);
        normals.push(...normal);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A stretch of inner wall: where u = 0 is, which way u runs, and its range. */
interface WallRun {
  origin: Vector3;
  along: Vector3;
  from: number;
  to: number;
}

const UP = new Vector3(0, 1, 0);

function wallRuns(): WallRun[] {
  const run = (origin: Vector3, along: Vector3, from: number, to: number) => ({
    origin,
    along,
    from,
    to,
  });
  return [
    run(new Vector3(0, 0, ROOM_BACK), new Vector3(1, 0, 0), -ROOM_HALF_WIDTH, ROOM_HALF_WIDTH),
    run(new Vector3(-ROOM_HALF_WIDTH, 0, 0), new Vector3(0, 0, -1), -ROOM_FRONT, -ROOM_BACK),
    run(new Vector3(ROOM_HALF_WIDTH, 0, 0), new Vector3(0, 0, 1), ROOM_BACK, ROOM_FRONT),
    run(new Vector3(0, 0, ROOM_FRONT), new Vector3(-1, 0, 0), -ROOM_HALF_WIDTH, -DOOR_HALF_WIDTH),
    run(new Vector3(0, 0, ROOM_FRONT), new Vector3(-1, 0, 0), DOOR_HALF_WIDTH, ROOM_HALF_WIDTH),
    // Across the door's planks, so the band runs right round the room.
    run(
      new Vector3(0, 0, ROOM_FRONT + DOOR_SET),
      new Vector3(-1, 0, 0),
      -DOOR_HALF_WIDTH,
      DOOR_HALF_WIDTH,
    ),
  ];
}

/**
 * The band above the dado on every inner wall: a cream strip edged in dark
 * lines (vertex colours) and a row of accent triangles (a separate mesh, so
 * its one colour can follow the world). Faces point into the room.
 */
function bandGeometries(): { band: BufferGeometry; accent: BufferGeometry } {
  const band: number[][] = [[], [], []];
  const tips: number[][] = [[], []];
  const cream = new Color('#EFE2C6');
  const dark = new Color('#3A2416');
  const width = 0.26;
  const edge = 0.012;
  for (const { origin, along, from, to } of wallRuns()) {
    const normal = new Vector3().crossVectors(along, UP);
    const at = (u: number, v: number, off: number) =>
      origin.clone().addScaledVector(along, u).addScaledVector(UP, v).addScaledVector(normal, off);
    const quad = (u0: number, u1: number, v0: number, v1: number, off: number, color: Color) => {
      const corners = [at(u0, v0, off), at(u1, v0, off), at(u1, v1, off), at(u0, v1, off)];
      for (const i of [0, 1, 2, 0, 2, 3]) {
        band[0].push(corners[i].x, corners[i].y, corners[i].z);
        band[1].push(normal.x, normal.y, normal.z);
        band[2].push(color.r, color.g, color.b);
      }
    };
    quad(from, to, DADO_TOP, BAND_TOP, 0.003, cream);
    quad(from, to, DADO_TOP, DADO_TOP + edge, 0.005, dark);
    quad(from, to, BAND_TOP - edge, BAND_TOP, 0.005, dark);
    const count = Math.floor((to - from) / width);
    const start = from + (to - from - count * width) / 2;
    const low = DADO_TOP + edge + 0.008;
    const high = BAND_TOP - edge - 0.008;
    for (let i = 0; i < count; i += 1) {
      const a = start + i * width;
      for (const p of [at(a, low, 0.006), at(a + width, low, 0.006), at(a + width / 2, high, 0.006)]) {
        tips[0].push(p.x, p.y, p.z);
        tips[1].push(normal.x, normal.y, normal.z);
      }
    }
  }
  const make = (position: number[], normal: number[], color?: number[]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
    if (color) geometry.setAttribute('color', new Float32BufferAttribute(color, 3));
    geometry.computeBoundingSphere();
    return geometry;
  };
  return { band: make(band[0], band[1], band[2]), accent: make(tips[0], tips[1]) };
}

export function createRoom(): Group {
  const W = ROOM_HALF_WIDTH;
  const outer = W + WALL;
  const back = ROOM_BACK;
  const front = ROOM_FRONT;
  const top = ROOM_HEIGHT;
  const [wz0, wz1] = WINDOW_Z;
  const [wy0, wy1] = WINDOW_Y;
  const door = DOOR_HALF_WIDTH;

  // Lower walls, dark clay, all round except the doorway.
  const dadoBoxes: Box[] = [
    [-outer, 0, back - WALL, outer, DADO_TOP, back],
    [-outer, 0, front, -door, DADO_TOP, front + WALL],
    [door, 0, front, outer, DADO_TOP, front + WALL],
  ];
  // Upper walls, plaster, around the window openings and over the door.
  const plasterBoxes: Box[] = [
    [-outer, DADO_TOP, back - WALL, outer, top, back],
    [-outer, DADO_TOP, front, -door, top, front + WALL],
    [door, DADO_TOP, front, outer, top, front + WALL],
    [-door, DOOR_TOP, front, door, top, front + WALL],
  ];
  for (const [x0, x1] of [
    [-outer, -W],
    [W, outer],
  ]) {
    dadoBoxes.push([x0, 0, back, x1, DADO_TOP, front]);
    plasterBoxes.push(
      [x0, DADO_TOP, back, x1, wy0, front],
      [x0, wy1, back, x1, top, front],
      [x0, wy0, back, x1, wy1, wz0],
      [x0, wy0, wz1, x1, wy1, front],
    );
  }

  // Wood: ceiling beams, window frames standing a little proud, door frame.
  const woodBoxes: Box[] = BEAMS_Z.map(
    (z) => [-W, top - 0.22, z - 0.08, W, top, z + 0.08] as const,
  );
  const frame = 0.08;
  for (const [x0, x1] of [
    [-outer, -W + 0.06],
    [W - 0.06, outer],
  ]) {
    woodBoxes.push(
      [x0, wy0 - 0.06, wz0 - frame, x1, wy0, wz1 + frame],
      [x0, wy1, wz0 - frame, x1, wy1 + 0.06, wz1 + frame],
      [x0, wy0, wz0 - frame, x1, wy1, wz0],
      [x0, wy0, wz1, x1, wy1, wz1 + frame],
    );
  }
  woodBoxes.push(
    [-door - frame, 0, front - 0.05, -door, DOOR_TOP, front + WALL],
    [door, 0, front - 0.05, door + frame, DOOR_TOP, front + WALL],
    [-door - frame, DOOR_TOP, front - 0.05, door + frame, DOOR_TOP + frame, front + WALL],
  );

  // The door: five planks with dark gaps over a backing, two rails on the
  // room side with a row of metal studs each, a ring handle and a keyhole.
  const face = front + DOOR_SET;
  const doorBoxes: Box[] = [];
  const metalBoxes: Box[] = [];
  const gap = 0.012;
  const plank = (2 * door - 4 * gap) / 5;
  for (let i = 0; i < 5; i += 1) {
    const x0 = -door + i * (plank + gap);
    doorBoxes.push([x0, 0.01, face, x0 + plank, DOOR_TOP - 0.01, face + 0.04]);
  }
  woodBoxes.push([-door, 0, face + 0.04, door, DOOR_TOP, face + 0.06]);
  for (const y of [0.42, 1.98]) {
    doorBoxes.push([-door + 0.02, y - 0.06, face - 0.02, door - 0.02, y + 0.06, face]);
    for (let k = 0; k < 6; k += 1) {
      const x = -door + 0.15 + k * ((2 * door - 0.3) / 5);
      metalBoxes.push([x - 0.015, y - 0.015, face - 0.032, x + 0.015, y + 0.015, face - 0.02]);
    }
  }
  // The handle on the door's right as you turn to face it (that is -x).
  const hx = -door + 0.25;
  metalBoxes.push(
    [hx - 0.015, 1.17, face - 0.03, hx + 0.015, 1.2, face],
    [hx - 0.015, 1.34, face - 0.03, hx + 0.015, 1.37, face],
    [hx - 0.015, 1.17, face - 0.045, hx + 0.015, 1.37, face - 0.03],
    [hx - 0.02, 1.0, face - 0.006, hx + 0.02, 1.09, face],
  );

  const { band, accent: tips } = bandGeometries();
  const parts: Array<[string, BufferGeometry, Material]> = [
    ['Room/Dado', boxesGeometry(dadoBoxes), dado],
    ['Room/Plaster', boxesGeometry(plasterBoxes), plaster],
    ['Room/Ceiling', boxesGeometry([[-outer, top, back - WALL, outer, top + 0.1, front + WALL]]), ceiling],
    ['Room/Wood', boxesGeometry(woodBoxes), wood],
    ['Room/Door', boxesGeometry(doorBoxes), doorWood],
    ['Room/DoorMetal', boxesGeometry(metalBoxes), doorMetal],
    ['Room/Band', band, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })],
    [BAND_ACCENT_NAME, tips, accent],
  ];
  const root = new Group();
  root.name = 'Room';
  for (const [name, geometry, material] of parts) {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
  }
  return root;
}
