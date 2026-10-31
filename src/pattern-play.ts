import {
  type Entity,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { reorder } from './answer-order.js';
import { PieceTextures } from './pattern-art.js';
import {
  generatePattern,
  makeRandom,
  type PatternBoard,
  type Piece,
} from './patterns.js';
import type { Puzzle } from './puzzles.js';
import {
  cellName,
  cellX,
  GAP_NAME,
  PATTERN_CELLS,
} from './scene-assets/pattern-board.scene-asset.js';

// A piece let go within this box over the board counts as dropped in the
// gap: as forgiving as the tray, sized to the whole strip.
const DROP_HALF_WIDTH = 0.24;
const DROP_HALF_DEPTH = 0.1;
const DROP_HEIGHT = 0.22;
const GAP_COLORS = { idle: '#62E3D6', ready: '#FFD23F' };

/**
 * The pattern board on the table (scene node "pattern-board") during
 * pattern puzzles: deals a board from the puzzle's family and rule, shows
 * the strip with its gap, gives the tiles their pieces' textures, and
 * fills the gap once it is solved (or time runs out).
 */
export class PatternTable {
  private readonly textures = new PieceTextures();
  private readonly cells: Mesh[] = [];
  private gap?: Object3D;
  private gapMaterial?: MeshBasicMaterial;
  private dealt?: PatternBoard;
  private readonly at = new Vector3();
  private ready = false;

  constructor(private readonly entity: Entity | undefined) {
    const object = entity?.object3D;
    if (!object) {
      return;
    }
    for (let i = 0; i < PATTERN_CELLS; i += 1) {
      const cell = object.getObjectByName(cellName(i));
      if (cell instanceof Mesh) {
        // Each cell shows its own piece, so it gets its own material.
        cell.material = (cell.material as MeshStandardMaterial).clone();
        this.cells.push(cell);
      }
    }
    this.gap = object.getObjectByName(GAP_NAME);
    this.gap?.traverse((part) => {
      if (part instanceof Mesh && part.material instanceof MeshBasicMaterial) {
        this.gapMaterial ??= part.material.clone();
        part.material = this.gapMaterial;
      }
    });
    this.show(false);
  }

  /** Deals a fresh board for `puzzle` and lays its strip out. */
  /** `seed` deals a set board (the Daily Challenge); without it, a fresh one. */
  deal(puzzle: Puzzle, seed?: number): PatternBoard | undefined {
    if (!puzzle.family || !puzzle.rule || this.cells.length < PATTERN_CELLS) {
      return undefined;
    }
    this.textures.dispose();
    seed ??= Math.floor(Math.random() * 2 ** 32);
    const board = generatePattern(puzzle.family, puzzle.rule, makeRandom(seed));
    // The seed sets the board (the same for everyone on a Daily Challenge);
    // where its pieces stand is shuffled afresh on every play.
    board.answerIndex = reorder(board.options, board.answerIndex);
    this.dealt = board;
    board.strip.forEach((piece, i) => {
      const material = this.cells[i].material as MeshStandardMaterial;
      material.map = this.textures.get(board.family, piece);
      material.needsUpdate = true;
      // The gap shows the dark cloth bed under it until it is filled.
      this.cells[i].visible = i !== board.gap;
    });
    if (this.gap) {
      this.gap.position.x = cellX(board.gap);
      this.gap.visible = true;
    }
    this.setReady(false);
    return board;
  }

  /** The texture for one of the dealt board's pieces. */
  texture(piece: Piece): Texture | undefined {
    return this.dealt ? this.textures.get(this.dealt.family, piece) : undefined;
  }

  /** Shows the missing piece in place: the pattern is complete. */
  fillGap(): void {
    if (this.dealt) {
      this.cells[this.dealt.gap].visible = true;
    }
    if (this.gap) {
      this.gap.visible = false;
    }
  }

  show(visible: boolean): void {
    this.entity?.setValue(Visibility, 'isVisible', visible);
  }

  /** Whether a piece let go at `position` lands on the board. */
  isOver(position: Vector3): boolean {
    const object = this.entity?.object3D;
    if (!object) {
      return false;
    }
    object.getWorldPosition(this.at);
    const height = position.y - this.at.y;
    return (
      Math.abs(position.x - this.at.x) < DROP_HALF_WIDTH &&
      Math.abs(position.z - this.at.z) < DROP_HALF_DEPTH &&
      height > -0.02 &&
      height < DROP_HEIGHT
    );
  }

  /** The gap's outline turns gold while a held piece is over the board. */
  setReady(ready: boolean): void {
    if (ready === this.ready && this.gapMaterial) {
      return;
    }
    this.ready = ready;
    this.gapMaterial?.color.set(ready ? GAP_COLORS.ready : GAP_COLORS.idle);
  }

  dispose(): void {
    this.textures.dispose();
    for (const cell of this.cells) {
      (cell.material as MeshStandardMaterial).dispose();
    }
    this.gapMaterial?.dispose();
  }
}
