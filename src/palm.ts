// The palm-up pause gesture: turn either hand palm up, open, in front of
// you, and hold it there for a moment. Plain arithmetic on joint positions,
// so it does not depend on how a runtime orients its joint axes.
//
// No runtime imports, so Node's test runner can check it.

export interface Point {
  x: number;
  y: number;
  z: number;
}

/**
 * Which way the palm faces (a unit vector), from the wrist and the bases of
 * the index and little fingers. Mirror-image hands need the cross product
 * the other way round.
 */
export function palmNormal(
  wrist: Point,
  indexBase: Point,
  pinkyBase: Point,
  handedness: 'left' | 'right',
  out: Point = { x: 0, y: 0, z: 0 },
): Point {
  // Index-base and pinky-base directions from the wrist; written out in
  // scalars so the per-frame check allocates nothing.
  const sign = handedness === 'right' ? 1 : -1;
  const ax = indexBase.x - wrist.x;
  const ay = indexBase.y - wrist.y;
  const az = indexBase.z - wrist.z;
  const bx = pinkyBase.x - wrist.x;
  const by = pinkyBase.y - wrist.y;
  const bz = pinkyBase.z - wrist.z;
  const x = sign * (ay * bz - az * by);
  const y = sign * (az * bx - ax * bz);
  const z = sign * (ax * by - ay * bx);
  const length = Math.hypot(x, y, z) || 1;
  out.x = x / length;
  out.y = y / length;
  out.z = z / length;
  return out;
}

// The palm counts as up when it faces within about 40 degrees of straight
// up, and must turn well away (below about 70 degrees) before the gesture
// can fire again. Held this long, it fires.
export const UP = 0.75;
export const AWAY = 0.35;
export const HOLD_SECONDS = 0.8;
// Thumb and index tips closer than this are a pinch, not an open hand.
export const PINCH_DISTANCE = 0.035;
// The wrist must be raised to no more than this far below the eyes, so a
// hand resting palm up on the table or in the lap never pauses the game.
export const RAISED_BELOW_EYES = 0.42;

/**
 * Counts how long one hand has held an open palm up, and fires once per
 * gesture: after firing, the palm must turn away before it can fire again.
 */
export class PalmGesture {
  private held = 0;
  private armed = true;

  /**
   * `upness` is how much the palm faces up (its normal's y, -1 to 1);
   * `ready` is false while the hand pinches, holds a piece, or is lowered.
   * Returns true on the frame the gesture completes.
   */
  update(delta: number, upness: number, ready: boolean): boolean {
    if (!this.armed) {
      if (upness < AWAY) {
        this.armed = true;
      }
      this.held = 0;
      return false;
    }
    if (upness >= UP && ready) {
      this.held += delta;
      if (this.held >= HOLD_SECONDS) {
        this.held = 0;
        this.armed = false;
        return true;
      }
    } else {
      this.held = 0;
    }
    return false;
  }

  /** Forget a half-made gesture (the hand left tracking). */
  reset(): void {
    this.held = 0;
  }
}
