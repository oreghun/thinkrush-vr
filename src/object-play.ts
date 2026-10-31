import {
  type Entity,
  type Group,
  type Mesh,
  type Object3D,
  Quaternion,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { reorder } from './answer-order.js';
import {
  createFigure,
  createFill,
  createPieceModel,
  type FigureParts,
  gapCentre,
  PIECE_BLOCKS,
  setGapReady,
} from './object-art.js';
import { dealObject, judgeFit, type ObjectBoard } from './object-puzzle.js';
import { makeRandom } from './patterns.js';
import type { Puzzle } from './puzzles.js';
import { BED_NAME } from './scene-assets/object-board.scene-asset.js';

// A piece let go with its middle this close to the gap's middle is at the
// gap: forgiving, as hands are not precise, but clearly "here".
const NEAR_DISTANCE = 0.11;
// The right piece glides into the gap in this long.
const SNAP_SECONDS = 0.25;
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * The object board on the table (scene node "object-board") during object
 * puzzles: deals a board for the puzzle's figure, builds the figure with
 * its gap, makes the candidate pieces for the tiles, judges a piece let go
 * at the gap, and snaps the right one in (or fills the gap at time up).
 */
export class ObjectTable {
  private readonly bed?: Object3D;
  private figure?: FigureParts;
  private fill?: Mesh;
  private dealt?: ObjectBoard;
  private ready = false;
  private snapLeft = 0;
  private readonly gapLocal = new Vector3();
  private readonly gapWorld = new Vector3();
  private readonly at = new Vector3();
  private readonly bedQuat = new Quaternion();
  private readonly pieceQuat = new Quaternion();
  private readonly turnQuat = new Quaternion();
  private readonly axis = new Vector3();
  private readonly snapFrom = new Vector3();
  private readonly snapFromQuat = new Quaternion();
  private readonly identity = new Quaternion();

  constructor(private readonly entity: Entity | undefined) {
    this.bed = entity?.object3D?.getObjectByName(BED_NAME);
    this.show(false);
  }

  /** Deals a board for `puzzle`; `seed` deals a set one (the Daily Challenge). */
  deal(puzzle: Puzzle, seed?: number): ObjectBoard | undefined {
    if (!puzzle.figure || !this.bed) {
      return undefined;
    }
    this.clear();
    seed ??= Math.floor(Math.random() * 2 ** 32);
    const board = dealObject(puzzle.figure, puzzle.difficulty, makeRandom(seed));
    // The seed sets the board (the same for everyone on a Daily Challenge);
    // where its pieces stand is shuffled afresh on every play.
    board.answerIndex = reorder(board.options, board.answerIndex);
    this.dealt = board;
    this.figure = createFigure(board);
    this.bed.add(this.figure.root);
    const [x, y] = gapCentre(board);
    this.gapLocal.set(x, y, 0);
    this.ready = false;
    setGapReady(this.figure.gapMaterial, false);
    return board;
  }

  /** The model for the candidate on tile `slot`, for its display stand. */
  pieceModel(slot: number): Group | undefined {
    const piece = this.dealt?.options[slot];
    return piece ? createPieceModel(piece) : undefined;
  }

  show(visible: boolean): void {
    this.entity?.setValue(Visibility, 'isVisible', visible);
  }

  /** Whether the piece in `model` (a tile's model) is at the gap. */
  isNear(model: Object3D | undefined): boolean {
    const blocks = model?.getObjectByName(PIECE_BLOCKS);
    if (!blocks || !this.bed || !this.figure) {
      return false;
    }
    blocks.getWorldPosition(this.at);
    this.gapWorld.copy(this.gapLocal);
    this.bed.localToWorld(this.gapWorld);
    return this.at.distanceTo(this.gapWorld) < NEAR_DISTANCE;
  }

  /**
   * What letting the piece in `model` (on tile `slot`) go at the gap does:
   * see judgeFit. The turn is read in the board's own frame, so the lean of
   * the plate does not matter.
   */
  judge(slot: number, model: Object3D | undefined): 'fits' | 'turn' | 'wrong' {
    const blocks = model?.getObjectByName(PIECE_BLOCKS);
    if (!this.dealt || !blocks || !this.bed) {
      return 'wrong';
    }
    this.relativeTurn(blocks);
    this.axis.set(1, 0, 0).applyQuaternion(this.pieceQuat);
    const roll = Math.atan2(this.axis.y, this.axis.x);
    this.axis.set(0, 0, 1).applyQuaternion(this.pieceQuat);
    return judgeFit(this.dealt, slot, roll, this.axis.z);
  }

  /**
   * Puts the missing blocks in place. Given the right piece's model, they
   * glide in from where it was let go; without one (time up) they appear.
   */
  fillGap(model?: Object3D): void {
    if (!this.dealt || !this.bed || !this.figure || this.fill) {
      return;
    }
    this.figure.gap.visible = false;
    const fill = createFill(this.dealt);
    this.fill = fill;
    this.bed.add(fill);
    const blocks = model?.getObjectByName(PIECE_BLOCKS);
    const piece = this.dealt.options[this.dealt.answerIndex];
    if (blocks) {
      // Start exactly where the held piece was: its blocks were built
      // already turned, so the fill takes that turn too.
      blocks.getWorldPosition(this.snapFrom);
      this.bed.worldToLocal(this.snapFrom);
      this.relativeTurn(blocks);
      this.turnQuat.setFromAxisAngle(Z_AXIS, (piece.turn * Math.PI) / 2);
      this.snapFromQuat.copy(this.pieceQuat).multiply(this.turnQuat);
      this.snapLeft = SNAP_SECONDS;
      this.placeFill(0);
    } else {
      this.placeFill(1);
    }
  }

  /** Moves a snapping piece on; call every frame. */
  update(delta: number): void {
    if (this.snapLeft <= 0) {
      return;
    }
    this.snapLeft = Math.max(0, this.snapLeft - delta);
    this.placeFill(1 - this.snapLeft / SNAP_SECONDS);
  }

  /** The gap glows gold while a held piece is near it. */
  setReady(ready: boolean): void {
    if (ready === this.ready || !this.figure) {
      return;
    }
    this.ready = ready;
    setGapReady(this.figure.gapMaterial, ready);
  }

  /** Removes the figure and frees what it was built from. */
  clear(): void {
    for (const mesh of [this.figure?.root.children ?? [], this.fill ?? []].flat()) {
      const part = mesh as Mesh;
      part.geometry?.dispose();
      for (const material of [part.material].flat()) material?.dispose();
    }
    this.figure?.root.removeFromParent();
    this.fill?.removeFromParent();
    this.figure = undefined;
    this.fill = undefined;
    this.dealt = undefined;
    this.snapLeft = 0;
  }

  dispose(): void {
    this.clear();
  }

  /** this.pieceQuat = the turn of `blocks` in the board's bed frame. */
  private relativeTurn(blocks: Object3D): void {
    this.bed!.getWorldQuaternion(this.bedQuat).invert();
    blocks.getWorldQuaternion(this.pieceQuat);
    this.pieceQuat.premultiply(this.bedQuat);
  }

  /** Places the fill `progress` (0-1) of the way from the snap start. */
  private placeFill(progress: number): void {
    const fill = this.fill;
    if (!fill) {
      return;
    }
    if (progress >= 1) {
      fill.position.copy(this.gapLocal);
      fill.quaternion.identity();
      return;
    }
    const eased = 1 - (1 - progress) ** 3;
    fill.position.lerpVectors(this.snapFrom, this.gapLocal, eased);
    fill.quaternion.slerpQuaternions(this.snapFromQuat, this.identity, eased);
  }
}
