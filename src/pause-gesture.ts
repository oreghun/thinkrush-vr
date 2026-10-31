import {
  createSystem,
  type Entity,
  Grabbed,
  InputComponent,
  type Matrix4,
  Vector3,
  VisibilityState,
  type XRHandVisualAdapter,
} from '@iwsdk/core';
import {
  PalmGesture,
  palmNormal,
  PINCH_DISTANCE,
  type Point,
  RAISED_BELOW_EYES,
} from './palm.js';
import { PuzzleBoard, PuzzleMode, PuzzleTile } from './puzzle-components.js';

// XRHand joint order: the wrist, the thumb's four joints (its tip is 4),
// then five per finger from the base out.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_BASE = 5;
const INDEX_TIP = 9;
const PINKY_BASE = 20;
const JOINTS = 25;
// Letting go of a flipped piece leaves the palm up for a moment: that is
// not a pause.
const AFTER_HOLDING = 1;

const HANDS = ['left', 'right'] as const;

/**
 * Pauses and resumes a puzzle: an open palm turned up and held (src/palm.ts),
 * or the controller's menu button. It only flips PuzzleBoard.paused;
 * PuzzleSystem shows the pause page and stops the clock and voice, and the
 * sound and RUSH follow the same field.
 */
export class PauseGestureSystem extends createSystem({
  boards: { required: [PuzzleBoard] },
  held: { required: [PuzzleTile, Grabbed] },
}) {
  private readonly gestures = { left: new PalmGesture(), right: new PalmGesture() };
  private readonly joint = new Vector3();
  private readonly head = new Vector3();
  private readonly wrist: Point = { x: 0, y: 0, z: 0 };
  private readonly indexBase: Point = { x: 0, y: 0, z: 0 };
  private readonly pinkyBase: Point = { x: 0, y: 0, z: 0 };
  private readonly normal: Point = { x: 0, y: 0, z: 0 };
  private sinceHolding = AFTER_HOLDING;

  update(delta: number): void {
    const board = this.queries.boards.entities.values().next().value;
    if (!board) {
      return;
    }
    const mode = board.getValue(PuzzleBoard, 'mode');
    // Only a puzzle in play can pause; home and the run summary wait anyway.
    const pausable = mode === PuzzleMode.Practice || mode === PuzzleMode.Run;
    this.sinceHolding =
      this.queries.held.entities.size > 0 ? 0 : this.sinceHolding + delta;

    const pads = this.input.xr.gamepads;
    if (
      pausable &&
      (pads.left?.getButtonDown(InputComponent.Menu) ||
        pads.right?.getButtonDown(InputComponent.Menu))
    ) {
      this.toggle(board);
      return;
    }
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) {
      return;
    }
    this.player.head.getWorldPosition(this.head);
    for (const side of HANDS) {
      const gesture = this.gestures[side];
      const adapter = this.world.input.xr.visualAdapters.hand[side] as
        | XRHandVisualAdapter
        | undefined;
      const joints = adapter?.connected ? adapter.jointTransforms : undefined;
      if (!joints || joints.length < JOINTS * 16) {
        gesture.reset();
        continue;
      }
      // Joint poses are relative to the grip; bring the ones needed into
      // the world.
      const grip = this.player.gripSpaces[side];
      this.read(joints, WRIST, grip.matrixWorld, this.wrist);
      this.read(joints, INDEX_BASE, grip.matrixWorld, this.indexBase);
      this.read(joints, PINKY_BASE, grip.matrixWorld, this.pinkyBase);
      palmNormal(this.wrist, this.indexBase, this.pinkyBase, side, this.normal);
      const open =
        this.distance(joints, THUMB_TIP, INDEX_TIP) > PINCH_DISTANCE;
      const raised = this.wrist.y > this.head.y - RAISED_BELOW_EYES;
      const ready =
        pausable && open && raised && this.sinceHolding >= AFTER_HOLDING;
      if (gesture.update(delta, this.normal.y, ready)) {
        this.toggle(board);
      }
    }
  }

  private toggle(board: Entity): void {
    board.setValue(PuzzleBoard, 'paused', !board.getValue(PuzzleBoard, 'paused'));
  }

  private read(
    joints: Float32Array,
    index: number,
    grip: Matrix4,
    into: Point,
  ): void {
    const at = index * 16;
    this.joint.set(joints[at + 12], joints[at + 13], joints[at + 14]).applyMatrix4(grip);
    into.x = this.joint.x;
    into.y = this.joint.y;
    into.z = this.joint.z;
  }

  /** Distance between two joints (both relative to the grip, so no world step). */
  private distance(joints: Float32Array, a: number, b: number): number {
    const i = a * 16 + 12;
    const j = b * 16 + 12;
    return Math.hypot(
      joints[i] - joints[j],
      joints[i + 1] - joints[j + 1],
      joints[i + 2] - joints[j + 2],
    );
  }
}
