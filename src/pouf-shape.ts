// RUSH's pouf: the round cushioned seat she sits on at home (built in code
// by src/scene-assets/pouf.scene-asset.ts). Its shape lives here, apart
// from the model, so Node's test runner can check her sit against it.
//
// No runtime imports.

/** Size in metres: 44 cm across at its widest, 24 cm tall in the middle. */
export const POUF = { radius: 0.22, height: 0.24 } as const;

/**
 * The pouf's side seen in section, from the middle of its base out and up
 * over the top to the middle of the top, as [share of radius, share of
 * height]: a narrow foot, a full rounded side and a softly domed cushion.
 */
export const POUF_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.7, 0],
  [0.8, 0.04],
  [0.9, 0.18],
  [0.97, 0.36],
  [1, 0.52],
  [0.98, 0.68],
  [0.93, 0.82],
  [0.84, 0.92],
  [0.68, 0.975],
  [0.45, 0.995],
  [0, 1],
];
