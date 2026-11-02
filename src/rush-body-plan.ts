// RUSH with a body (the owner's rigged Meshy character): where she should
// be and which move she plays, worked out from the puzzle board. Her face,
// glow and voice stay those of the floating RUSH; this decides the body.
//
// No runtime imports, so Node's test runner can check it.

/** Measured from public/models/rush/rush-body.glb (1.1 m tall, faces +Z). */
export const BODY = {
  /** Centre and radius of her ball head, standing: the face goes there. */
  headCenterY: 0.949,
  headRadius: 0.154,
  /** Ground speed of the walk and run clips, so her feet do not slide. */
  walkSpeed: 0.69,
  runSpeed: 2.43,
  /**
   * Sitting down moves her hips 0.28 m back and 0.08 m to her right, and
   * leaves her underside 0.20-0.24 m off the floor (measured on the posed
   * model), below the stool's 0.36 m seat: she stands this far in front of
   * the stool and rises this much as she sits, her feet then dangling a
   * little above the floor (a small girl on a high stool).
   */
  sitBack: 0.28,
  sitSide: 0.08,
  sitLift: 0.145,
} as const;

/** The animation clip names in rush-body.glb, by what they are for. */
export const CLIP = {
  idle: 'Happy_Sway_Standing',
  calm: 'Idle_3',
  walk: 'Walking',
  run: 'Running',
  sitDown: 'Stand_to_Sit_Transition_M',
  sitting: 'Chair_Sit_Idle_F',
  wave: 'Big_Wave_Hello',
  talk: 'Talk_with_Hands_Open',
  cheer: 'Victory_Cheer',
  jump: 'Happy_jump_f',
  shrug: 'Shrug',
  dance: 'FunnyDancing_01',
  point: 'Checkout_Gesture',
  facepalm: 'Headache_Relief',
  sassy: 'Hand_on_Hip_Gesture',
} as const;
export type ClipKey = keyof typeof CLIP;

/**
 * Where she stands during a puzzle: beside the table on the right, just
 * behind it, facing the seat. Her head is then about 30 degrees right of
 * straight ahead and 12 below eye level: in view on Meta VR Glasses (37
 * each side) as well as Quest, since she is the clock.
 */
export const STAGE_SPOT = { x: 0.6, z: -1.0 };
/** For the SHOW move: beside the table's right edge, within a seated reach. */
export const SHOW_SPOT = { x: 0.72, z: -0.42 };

/** At home she strolls to the stool after this long. */
export const STOOL_AFTER_SECONDS = 6;
/** Farther than this from where she must be during a puzzle, she runs. */
export const RUN_FARTHER_THAN = 1.5;
/** With less than this share of the clock left she gets impatient. */
export const IMPATIENT_SHARE = 0.35;
/** A reaction plays this long at most, then blends back. */
export const REACTION_SECONDS = 2.6;

export type Place = 'stage' | 'show' | 'stool';

/** What the body planner reads from the board each frame. */
export interface BodyView {
  mode: string;
  phase: string;
  status: string;
  paused: boolean;
  /** RUSH is reading aloud or saying a line. */
  speaking: boolean;
  /** Share of the answer clock left, 0 to 1. */
  fraction: number;
  /** A picture puzzle in play that asks to SHOW the pick to RUSH. */
  showMove: boolean;
  /** Seconds since the home page came up (0 when not at home). */
  homeSeconds: number;
}

/** Where she should be. */
export function wantedPlace(view: BodyView): Place {
  if (view.mode === 'home') {
    return view.homeSeconds >= STOOL_AFTER_SECONDS ? 'stool' : 'stage';
  }
  const inPlay =
    (view.mode === 'practice' || view.mode === 'run') && view.status === 'playing';
  return inPlay && view.showMove ? 'show' : 'stage';
}

/** Whether she hurries: away from where a puzzle needs her, and far. */
export function shouldRun(place: Place, distance: number): boolean {
  return place !== 'stool' && distance > RUN_FARTHER_THAN;
}

/** The move she plays standing at her place when nothing else is going on. */
export function standingClip(view: BodyView): ClipKey {
  if (view.paused) return 'calm';
  if (view.speaking) return 'talk';
  if (view.mode === 'home' || view.mode === 'runOver') return 'idle';
  const answering = view.phase === 'answering' && view.status === 'playing';
  if (answering && view.mode !== 'tour') {
    return view.fraction < IMPATIENT_SHARE ? 'sassy' : 'calm';
  }
  return 'idle';
}

/** Something that happened, which she reacts to with a move. */
export type BodyEvent =
  | 'hello'
  | 'solved'
  | 'fastSolved'
  | 'wrongPick'
  | 'wrongMove'
  | 'timeUp'
  | 'runOver';

/** The board values events are spotted from. */
export interface EventView {
  mode: string;
  status: string;
  wrongAnswers: number;
  wrongMoves: number;
  /** Share of the clock left. */
  fraction: number;
}

/** A solve with this much of the clock left is a quick one. */
export const FAST_SHARE = 0.6;

/** The event between two looks at the board, if any (most telling first). */
export function bodyEvent(before: EventView, after: EventView): BodyEvent | undefined {
  if (after.status === 'solved' && before.status !== 'solved') {
    return after.mode !== 'tour' && after.fraction >= FAST_SHARE ? 'fastSolved' : 'solved';
  }
  if (after.wrongMoves > before.wrongMoves) return 'wrongMove';
  if (
    (after.status === 'wrongPick' && before.status !== 'wrongPick') ||
    after.wrongAnswers > before.wrongAnswers
  ) {
    return 'wrongPick';
  }
  if (after.status === 'timeUp' && before.status !== 'timeUp') return 'timeUp';
  if (after.mode === 'runOver' && before.mode !== 'runOver') return 'runOver';
  if (before.mode === 'home' && after.mode !== 'home') return 'hello';
  return undefined;
}

/** Her move for an event; `random` (0 to 1) varies the cheer. */
export function reactionClip(event: BodyEvent, random: number): ClipKey {
  switch (event) {
    case 'fastSolved':
    case 'runOver':
      return 'dance';
    case 'solved':
      return random < 0.5 ? 'cheer' : 'jump';
    case 'wrongPick':
      return 'point';
    case 'wrongMove':
      return 'facepalm';
    case 'timeUp':
      return 'shrug';
    default:
      return 'wave';
  }
}

// In the sit-down clip her hips drop between these shares of its length.
const DROP_START = 0.5;
const DROP_END = 0.75;

/**
 * How much of the sitting lift she has `progress` (0 to 1) through the
 * sit-down clip: none while she still stands, all once her hips have come
 * down, eased in between, so she rises onto the seat as she lowers onto it
 * (and the same backwards as she stands up).
 */
export function seatedShare(progress: number): number {
  const t = Math.min(1, Math.max(0, (progress - DROP_START) / (DROP_END - DROP_START)));
  return t * t * (3 - 2 * t);
}

export interface Spot {
  x: number;
  z: number;
}

/** The turn (about the vertical) that faces from `from` towards `to`. */
export function yawToward(from: Spot, to: Spot): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** `current` turned towards `target` by at most `step`, the short way round. */
export function turnToward(current: number, target: number, step: number): number {
  let difference = target - current;
  difference = Math.atan2(Math.sin(difference), Math.cos(difference));
  if (Math.abs(difference) <= step) return target;
  return current + Math.sign(difference) * step;
}

/**
 * Where she stands to sit on a stool at `stool`, facing towards `facing`,
 * and that facing: sitting down then lands her hips on the seat.
 */
export function sitSpot(stool: Spot, facing: Spot): { x: number; z: number; yaw: number } {
  const yaw = yawToward(stool, facing);
  const ahead = { x: Math.sin(yaw), z: Math.cos(yaw) };
  // Her right-hand side, when facing that way.
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  return {
    x: stool.x + ahead.x * BODY.sitBack - right.x * BODY.sitSide,
    z: stool.z + ahead.z * BODY.sitBack - right.z * BODY.sitSide,
    yaw,
  };
}
