import {
  AudioUtils,
  createSystem,
  type Entity,
  Grabbed,
  Material,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  Quaternion,
  type UIKitMLAsset,
  Vector3,
  Visibility,
  VisibilityState,
} from '@iwsdk/core';
import {
  type Category,
  categoryIndices,
  nextCategory,
  nextIndexInCategory,
  PuzzleCategory,
} from './categories.js';
import { type MessageKey, onLanguageChange, t } from './i18n/index.js';
import {
  AnswerOrb,
  PuzzleBoard,
  PuzzleMode,
  PuzzleStatus,
  PuzzleTile,
} from './puzzle-components.js';
import { type Puzzle, PUZZLES } from './puzzles.js';
import { createPuzzleObject, disposePuzzleObject } from './scene-assets/object-options.scene-asset.js';

const ROUND_SECONDS = 60;
const RUN_SECONDS = 180;
// A solve scores its difficulty (1-5) times this.
const POINTS_PER_DIFFICULTY = 10;
// How long the Correct feedback stays up before a run auto-advances.
const SOLVE_BEAT_SECONDS = 2.5;
const BEST_SCORE_KEY = 'thinkrush.bestScore';
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

const CATEGORY_LABEL_KEYS: Record<Category, MessageKey> = {
  [PuzzleCategory.All]: 'category.all',
  [PuzzleCategory.Visual]: 'category.visual',
  [PuzzleCategory.Riddle]: 'category.riddle',
  [PuzzleCategory.Proverb]: 'category.proverb',
  [PuzzleCategory.Mafumbo]: 'category.mafumbo',
};

type Status = (typeof PuzzleStatus)[keyof typeof PuzzleStatus];
type Mode = (typeof PuzzleMode)[keyof typeof PuzzleMode];
type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

/**
 * Plays through content/puzzles.json at the table, one puzzle at a time.
 * Visual puzzles use the four grabbable tiles and the tray; riddles,
 * proverbs and mafumbo use the three answer orbs. The half of the set that
 * is not in use waits below the floor. Timers only run while the XR session
 * is visible.
 *
 * Two modes: practice (the default) browses the bank with Next puzzle, 60 s
 * each; a run gives 3 minutes for as many mixed puzzles as possible, with
 * auto-advance on solve, Skip, difficulty-scaled scoring, and a best score
 * remembered in localStorage.
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
  private readonly tileModels: (import('@iwsdk/core').Group | undefined)[] = [];
  private readonly tileBaseMaterials: (Material | Material[] | undefined)[] = [];
  private readonly tileHiddenMaterials: (Material | Material[] | undefined)[] = [];
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
  // The shuffled draw order of the current run, and where we are in it.
  private runOrder: number[] = [];
  private runPointer = 0;
  // Seconds of Correct feedback left before a run auto-advances.
  private advanceIn = 0;
  private elements: Record<
    | 'prompt'
    | 'question'
    | 'score'
    | 'timer'
    | 'status'
    | 'detail'
    | 'category'
    | 'categoryLabel'
    | 'run'
    | 'runLabel'
    | 'next'
    | 'nextLabel'
    | 'exit'
    | 'exitLabel',
    UIElement
  > = {
    prompt: null,
    question: null,
    score: null,
    timer: null,
    status: null,
    detail: null,
    category: null,
    categoryLabel: null,
    run: null,
    runLabel: null,
    next: null,
    nextLabel: null,
    exit: null,
    exitLabel: null,
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
      // The tile stays as the invisible grabbable hit target. Only its printed
      // slab is hidden, so the object miniature itself reads as the answer.
      if (this.tileLabels[slot]) this.tileLabels[slot]!.visible = false;
      const tileMesh = tile.object3D;
      if (tileMesh instanceof Mesh) {
        this.tileBaseMaterials[slot] = tileMesh.material;
        const hideMaterial = (material: Material): Material => {
          const hidden = material.clone();
          hidden.transparent = true;
          hidden.opacity = 0;
          hidden.depthWrite = false;
          hidden.colorWrite = false;
          hidden.needsUpdate = true;
          return hidden;
        };
        this.tileHiddenMaterials[slot] = Array.isArray(tileMesh.material)
          ? tileMesh.material.map(hideMaterial)
          : hideMaterial(tileMesh.material);
        tileMesh.material = this.tileHiddenMaterials[slot]!;
        tileMesh.castShadow = false;
        tileMesh.receiveShadow = false;
      }
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
      score: panel?.getElementById('puzzle-score') ?? null,
      timer: panel?.getElementById('puzzle-timer') ?? null,
      status: panel?.getElementById('puzzle-status') ?? null,
      detail: panel?.getElementById('puzzle-detail') ?? null,
      category: panel?.getElementById('puzzle-category') ?? null,
      categoryLabel: panel?.getElementById('puzzle-category-label') ?? null,
      run: panel?.getElementById('puzzle-run') ?? null,
      runLabel: panel?.getElementById('puzzle-run-label') ?? null,
      next: panel?.getElementById('puzzle-restart') ?? null,
      nextLabel: panel?.getElementById('puzzle-next-label') ?? null,
      exit: panel?.getElementById('puzzle-exit') ?? null,
      exitLabel: panel?.getElementById('puzzle-exit-label') ?? null,
    };
    const next = () => this.onNextPressed();
    const run = () => this.startRun();
    const exit = () => this.exitToPractice();
    const category = () => this.cycleCategory();
    this.elements.next?.addEventListener('click', next);
    this.elements.run?.addEventListener('click', run);
    this.elements.exit?.addEventListener('click', exit);
    this.elements.category?.addEventListener('click', category);

    this.cleanupFuncs.push(
      () => this.tileModels.forEach((model, slot) => {
        if (model) {
          this.tileBySlot[slot]?.object3D?.remove(model);
          disposePuzzleObject(model);
          this.tileModels[slot] = undefined;
        }
      }),
      () => this.tileBySlot.forEach((tile, slot) => {
        const tileMesh = tile.object3D;
        const hidden = this.tileHiddenMaterials[slot];
        const original = this.tileBaseMaterials[slot];
        if (tileMesh instanceof Mesh && hidden && original) {
          for (const material of Array.isArray(hidden) ? hidden : [hidden]) {
            material.dispose();
          }
          tileMesh.material = original;
          this.tileHiddenMaterials[slot] = undefined;
        }
      }),
      () => this.elements.next?.removeEventListener('click', next),
      () => this.elements.run?.removeEventListener('click', run),
      () => this.elements.exit?.removeEventListener('click', exit),
      () => this.elements.category?.removeEventListener('click', category),
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

    const mode = this.mode();
    const state = this.world.visibilityState.peek();
    // A blurred XR session (headset menu, headset off) pauses everything.
    // The practice timer also pauses outside VR, where tiles cannot be
    // dragged; a run's clock ticks on the flat page too, or a desktop run
    // would never end. Hidden browser tabs stop the frame loop anyway.
    const awake = state !== VisibilityState.VisibleBlurred;
    const clockRunning =
      mode === PuzzleMode.Run
        ? awake
        : mode === PuzzleMode.Practice &&
          this.status() === PuzzleStatus.Playing &&
          state === VisibilityState.Visible;
    if (clockRunning) {
      const left = Math.max(
        0,
        (board.getValue(PuzzleBoard, 'secondsLeft') ?? 0) - delta,
      );
      board.setValue(PuzzleBoard, 'secondsLeft', left);
      if (left === 0) {
        if (mode === PuzzleMode.Run) {
          this.endRun();
        } else {
          board.setValue(PuzzleBoard, 'status', PuzzleStatus.TimeUp);
          this.revealCorrectOrb();
          this.render();
        }
      } else {
        this.renderTimer();
      }
    }

    if (awake && this.advanceIn > 0) {
      this.advanceIn -= delta;
      if (this.advanceIn <= 0 && this.mode() === PuzzleMode.Run) {
        this.advanceRun();
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
    if (this.mode() !== PuzzleMode.Run) {
      // A run keeps its global clock; practice restarts the per-puzzle one.
      board.setValue(PuzzleBoard, 'secondsLeft', ROUND_SECONDS);
    }
    board.setValue(PuzzleBoard, 'wrongAnswers', 0);
    this.advanceIn = 0;
    this.settling.clear();
    this.orbFlash.clear();

    const tileLabels = this.isVisual ? shuffled(puzzle.tiles ?? []) : [];
    this.tileBySlot.forEach((tile, slot) => {
      const label = tileLabels[slot] ?? '';
      tile.setValue(PuzzleTile, 'correct', label === puzzle.answer);
      // Names remain in the puzzle data for answer matching, but never appear
      // on the table. Each visible tile gets a low-poly object miniature.
      this.tileLabels[slot]
        ?.getElementById('tile-text')
        ?.setProperties({ text: '' });
      const previousModel = this.tileModels[slot];
      if (previousModel) {
        tile.object3D!.remove(previousModel);
        disposePuzzleObject(previousModel);
        this.tileModels[slot] = undefined;
      }
      if (this.isVisual && label) {
        const model = createPuzzleObject(label);
        // The tile origin is its centre; its top surface is 1.75 cm above it.
        // Keep the normalized miniature on the table, with no box behind it.
        model.position.set(0, 0.0185, 0);
        tile.object3D!.add(model);
        this.tileModels[slot] = model;
      }
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
      this.orbFlash.delete(slot);
      this.setOrbGlow(slot, ORB_GLOW.correct);
      this.onSolved();
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
        this.onSolved();
      } else {
        const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
        board.setValue(PuzzleBoard, 'wrongAnswers', wrong + 1);
      }
      this.render();
    }
    this.settling.add(tile);
  }

  private mode(): Mode {
    return (this.board?.getValue(PuzzleBoard, 'mode') ??
      PuzzleMode.Practice) as Mode;
  }

  private category(): Category {
    return (this.board?.getValue(PuzzleBoard, 'category') ??
      PuzzleCategory.All) as Category;
  }

  /** The Category button: next non-empty category, All always included. */
  private cycleCategory(): void {
    const board = this.board;
    if (!board || this.mode() !== PuzzleMode.Practice) {
      return;
    }
    const category = nextCategory(PUZZLES, this.category());
    board.setValue(PuzzleBoard, 'category', category);
    const index = board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0;
    if (categoryIndices(PUZZLES, category).includes(index)) {
      // The current puzzle already fits; don't restart a round mid-solve.
      this.render();
    } else {
      this.startRound(nextIndexInCategory(PUZZLES, category, index));
    }
  }

  /** Marks the round solved; in a run it also scores and queues the next. */
  private onSolved(): void {
    const board = this.board!;
    board.setValue(PuzzleBoard, 'status', PuzzleStatus.Solved);
    AudioUtils.play(this.tray!);
    if (this.mode() === PuzzleMode.Run && this.puzzle) {
      board.setValue(
        PuzzleBoard,
        'score',
        (board.getValue(PuzzleBoard, 'score') ?? 0) +
          this.puzzle.difficulty * POINTS_PER_DIFFICULTY,
      );
      board.setValue(
        PuzzleBoard,
        'solved',
        (board.getValue(PuzzleBoard, 'solved') ?? 0) + 1,
      );
      this.advanceIn = SOLVE_BEAT_SECONDS;
    }
  }

  private onNextPressed(): void {
    if (this.mode() === PuzzleMode.Run) {
      this.advanceRun();
    } else if (this.mode() === PuzzleMode.Practice) {
      this.startRound(
        nextIndexInCategory(
          PUZZLES,
          this.category(),
          this.board?.getValue(PuzzleBoard, 'puzzleIndex') ?? 0,
        ),
      );
    }
  }

  /** Starts (or restarts) a 3-minute run over the whole bank, shuffled. */
  private startRun(): void {
    const board = this.board;
    if (!board || this.mode() === PuzzleMode.Run) {
      return;
    }
    board.setValue(PuzzleBoard, 'mode', PuzzleMode.Run);
    board.setValue(PuzzleBoard, 'score', 0);
    board.setValue(PuzzleBoard, 'solved', 0);
    board.setValue(PuzzleBoard, 'secondsLeft', RUN_SECONDS);
    // The run draws only from the chosen category.
    this.runOrder = shuffled(categoryIndices(PUZZLES, this.category()));
    this.runPointer = 0;
    this.startRound(this.runOrder[0]);
  }

  /** The next puzzle of the run, reshuffling when the bank is exhausted. */
  private advanceRun(): void {
    this.advanceIn = 0;
    this.runPointer += 1;
    if (this.runPointer >= this.runOrder.length) {
      this.runOrder = shuffled(this.runOrder);
      this.runPointer = 0;
    }
    this.startRound(this.runOrder[this.runPointer]);
  }

  /** Ends the run and shows the summary, remembering the best score. */
  private endRun(): void {
    const board = this.board!;
    this.advanceIn = 0;
    board.setValue(PuzzleBoard, 'mode', PuzzleMode.RunOver);
    board.setValue(PuzzleBoard, 'secondsLeft', 0);
    this.revealCorrectOrb();
    const score = board.getValue(PuzzleBoard, 'score') ?? 0;
    if (score > readBestScore()) {
      writeBestScore(score);
    }
    this.render();
  }

  private exitToPractice(): void {
    const board = this.board;
    if (!board || this.mode() !== PuzzleMode.RunOver) {
      return;
    }
    board.setValue(PuzzleBoard, 'mode', PuzzleMode.Practice);
    this.startRound(board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0);
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
    const mode = this.mode();
    const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
    const score = board.getValue(PuzzleBoard, 'score') ?? 0;

    let statusText = this.isVisual
      ? t('puzzle.instructions')
      : t('puzzle.instructionsOrbs');
    let statusColor = STATUS_COLORS.playing;
    let detail = '';
    if (mode === PuzzleMode.RunOver) {
      const solved = board.getValue(PuzzleBoard, 'solved') ?? 0;
      statusText = t('puzzle.runOver');
      statusColor = STATUS_COLORS.timeUp;
      detail =
        `${t('puzzle.score')}: ${score}. ` +
        `${t('puzzle.solvedLabel')}: ${solved}. ` +
        `${t('puzzle.best')}: ${Math.max(score, readBestScore())}.`;
    } else if (status === PuzzleStatus.Solved) {
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
    this.elements.category?.setProperties({
      display: mode === PuzzleMode.Practice ? 'flex' : 'none',
    });
    this.elements.categoryLabel?.setProperties({
      text: `${t('puzzle.category')}: ${t(CATEGORY_LABEL_KEYS[this.category()])}`,
    });
    this.elements.score?.setProperties({
      text: `${t('puzzle.score')}: ${score}`,
      display: mode === PuzzleMode.Practice ? 'none' : 'flex',
    });
    // Start run doubles as Run again on the summary.
    this.elements.run?.setProperties({
      display: mode === PuzzleMode.Run ? 'none' : 'flex',
    });
    this.elements.runLabel?.setProperties({
      text:
        mode === PuzzleMode.RunOver
          ? t('puzzle.runAgain')
          : t('puzzle.startRun'),
    });
    // Next is always available in practice: on the desktop page the timer
    // never runs and tiles need hands, so a round there never ends. In a
    // run the same button is Skip; on the summary it hides.
    this.elements.next?.setProperties({
      display: mode === PuzzleMode.RunOver ? 'none' : 'flex',
    });
    this.elements.nextLabel?.setProperties({
      text: mode === PuzzleMode.Run ? t('puzzle.skip') : t('puzzle.next'),
    });
    this.elements.exit?.setProperties({
      display: mode === PuzzleMode.RunOver ? 'flex' : 'none',
    });
    this.elements.exitLabel?.setProperties({
      text: t('puzzle.backToPractice'),
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

/** The saved best run score, or 0 when there is none or storage is blocked. */
function readBestScore(): number {
  try {
    const value = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Storage can be blocked (private mode); the best then lasts this visit.
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
