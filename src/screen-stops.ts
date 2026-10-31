// Beckoning the screen: it rests at one of two stops. Far is where the
// scene puts it, about 1.4 m away and scaled up so its text looks the same
// size as at arm's length, which is easier on the eyes for reading. Near is
// within a seated arm's reach, so a fingertip can tap its buttons.
//
// Pinch the light bar and pull your hand toward you to bring the screen
// Near; push it away to send it Far. A quick pinch without moving switches
// stops. Letting go always glides the screen to a stop, so it never ends up
// in an awkward place. The screen moves, never the player's view.
//
// No runtime imports, so the ECS component schema and Node's test runner
// can both use it.

export const ScreenStop = {
  Far: 'far',
  Near: 'near',
} as const;

export type ScreenStopName = (typeof ScreenStop)[keyof typeof ScreenStop];

// A pull or push of this much (metres, the bar's change in distance from
// the head) picks a stop. Smaller moves are taps or nothing.
const PULL_METRES = 0.08;
// A pinch shorter than this, that moves the bar less than TAP_METRES, is a
// tap: it switches stops.
const TAP_SECONDS = 0.35;
const TAP_METRES = 0.03;

/**
 * The stop after letting go of the bar. `pulled` is how much closer to the
 * head the bar ended than it started (negative when pushed away).
 */
export function releaseStop(
  current: ScreenStopName,
  pulled: number,
  heldSeconds: number,
): ScreenStopName {
  if (pulled >= PULL_METRES) {
    return ScreenStop.Near;
  }
  if (pulled <= -PULL_METRES) {
    return ScreenStop.Far;
  }
  if (heldSeconds < TAP_SECONDS && Math.abs(pulled) < TAP_METRES) {
    return current === ScreenStop.Far ? ScreenStop.Near : ScreenStop.Far;
  }
  return current;
}

// Near: the screen's centre this far in front of and below the eyes, at
// this share of its Far size (1.1 m wide at Far becomes about 0.44 m).
// Its buttons, on its lower half, are then about 0.45 m from the shoulder.
export const NEAR_FORWARD = 0.42;
export const NEAR_BELOW_EYES = 0.18;
export const NEAR_SCALE_OF_FAR = 0.4;
// The bar never sinks into the table (its top is at 0.68 m), whatever the
// player's seated height: the screen rides higher instead.
export const NEAR_MIN_BAR_HEIGHT = 0.72;

/**
 * Where the bar goes for the Near stop, given the head position and the
 * bar's Far scale. `screenAbove` is the screen centre's height above the
 * bar at scale 1. The player sits facing -Z, so Near is straight ahead
 * along -Z: the screen keeps facing the seat, as it does at Far.
 */
export function nearBar(
  head: { x: number; y: number; z: number },
  farScale: number,
  screenAbove: number,
): { x: number; y: number; z: number; scale: number } {
  const scale = farScale * NEAR_SCALE_OF_FAR;
  return {
    x: head.x,
    y: Math.max(
      head.y - NEAR_BELOW_EYES - screenAbove * scale,
      NEAR_MIN_BAR_HEIGHT,
    ),
    z: head.z - NEAR_FORWARD,
    scale,
  };
}
