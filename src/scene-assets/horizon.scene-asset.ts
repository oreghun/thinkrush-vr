import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';

/**
 * The view out of the room's windows: two ridges of low hills on the
 * horizon, the far one paler, and acacia and baobab silhouettes against the
 * evening sky. Origin at the floor under the seat. One unlit mesh with a
 * colour per vertex, so it costs a single cheap draw call; it is far enough
 * (35-46 m) to sit still against the sky as the head moves.
 *
 * Angles go round from +z toward +x: the right-hand window looks out at
 * about 85-118 degrees, the left-hand one at -85 to -118, so each window
 * frames a few trees.
 */

const DEG = Math.PI / 180;
const NEAR_RADIUS = 38;
const FAR_RADIUS = 46;
const SEGMENTS = 192;
const COLORS = {
  farTop: '#2B3658',
  farBase: '#222B49',
  nearTop: '#1B2142',
  nearBase: '#141935',
  tree: '#10142A',
};

/** Hill heights (metres) round the horizon. */
function nearHeight(a: number): number {
  return Math.max(
    0.25,
    1 + 1.1 * Math.sin(3 * a + 0.7) + 0.7 * Math.sin(7 * a + 2.1) +
      0.35 * Math.sin(13 * a + 0.4) + 0.2 * Math.sin(29 * a + 1),
  );
}
function farHeight(a: number): number {
  return 3.2 + 1.6 * Math.sin(2 * a + 1.3) + 1.1 * Math.sin(5 * a + 0.2) +
    0.5 * Math.sin(11 * a + 2);
}

// [angle in degrees, kind, height in metres, distance]
const TREES: ReadonlyArray<readonly [number, 'acacia' | 'baobab', number, number]> = [
  [88, 'acacia', 5.0, 36.5],
  [101, 'baobab', 4.4, 35.5],
  [115, 'acacia', 4.0, 37],
  [-91, 'baobab', 4.6, 36],
  [-104, 'acacia', 5.4, 35],
  [-117, 'acacia', 3.8, 37.5],
];

class Builder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  private readonly color = new Color();

  triangle(points: number[][], hex: string | string[]): void {
    points.forEach((p, i) => {
      this.color.set(Array.isArray(hex) ? hex[i] : hex);
      this.positions.push(p[0], p[1], p[2]);
      this.colors.push(this.color.r, this.color.g, this.color.b);
    });
  }
}

/** A point at angle `a`, `radius` from the centre, `along` sideways and `up` high. */
function at(a: number, radius: number, along: number, up: number): number[] {
  return [
    radius * Math.sin(a) + along * Math.cos(a),
    up,
    radius * Math.cos(a) - along * Math.sin(a),
  ];
}

function ridge(b: Builder, radius: number, height: (a: number) => number, top: string, base: string): void {
  for (let i = 0; i < SEGMENTS; i += 1) {
    const a0 = (i / SEGMENTS) * 2 * Math.PI;
    const a1 = ((i + 1) / SEGMENTS) * 2 * Math.PI;
    const p = [at(a0, radius, 0, -2), at(a1, radius, 0, -2), at(a1, radius, 0, height(a1)), at(a0, radius, 0, height(a0))];
    b.triangle([p[0], p[1], p[2]], [base, base, top]);
    b.triangle([p[0], p[2], p[3]], [base, top, top]);
  }
}

/** A tree in its own flat frame (x sideways, y up, metres), as triangles. */
function treeShape(kind: 'acacia' | 'baobab', s: number): number[][][] {
  const tris: number[][][] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    tris.push([a, b, c], [a, c, d]);
  };
  // An ellipse-ish blob: a fan of `n` triangles.
  const blob = (cx: number, cy: number, rx: number, ryUp: number, ryDown: number, n = 12) => {
    for (let i = 0; i < n; i += 1) {
      const t0 = (i / n) * 2 * Math.PI;
      const t1 = ((i + 1) / n) * 2 * Math.PI;
      const y = (t: number) => cy + Math.sin(t) * (Math.sin(t) > 0 ? ryUp : ryDown);
      tris.push([[cx, cy], [cx + Math.cos(t0) * rx, y(t0)], [cx + Math.cos(t1) * rx, y(t1)]]);
    }
  };
  // A limb from (x0, y0) to (x1, y1), `w0` wide at the base and `w1` at the tip.
  const limb = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const nx = -dy / length;
    const ny = dx / length;
    quad(
      [x0 + (nx * w0) / 2, y0 + (ny * w0) / 2],
      [x0 - (nx * w0) / 2, y0 - (ny * w0) / 2],
      [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2],
      [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2],
    );
  };
  if (kind === 'acacia') {
    // A slim trunk forking into a wide, flat umbrella of a crown.
    limb(0, -0.4, 0.03 * s, 0.5 * s, 0.07 * s, 0.05 * s);
    limb(0.03 * s, 0.5 * s, -0.3 * s, 0.78 * s, 0.04 * s, 0.025 * s);
    limb(0.03 * s, 0.5 * s, 0.34 * s, 0.8 * s, 0.04 * s, 0.025 * s);
    blob(0.02 * s, 0.84 * s, 0.62 * s, 0.13 * s, 0.05 * s, 16);
  } else {
    // A fat trunk with short stubby branches and small tufts.
    quad([-0.24 * s, -0.4], [0.24 * s, -0.4], [0.17 * s, 0.62 * s], [-0.17 * s, 0.62 * s]);
    for (const [angle, length] of [[150, 0.3], [118, 0.26], [90, 0.22], [62, 0.27], [32, 0.3]]) {
      const x1 = Math.cos(angle * DEG) * length * s;
      const y1 = 0.6 * s + Math.sin(angle * DEG) * length * s;
      limb(0, 0.58 * s, x1, y1, 0.07 * s, 0.03 * s);
      blob(x1, y1 + 0.02 * s, 0.07 * s, 0.05 * s, 0.03 * s, 8);
    }
  }
  return tris.map((tri) => tri.map(([x, y]) => [x, y]));
}

export function createHorizon(): Group {
  const b = new Builder();
  ridge(b, FAR_RADIUS, farHeight, COLORS.farTop, COLORS.farBase);
  ridge(b, NEAR_RADIUS, nearHeight, COLORS.nearTop, COLORS.nearBase);
  for (const [degrees, kind, height, radius] of TREES) {
    const a = degrees * DEG;
    for (const tri of treeShape(kind, height)) {
      b.triangle(tri.map(([x, y]) => at(a, radius, x, y)), COLORS.tree);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(b.positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(b.colors, 3));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false }),
  );
  mesh.name = 'Horizon/Silhouettes';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const root = new Group();
  root.name = 'Horizon';
  root.add(mesh);
  return root;
}
