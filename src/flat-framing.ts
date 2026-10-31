// The camera on a flat page (outside VR). A desktop window gets the view set
// in iwsdk.config.json. A tall window, such as a phone held upright, would
// see only a thin slice of it, cutting off the screen and the choices; so
// the narrower the window, the further the camera steps back and up, and
// the view opens just enough to keep everything that matters in frame.
//
// No runtime imports, so Node's test runner can use it. VR never uses it:
// there the headset is the camera.

export type Vec3 = readonly [number, number, number];

export interface Framing {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
}

/** The desktop view: the same as world.render in iwsdk.config.json. */
export const DESKTOP_FRAMING: Framing = {
  position: [0, 1.3, 0.35],
  target: [0, 0.95, -0.6],
  fov: 70,
};

/** Windows at least this wide for their height keep the desktop view. */
export const WIDE_ASPECT = 1.25;
/** At this shape and narrower (a tall phone) the camera is fully stepped back. */
const TALL_ASPECT = 0.5;
const TALL_POSE = { position: [0, 1.45, 1.1] as Vec3, target: [0, 0.95, -0.7] as Vec3 };
const MAX_FOV = 100;
// Degrees of room kept around what must be seen.
const MARGIN = 3;

/**
 * What must stay in frame: the screen at its Far stop (about 1 m wide, its
 * tall home page included), RUSH, the answer orbs, the four tiles on their
 * stands and the tray or board in front of them.
 */
export const MUST_SEE: readonly Vec3[] = [
  [-0.5, 0.6, -1.4],
  [0.5, 0.6, -1.4],
  [-0.5, 1.62, -1.4],
  [0.5, 1.62, -1.4],
  [0.51, 0.98, -0.75],
  [0.51, 1.07, -0.75],
  [-0.36, 0.72, -0.5],
  [0.36, 0.72, -0.5],
  [-0.36, 0.84, -0.5],
  [0.36, 0.84, -0.5],
  [-0.38, 0.96, -0.44],
  [0.38, 0.96, -0.44],
  [-0.13, 0.68, -0.18],
  [0.13, 0.68, -0.18],
];

const DEG = Math.PI / 180;

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function normalize(v: number[]): number[] {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Where `point` appears from a camera at `position` looking at `target`:
 * its angles right of and above the view's centre line, in radians.
 */
export function viewAngles(position: Vec3, target: Vec3, point: Vec3): [number, number] {
  const forward = normalize([target[0] - position[0], target[1] - position[1], target[2] - position[2]]);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = [point[0] - position[0], point[1] - position[1], point[2] - position[2]];
  const depth = dot(d, forward);
  return [Math.atan2(dot(d, right), depth), Math.atan2(dot(d, up), depth)];
}

/** The flat-page camera for a window `aspect` (width / height) wide. */
export function framingFor(aspect: number): Framing {
  if (!(aspect > 0) || aspect >= WIDE_ASPECT) {
    return DESKTOP_FRAMING;
  }
  const t = Math.min(1, (WIDE_ASPECT - aspect) / (WIDE_ASPECT - TALL_ASPECT));
  const position = lerp3(DESKTOP_FRAMING.position, TALL_POSE.position, t);
  const target = lerp3(DESKTOP_FRAMING.target, TALL_POSE.target, t);
  let across = 0;
  let upDown = 0;
  for (const point of MUST_SEE) {
    const [h, v] = viewAngles(position, target, point);
    across = Math.max(across, Math.abs(h));
    upDown = Math.max(upDown, Math.abs(v));
  }
  across += MARGIN * DEG;
  upDown += MARGIN * DEG;
  // The vertical view that fits both ways, given how narrow the window is.
  const needed = Math.max(2 * upDown, 2 * Math.atan(Math.tan(across) / aspect)) / DEG;
  // Ease from the desktop view so resizing never jumps.
  const eased = DESKTOP_FRAMING.fov + (needed - DESKTOP_FRAMING.fov) * t;
  return { position, target, fov: Math.min(MAX_FOV, Math.max(needed, eased)) };
}
