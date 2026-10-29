import {
  AudioUtils,
  createSystem,
  type Entity,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  type UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { onLanguageChange, t } from './i18n/index.js';
import { PuzzleBoard, PuzzleStatus, PuzzleTile } from './puzzle-components.js';
import { type Puzzle, PUZZLES } from './puzzles.js';

const ROUND_SECONDS = 60;
// A tile released within this distance of the tray's center, and not far
// above it, counts as dropped on the tray.
const TRAY_DROP_RADIUS = 0.1;
const TRAY_DROP_HEIGHT = 0.2;
// Tile center height when it rests upright on the tray's inset.
const TRAY_REST_HEIGHT = 0.0142 + 0.045;
// How quickly a released tile eases back home or onto the tray, per second.
const SETTLE_RATE = 14;
const LOW_TIME_SECONDS = 10;

const STATUS_COLORS = {
  playing: '#dddfe3',
  wrong: '#f5b14a',
  solved: '#7bd88f',
  timeUp: '#ff8a7a',
};
const TIMER_COLORS = { normal: '#fafaf7', low: '#f5b14a' };

type Status = (typeof PuzzleStatus)[keyof typeof PuzzleStatus];
type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

/**
 * One visual puzzle at the table: the tiles show the puzzle's objects in a
 * shuffled order, and dropping the odd one out on the tray solves it before
 * the timer runs out. The timer only runs while the XR session is visible.
 */
export class VisualPuzzleSystem extends createSystem({
  boards: { required: [PuzzleBoard] },
  tiles: { required: [PuzzleTile] },
  heldTiles: { required: [PuzzleTile, Grabbed] },
}) {
  private puzzle?: Puzzle;
  private board?: Entity;
  private tray?: Entity;
  private readonly tileBySlot: Entity[] = [];
  private readonly labelBySlot: (UIKitMLAsset | undefined)[] = [];
  private readonly homes: Vector3[] = [];
  private readonly homeRotations: Quaternion[] = [];
  private readonly settling = new Set<Entity>();
  private readonly trayRest = new Vector3();
  private readonly trayMaterials: MeshStandardMaterial[] = [];
  private trayGlowing = false;
  private shownSeconds = -1;
  private elements: Record<
    'prompt' | 'timer' | 'status' | 'detail' | 'restart',
    UIElement
  > = { prompt: null, timer: null, status: null, detail: null, restart: null };

  init(): void {
    this.puzzle = PUZZLES.find(
      (puzzle) => puzzle.type === 'visual' && puzzle.tiles?.length === 4,
    );
    this.board = this.queries.boards.entities.values().next().value;
    this.tray = this.world.getSceneEntity('answer-tray');
    if (!this.puzzle || !this.board || !this.tray) {
      return;
    }

    for (const tile of this.queries.tiles.entities) {
      const slot = tile.getValue(PuzzleTile, 'slot') ?? 0;
      this.tileBySlot[slot] = tile;
      this.homes[slot] = tile.object3D!.position.clone();
      this.homeRotations[slot] = tile.object3D!.quaternion.clone();
      tile.object3D!.traverse((object) => {
        if ((object as UIKitMLAsset).isUIKitMLAsset) {
          this.labelBySlot[slot] = object as UIKitMLAsset;
        }
      });
    }

    this.trayRest.copy(this.tray.object3D!.position);
    this.trayRest.y += TRAY_REST_HEIGHT;
    // The tray glows while a held tile is over it. Its materials are shared
    // with the asset, so it gets its own copies.
    this.tray.object3D!.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.material instanceof MeshStandardMaterial
      ) {
        object.material = object.material.clone();
        this.trayMaterials.push(object.material);
      }
    });

    const panel = this.world.getSceneObject<UIKitMLAsset>('puzzle-panel');
    this.elements = {
      prompt: panel?.getElementById('puzzle-prompt') ?? null,
      timer: panel?.getElementById('puzzle-timer') ?? null,
      status: panel?.getElementById('puzzle-status') ?? null,
      detail: panel?.getElementById('puzzle-detail') ?? null,
      restart: panel?.getElementById('puzzle-restart') ?? null,
    };
    const restart = () => this.startRound();
    this.elements.restart?.addEventListener('click', restart);

    this.cleanupFuncs.push(
      () => this.elements.restart?.removeEventListener('click', restart),
      this.queries.heldTiles.subscribe('qualify', (tile) => {
        this.settling.delete(tile);
      }),
      this.queries.heldTiles.subscribe('disqualify', (tile) => {
        this.onRelease(tile);
      }),
      onLanguageChange(() => this.render()),
    );
    this.startRound();
  }

  update(delta: number): void {
    const board = this.board;
    if (!board) {
      return;
    }

    if (
      this.status() === PuzzleStatus.Playing &&
      this.world.visibilityState.peek() === VisibilityState.Visible
    ) {
      const left = Math.max(
        0,
        (board.getValue(PuzzleBoard, 'secondsLeft') ?? 0) - delta,
      );
      board.setValue(PuzzleBoard, 'secondsLeft', left);
      if (left === 0) {
        board.setValue(PuzzleBoard, 'status', PuzzleStatus.TimeUp);
        this.render();
      } else {
        this.renderTimer();
      }
    }

    const blend = 1 - Math.exp(-SETTLE_RATE * delta);
    for (const tile of this.settling) {
      if (tile.hasComponent(Grabbed)) {
        continue;
      }
      const slot = tile.getValue(PuzzleTile, 'slot') ?? 0;
      const target = this.restingPlace(tile, slot);
      const object = tile.object3D!;
      object.position.lerp(target, blend);
      object.quaternion.slerp(this.homeRotations[slot], blend);
      if (object.position.distanceToSquared(target) < 1e-6) {
        object.position.copy(target);
        object.quaternion.copy(this.homeRotations[slot]);
        this.settling.delete(tile);
      }
    }

    let overTray = false;
    if (this.status() === PuzzleStatus.Playing) {
      for (const tile of this.queries.heldTiles.entities) {
        overTray ||= this.isOverTray(tile.object3D!.position);
      }
    }
    this.setTrayGlow(overTray);
  }

  /** Shuffles the tiles, resets the timer and returns every tile home. */
  private startRound(): void {
    const puzzle = this.puzzle;
    const board = this.board;
    if (!puzzle?.tiles || !board) {
      return;
    }
    const labels = shuffled(puzzle.tiles);
    this.tileBySlot.forEach((tile, slot) => {
      tile.setValue(PuzzleTile, 'correct', labels[slot] === puzzle.answer);
      this.labelBySlot[slot]
        ?.getElementById('tile-text')
        ?.setProperties({ text: labels[slot] });
      this.settling.add(tile);
    });
    board.setValue(PuzzleBoard, 'status', PuzzleStatus.Playing);
    board.setValue(PuzzleBoard, 'secondsLeft', ROUND_SECONDS);
    board.setValue(PuzzleBoard, 'wrongAnswers', 0);
    this.render();
  }

  private onRelease(tile: Entity): void {
    const board = this.board;
    if (
      board &&
      this.status() === PuzzleStatus.Playing &&
      this.isOverTray(tile.object3D!.position)
    ) {
      if (tile.getValue(PuzzleTile, 'correct')) {
        board.setValue(PuzzleBoard, 'status', PuzzleStatus.Solved);
        AudioUtils.play(this.tray!);
      } else {
        const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
        board.setValue(PuzzleBoard, 'wrongAnswers', wrong + 1);
      }
      this.render();
    }
    this.settling.add(tile);
  }

  /** Once solved, the right tile stays on the tray; every other tile goes home. */
  private restingPlace(tile: Entity, slot: number): Vector3 {
    return this.status() === PuzzleStatus.Solved &&
      tile.getValue(PuzzleTile, 'correct')
      ? this.trayRest
      : this.homes[slot];
  }

  private isOverTray(position: Vector3): boolean {
    const tray = this.tray!.object3D!.position;
    const dx = position.x - tray.x;
    const dz = position.z - tray.z;
    const height = position.y - tray.y;
    return (
      dx * dx + dz * dz < TRAY_DROP_RADIUS * TRAY_DROP_RADIUS &&
      height > -0.02 &&
      height < TRAY_DROP_HEIGHT
    );
  }

  private status(): Status {
    return (this.board?.getValue(PuzzleBoard, 'status') ??
      PuzzleStatus.Playing) as Status;
  }

  private setTrayGlow(glowing: boolean): void {
    if (glowing === this.trayGlowing) {
      return;
    }
    this.trayGlowing = glowing;
    for (const material of this.trayMaterials) {
      material.emissive.set(glowing ? '#8a5a00' : '#000000');
    }
  }

  /** Writes every panel text for the current state and language. */
  private render(): void {
    const puzzle = this.puzzle;
    const board = this.board;
    if (!puzzle || !board) {
      return;
    }
    const status = this.status();
    const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
    const roundOver = status !== PuzzleStatus.Playing;

    let statusText = t('puzzle.instructions');
    let statusColor = STATUS_COLORS.playing;
    let detail = '';
    if (status === PuzzleStatus.Solved) {
      statusText = t('puzzle.correct');
      statusColor = STATUS_COLORS.solved;
      detail = puzzle.explanation;
    } else if (status === PuzzleStatus.TimeUp) {
      statusText = t('puzzle.timeUp');
      statusColor = STATUS_COLORS.timeUp;
      detail = puzzle.explanation;
    } else if (wrong > 0) {
      statusText = t('puzzle.wrong');
      statusColor = STATUS_COLORS.wrong;
      detail = `${t('puzzle.hint')} ${puzzle.hint}`;
    }

    this.elements.prompt?.setProperties({ text: puzzle.prompt });
    this.elements.status?.setProperties({
      text: statusText,
      color: statusColor,
    });
    this.elements.detail?.setProperties({
      text: detail || ' ',
      display: detail ? 'flex' : 'none',
    });
    this.elements.restart?.setProperties({
      display: roundOver ? 'flex' : 'none',
    });
    this.shownSeconds = -1;
    this.renderTimer();
  }

  /** The timer text changes once a second, so it is only rewritten then. */
  private renderTimer(): void {
    const seconds = Math.ceil(
      this.board?.getValue(PuzzleBoard, 'secondsLeft') ?? 0,
    );
    if (seconds === this.shownSeconds) {
      return;
    }
    this.shownSeconds = seconds;
    this.elements.timer?.setProperties({
      text: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      color:
        seconds <= LOW_TIME_SECONDS ? TIMER_COLORS.low : TIMER_COLORS.normal,
    });
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
