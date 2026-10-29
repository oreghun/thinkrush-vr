import {
  AudioUtils,
  createSystem,
  type Entity,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  Quaternion,
  type UIKitMLAsset,
  Vector3,
  Visibility,
  VisibilityState,
} from '@iwsdk/core';
import { onLanguageChange, t } from './i18n/index.js';
import {
  AnswerOrb,
  PuzzleBoard,
  PuzzleStatus,
  PuzzleTile,
} from './puzzle-components.js';
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
// The stowed half of the set (tiles or orbs) waits this far below its place.
const STOW_DROP = 2.5;
// How long a wrongly picked orb glows amber.
const ORB_FLASH_SECONDS = 0.7;

const STATUS_COLORS = {
  playing: '#dddfe3',
  wrong: '#f5b14a',
  solved: '#7bd88f',
  timeUp: '#ff8a7a',
};
const TIMER_COLORS = { normal: '#fafaf7', low: '#f5b14a' };
const ORB_GLOW = { correct: '#1d5c2a', wrong: '#8a5a00', idle: '#000000' };

type Status = (typeof PuzzleStatus)[keyof typeof PuzzleStatus];
type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

/**
 * Plays through content/puzzles.json at the table, one puzzle at a time.
 * Visual puzzles use the four grabbable tiles and the tray; riddles,
 * proverbs and mafumbo use the three answer orbs. The half of the set that
 * is not in use waits below the floor. Next puzzle advances through the
 * bank, and the timer only runs while the XR session is visible.
 */
export class PuzzleSystem extends createSystem({
  boards: { required: [PuzzleBoard] },
  tiles: { required: [PuzzleTile] },
  heldTiles: { required: [PuzzleTile, Grabbed] },
  orbs: { required: [AnswerOrb] },
  pressedOrbs: { required: [AnswerOrb, Pressed] },
}) {
  private puzzle?: Puzzle;
  private isVisual = true;
  private board?: Entity;
  private tray?: Entity;
  private readonly tileBySlot: Entity[] = [];
  private readonly tileLabels: (UIKitMLAsset | undefined)[] = [];
  private readonly tileHomes: Vector3[] = [];
  private readonly tileRotations: Quaternion[] = [];
  private readonly orbBySlot: Entity[] = [];
  private readonly orbLabels: (UIKitMLAsset | undefined)[] = [];
  private readonly orbHomes: Vector3[] = [];
  private readonly orbMaterials: MeshStandardMaterial[][] = [];
  private readonly orbFlash = new Map<number, number>();
  private readonly settling = new Set<Entity>();
  private readonly trayRest = new Vector3();
  private readonly target = new Vector3();
  private readonly trayMaterials: MeshStandardMaterial[] = [];
  private trayGlowing = false;
  private shownSeconds = -1;
  private elements: Record<
    'prompt' | 'question' | 'timer' | 'status' | 'detail' | 'next',
    UIElement
  > = {
    prompt: null,
    question: null,
    timer: null,
    status: null,
    detail: null,
    next: null,
  };

  init(): void {
    this.board = this.queries.boards.entities.values().next().value;
    this.tray = this.world.getSceneEntity('answer-tray');
    if (PUZZLES.length === 0 || !this.board || !this.tray) {
      return;
    }

    for (const tile of this.queries.tiles.entities) {
      const slot = tile.getValue(PuzzleTile, 'slot') ?? 0;
      this.tileBySlot[slot] = tile;
      this.tileHomes[slot] = tile.object3D!.position.clone();
      this.tileRotations[slot] = tile.object3D!.quaternion.clone();
      this.tileLabels[slot] = findUIKitML(tile);
    }
    for (const orb of this.queries.orbs.entities) {
      const slot = orb.getValue(AnswerOrb, 'slot') ?? 0;
      this.orbBySlot[slot] = orb;
      this.orbHomes[slot] = orb.object3D!.position.clone();
      this.orbLabels[slot] = findUIKitML(orb);
      // The orb glows green or amber on its own, so it gets its own
      // copies of the shared graphite material.
      this.orbMaterials[slot] = cloneMaterials(orb);
    }
    this.trayRest.copy(this.tray.object3D!.position);
    this.trayRest.y += TRAY_REST_HEIGHT;
    this.trayMaterials.push(...cloneMaterials(this.tray));

    const panel = this.world.getSceneObject<UIKitMLAsset>('puzzle-panel');
    this.elements = {
      prompt: panel?.getElementById('puzzle-prompt') ?? null,
      question: panel?.getElementById('puzzle-question') ?? null,
      timer: panel?.getElementById('puzzle-timer') ?? null,
      status: panel?.getElementById('puzzle-status') ?? null,
      detail: panel?.getElementById('puzzle-detail') ?? null,
      next: panel?.getElementById('puzzle-restart') ?? null,
    };
    const next = () =>
      this.startRound(
        (this.board?.getValue(PuzzleBoard, 'puzzleIndex') ?? 0) + 1,
      );
    this.elements.next?.addEventListener('click', next);

    this.cleanupFuncs.push(
      () => this.elements.next?.removeEventListener('click', next),
      this.queries.pressedOrbs.subscribe('qualify', (orb) => {
        this.onOrbPressed(orb);
      }),
      this.queries.heldTiles.subscribe('qualify', (tile) => {
        this.settling.delete(tile);
      }),
      this.queries.heldTiles.subscribe('disqualify', (tile) => {
        this.onTileReleased(tile);
      }),
      onLanguageChange(() => this.render()),
    );
    this.startRound(this.board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0);
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
        this.revealCorrectOrb();
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
      const target = this.tileRestingPlace(tile, slot);
      const object = tile.object3D!;
      object.position.lerp(target, blend);
      object.quaternion.slerp(this.tileRotations[slot], blend);
      if (object.position.distanceToSquared(target) < 1e-6) {
        object.position.copy(target);
        object.quaternion.copy(this.tileRotations[slot]);
        this.settling.delete(tile);
      }
    }

    for (const [slot, left] of this.orbFlash) {
      const remaining = left - delta;
      if (remaining <= 0) {
        this.orbFlash.delete(slot);
        this.setOrbGlow(slot, ORB_GLOW.idle);
      } else {
        this.orbFlash.set(slot, remaining);
      }
    }

    let overTray = false;
    if (this.isVisual && this.status() === PuzzleStatus.Playing) {
      for (const tile of this.queries.heldTiles.entities) {
        overTray ||= this.isOverTray(tile.object3D!.position);
      }
    }
    this.setTrayGlow(overTray);
  }

  /** Loads puzzle `index` (wrapping), resets the timer and the pieces. */
  private startRound(index: number): void {
    const board = this.board;
    if (!board) {
      return;
    }
    const wrapped =
      ((index % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
    const puzzle = PUZZLES[wrapped];
    this.puzzle = puzzle;
    this.isVisual = puzzle.type === 'visual';
    board.setValue(PuzzleBoard, 'puzzleIndex', wrapped);
    board.setValue(PuzzleBoard, 'status', PuzzleStatus.Playing);
    board.setValue(PuzzleBoard, 'secondsLeft', ROUND_SECONDS);
    board.setValue(PuzzleBoard, 'wrongAnswers', 0);
    this.settling.clear();
    this.orbFlash.clear();

    const tileLabels = this.isVisual ? shuffled(puzzle.tiles ?? []) : [];
    this.tileBySlot.forEach((tile, slot) => {
      tile.setValue(PuzzleTile, 'correct', tileLabels[slot] === puzzle.answer);
      this.tileLabels[slot]
        ?.getElementById('tile-text')
        ?.setProperties({ text: tileLabels[slot] ?? '' });
      this.place(tile, this.tileHomes[slot], this.isVisual);
      tile.object3D!.quaternion.copy(this.tileRotations[slot]);
    });

    const options = this.isVisual ? [] : shuffled(puzzle.options);
    this.orbBySlot.forEach((orb, slot) => {
      orb.setValue(AnswerOrb, 'correct', options[slot] === puzzle.answer);
      this.orbLabels[slot]
        ?.getElementById('orb-text')
        ?.setProperties({ text: options[slot] ?? '' });
      this.place(orb, this.orbHomes[slot], !this.isVisual);
      this.setOrbGlow(slot, ORB_GLOW.idle);
    });
    this.render();
  }

  private onOrbPressed(orb: Entity): void {
    const board = this.board;
    if (!board || this.isVisual || this.status() !== PuzzleStatus.Playing) {
      return;
    }
    const slot = orb.getValue(AnswerOrb, 'slot') ?? 0;
    if (orb.getValue(AnswerOrb, 'correct')) {
      board.setValue(PuzzleBoard, 'status', PuzzleStatus.Solved);
      this.orbFlash.delete(slot);
      this.setOrbGlow(slot, ORB_GLOW.correct);
      AudioUtils.play(this.tray!);
    } else {
      const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
      board.setValue(PuzzleBoard, 'wrongAnswers', wrong + 1);
      this.setOrbGlow(slot, ORB_GLOW.wrong);
      this.orbFlash.set(slot, ORB_FLASH_SECONDS);
    }
    this.render();
  }

  private onTileReleased(tile: Entity): void {
    const board = this.board;
    if (
      board &&
      this.isVisual &&
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

  /** Teaches the answer when time runs out on an orb puzzle. */
  private revealCorrectOrb(): void {
    if (this.isVisual) {
      return;
    }
    this.orbBySlot.forEach((orb, slot) => {
      if (orb.getValue(AnswerOrb, 'correct')) {
        this.orbFlash.delete(slot);
        this.setOrbGlow(slot, ORB_GLOW.correct);
      }
    });
  }

  /** Once solved, the right tile stays on the tray; every other tile goes home. */
  private tileRestingPlace(tile: Entity, slot: number): Vector3 {
    return this.isVisual &&
      this.status() === PuzzleStatus.Solved &&
      tile.getValue(PuzzleTile, 'correct')
      ? this.trayRest
      : this.restingTarget(slot);
  }

  private restingTarget(slot: number): Vector3 {
    this.target.copy(this.tileHomes[slot]);
    if (!this.isVisual) {
      this.target.y -= STOW_DROP;
    }
    return this.target;
  }

  /** Puts `entity` at `home`, or stows it below the floor, and hides it. */
  private place(entity: Entity, home: Vector3, shown: boolean): void {
    entity.object3D!.position.copy(home);
    if (!shown) {
      entity.object3D!.position.y -= STOW_DROP;
    }
    entity.setValue(Visibility, 'isVisible', shown);
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

  private setOrbGlow(slot: number, color: string): void {
    for (const material of this.orbMaterials[slot] ?? []) {
      material.emissive.set(color);
    }
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

    let statusText = this.isVisual
      ? t('puzzle.instructions')
      : t('puzzle.instructionsOrbs');
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
    this.elements.question?.setProperties({
      text: puzzle.question ?? ' ',
      display: puzzle.question ? 'flex' : 'none',
    });
    this.elements.status?.setProperties({
      text: statusText,
      color: statusColor,
    });
    this.elements.detail?.setProperties({
      text: detail || ' ',
      display: detail ? 'flex' : 'none',
    });
    this.elements.next?.setProperties({
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

/** The UIKitML label somewhere under `entity`'s object. */
function findUIKitML(entity: Entity): UIKitMLAsset | undefined {
  let found: UIKitMLAsset | undefined;
  entity.object3D!.traverse((object) => {
    if ((object as UIKitMLAsset).isUIKitMLAsset) {
      found = object as UIKitMLAsset;
    }
  });
  return found;
}

/**
 * Gives every standard-material mesh under `entity` its own material copies
 * and returns them, so one instance can glow without the others.
 */
function cloneMaterials(entity: Entity): MeshStandardMaterial[] {
  const clones: MeshStandardMaterial[] = [];
  entity.object3D!.traverse((object) => {
    if (
      object instanceof Mesh &&
      object.material instanceof MeshStandardMaterial
    ) {
      object.material = object.material.clone();
      clones.push(object.material);
    }
  });
  return clones;
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
