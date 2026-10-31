import {
  AssetManager,
  AudioUtils,
  createSystem,
  type Entity,
  Grabbed,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
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
  ROUND_SECONDS,
  RUN_SECONDS,
} from './puzzle-components.js';
import {
  judge,
  Move,
  type MoveName,
  pickMove,
  releaseMove,
} from './moves.js';
import { type Puzzle, PUZZLES } from './puzzles.js';
import { Rush } from './rush-component.js';
import {
  isReadAloudOn,
  pauseSpeaking,
  speak,
  stopSpeaking,
} from './read-aloud.js';
import {
  builtStand,
  fitImportedStand,
} from './scene-assets/display-stand.scene-asset.js';
import { createPuzzleObject, disposePuzzleObject } from './scene-assets/object-options.scene-asset.js';
import { IMPORTED_OBJECTS, objectAssetId } from './imported-objects.js';
import { type TileModel, tileModelFor } from './tile-models.js';

// A solve scores its difficulty (1-5) times this.
const POINTS_PER_DIFFICULTY = 10;
// How long the Correct feedback stays up before a run auto-advances.
const SOLVE_BEAT_SECONDS = 2.5;
const BEST_SCORE_KEY = 'thinkrush.bestScore';
// How many visual puzzles this device has started, which decides when each
// move is introduced (see src/moves.ts).
const MOVES_SEEN_KEY = 'thinkrush.visualSeen';
// The table surface in a tile's own frame: the tile origin is the centre of
// its (hidden or word-printed) slab.
const TILE_FLOOR_Y = -0.044;
// Lift counts once the held pick is this far above the eyes for this long:
// clearly above the head, so holding something close to look at it is not
// an answer.
const LIFT_ABOVE_EYES = 0.1;
const LIFT_SECONDS = 0.5;
// Show counts once the held pick is this close to RUSH's centre for this
// long. RUSH comes within reach for the show move (see RushSystem).
const SHOW_DISTANCE = 0.2;
const SHOW_SECONDS = 0.6;
// A released tile whose up axis points at least this far down was flipped.
const FLIPPED_UP_Y = -0.5;
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

const MOVE_KEYS: Record<MoveName, MessageKey> = {
  [Move.Drop]: 'move.drop',
  [Move.Flip]: 'move.flip',
  [Move.Lift]: 'move.lift',
  [Move.Show]: 'move.show',
};

const CATEGORY_LABEL_KEYS: Record<Category, MessageKey> = {
  [PuzzleCategory.All]: 'category.all',
  [PuzzleCategory.Visual]: 'category.visual',
  [PuzzleCategory.Riddle]: 'category.riddle',
  [PuzzleCategory.Proverb]: 'category.proverb',
  [PuzzleCategory.Mafumbo]: 'category.mafumbo',
};

// Restrained Afro-vibrant accents: each puzzle family gets a recognizable
// color cue while the shared studio, typography, and controls stay consistent.
const CATEGORY_ACCENTS: Record<Category, string> = {
  [PuzzleCategory.All]: '#F5D90A',
  [PuzzleCategory.Visual]: '#F5D90A',
  [PuzzleCategory.Riddle]: '#35B7AE',
  [PuzzleCategory.Proverb]: '#E8A06A',
  [PuzzleCategory.Mafumbo]: '#B9A7FF',
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
  rushes: { required: [Rush] },
  orbs: { required: [AnswerOrb] },
  pressedOrbs: { required: [AnswerOrb, Pressed] },
}) {
  private puzzle?: Puzzle;
  private isVisual = true;
  // Height above the table where objects rest on the display stand.
  private standSeat = 0;
  // Set when a "Read it out" press found no on-device voice, until the next
  // puzzle; the button then says so.
  private noVoice = false;
  private lastVisibility: VisibilityState = VisibilityState.NonImmersive;
  // Whether this visual puzzle introduces its move ("New move!"), and, in
  // practice, whether the last try was the right object with the wrong move.
  private moveIsNew = false;
  private wrongMoveShown = false;
  // Seconds each held tile has been raised above the eyes, and tiles whose
  // lift already counted during the current hold.
  private readonly liftTime = new Map<Entity, number>();
  private readonly showTime = new Map<Entity, number>();
  // Tiles whose lift or show already answered during the current hold.
  private readonly answeredInHold = new Set<Entity>();
  private rush?: Entity;
  private readonly rushPosition = new Vector3();
  private readonly headPosition = new Vector3();
  private readonly tileUp = new Vector3();
  private board?: Entity;
  private tray?: Entity;
  private readonly tileBySlot: Entity[] = [];
  private readonly tileLabels: (UIKitMLAsset | undefined)[] = [];
  private readonly tileModels: (import('@iwsdk/core').Group | undefined)[] = [];
  // The word each tile stands for this round ('' when tiles are stowed).
  private readonly tileWords: string[] = [];
  private readonly tileBaseMaterials: (Material | Material[] | undefined)[] = [];
  private readonly tileHiddenMaterials: (Material | Material[] | undefined)[] = [];
  private readonly worldMaterials: Array<{
    material: MeshStandardMaterial;
    baseColor: number;
    role: 'floor' | 'stage';
  }> = [];
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
    | 'exitLabel'
    | 'read'
    | 'readLabel'
    | 'home'
    | 'homePage'
    | 'puzzlePage',
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
    read: null,
    readLabel: null,
    home: null,
    homePage: null,
    puzzlePage: null,
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
      // Every choice sits on the same display stand, picked up with it;
      // a word card stands set into the stand's top. The imported stand
      // when it loaded, else the code-built one.
      const imported = AssetManager.getGLTF('display-stand')?.scene;
      const stand = imported ? fitImportedStand(imported) : builtStand();
      stand.object.position.y = TILE_FLOOR_Y;
      tile.object3D!.add(stand.object);
      this.standSeat = stand.seatHeight;
      // Each round either hides the printed slab behind a miniature (the
      // tile stays the grabbable hit target) or shows the word on it.
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
    this.captureWorldMaterials();

    // One screen with two pages: home, then the puzzle page.
    const panel = this.world.getSceneObject<UIKitMLAsset>('screen');
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
      read: panel?.getElementById('puzzle-read') ?? null,
      readLabel: panel?.getElementById('puzzle-read-label') ?? null,
      home: panel?.getElementById('puzzle-home') ?? null,
      homePage: panel?.getElementById('home-page') ?? null,
      puzzlePage: panel?.getElementById('puzzle-page') ?? null,
    };
    const next = () => this.onNextPressed();
    const run = () => this.startRun();
    const exit = () => this.exitToPractice();
    const category = () => this.cycleCategory();
    const read = () => this.readPuzzle(true);
    const home = () => this.goHome();

    // The home page offers direct entry into each puzzle world. Selecting
    // a world filters both practice browsing and the three-minute run draw.
    const worldButtons: Array<[string, Category]> = [
      ['world-visual', PuzzleCategory.Visual],
      ['world-riddle', PuzzleCategory.Riddle],
      ['world-proverb', PuzzleCategory.Proverb],
      ['world-mafumbo', PuzzleCategory.Mafumbo],
    ];
    const worldCleanup = worldButtons.flatMap(([id, selectedCategory]) => {
      const button = panel?.getElementById(id);
      if (!button) return [];
      const selectWorld = () => {
        const board = this.board;
        if (!board) return;
        const available = categoryIndices(PUZZLES, selectedCategory);
        if (available.length === 0) return;
        board.setValue(PuzzleBoard, 'mode', PuzzleMode.Practice);
        board.setValue(PuzzleBoard, 'category', selectedCategory);
        this.startRound(available[0]);
        button.setProperties({ borderColor: CATEGORY_ACCENTS[selectedCategory] });
      };
      button.addEventListener('click', selectWorld);
      return [() => button.removeEventListener('click', selectWorld)];
    });

    this.elements.next?.addEventListener('click', next);
    this.elements.run?.addEventListener('click', run);
    this.elements.exit?.addEventListener('click', exit);
    this.elements.category?.addEventListener('click', category);
    this.elements.read?.addEventListener('click', read);
    this.elements.home?.addEventListener('click', home);

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
      () => this.elements.read?.removeEventListener('click', read),
      () => this.elements.home?.removeEventListener('click', home),
      // Entering VR is the first moment a headset player can hear the
      // puzzle; a blurred session holds the voice along with the clock.
      this.world.visibilityState.subscribe((state) => {
        pauseSpeaking(state === VisibilityState.VisibleBlurred);
        if (
          state === VisibilityState.Visible &&
          this.lastVisibility === VisibilityState.NonImmersive
        ) {
          this.readPuzzle(false);
        }
        this.lastVisibility = state;
      }),
      stopSpeaking,
      ...worldCleanup,
      this.queries.pressedOrbs.subscribe('qualify', (orb) => {
        this.onOrbPressed(orb);
      }),
      this.queries.heldTiles.subscribe('qualify', (tile) => {
        this.settling.delete(tile);
        this.liftTime.delete(tile);
        this.showTime.delete(tile);
      }),
      this.queries.rushes.subscribe('qualify', (entity) => {
        this.rush = entity;
      }),
      this.queries.heldTiles.subscribe('disqualify', (tile) => {
        this.onTileReleased(tile);
      }),
      onLanguageChange(() => this.render()),
    );
    for (const entity of this.queries.rushes.entities) {
      this.rush = entity;
    }
    // The game opens on the home page; a world's button starts its first
    // puzzle.
    if (this.mode() === PuzzleMode.Home) {
      this.goHome();
    } else {
      this.startRound(this.board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0);
    }
    for (const model of IMPORTED_OBJECTS) {
      AssetManager.loadGLTFById(objectAssetId(model))
        .then(() => this.swapInImported(model))
        // A model that fails to load keeps its code-built stand-in.
        .catch(() => undefined);
    }
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
      this.player.head.getWorldPosition(this.headPosition);
      for (const tile of this.queries.heldTiles.entities) {
        overTray ||= this.isOverTray(tile.object3D!.position);
        this.trackLift(tile, delta);
        this.trackShow(tile, delta);
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
    this.applyWorldTheme(this.category());
    board.setValue(PuzzleBoard, 'puzzleIndex', wrapped);
    board.setValue(PuzzleBoard, 'status', PuzzleStatus.Playing);
    if (this.mode() !== PuzzleMode.Run) {
      // A run keeps its global clock; practice restarts the per-puzzle one.
      board.setValue(PuzzleBoard, 'secondsLeft', ROUND_SECONDS);
    }
    board.setValue(PuzzleBoard, 'wrongAnswers', 0);
    board.setValue(PuzzleBoard, 'wrongMoves', 0);
    this.advanceIn = 0;
    this.wrongMoveShown = false;
    this.liftTime.clear();
    this.showTime.clear();
    this.answeredInHold.clear();
    if (this.isVisual) {
      // The game, not the puzzle, picks the move, one new move at a time.
      const seen = readMovesSeen();
      const { move, isNew } = pickMove(seen, Math.random());
      board.setValue(PuzzleBoard, 'move', move);
      this.moveIsNew = isNew;
      writeMovesSeen(seen + 1);
    }
    this.settling.clear();
    this.orbFlash.clear();

    const tileLabels = this.isVisual ? shuffled(puzzle.tiles ?? []) : [];
    this.tileBySlot.forEach((tile, slot) => {
      const label = tileLabels[slot] ?? '';
      tile.setValue(PuzzleTile, 'correct', label === puzzle.answer);
      this.tileWords[slot] = this.isVisual ? label : '';
      this.setTileModel(slot);
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
    this.noVoice = false;
    this.render();
    this.readPuzzle(false);
  }

  /**
   * Reads the puzzle aloud: on its own for each new puzzle while read-aloud
   * is on, or whenever the player presses "Read it out". The player still
   * answers by choosing a tile or an orb.
   */
  private readPuzzle(asked: boolean): void {
    const puzzle = this.puzzle;
    if (
      !puzzle ||
      this.mode() === PuzzleMode.RunOver ||
      this.mode() === PuzzleMode.Home ||
      (!asked && !isReadAloudOn())
    ) {
      return;
    }
    // The move is part of what to listen for. Its verb is in capitals on
    // the panel; spoken, it is a plain word (some voices spell capitals).
    const move = this.moveText().replace(/\b[A-Z]{2,}\b/gu, (word) =>
      word.toLowerCase(),
    );
    const text = this.isVisual
      ? `${puzzle.prompt} ${move}`
      : puzzle.question
        ? `${puzzle.prompt} ${puzzle.question}`
        : puzzle.prompt;
    const spoken = speak(text, puzzle.lang);
    if (asked) {
      this.noVoice = !spoken;
      this.render();
    }
  }

  private onOrbPressed(orb: Entity): void {
    const board = this.board;
    if (
      !board ||
      this.isVisual ||
      this.status() !== PuzzleStatus.Playing ||
      this.mode() === PuzzleMode.Home
    ) {
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
    this.liftTime.delete(tile);
    this.showTime.delete(tile);
    // A lift or show already answered during this hold; letting go adds
    // nothing.
    const answered = this.answeredInHold.delete(tile);
    const object = tile.object3D!;
    this.tileUp.set(0, 1, 0).applyQuaternion(object.quaternion);
    const made = releaseMove(
      this.tileUp.y < FLIPPED_UP_Y,
      this.isOverTray(object.position),
    );
    // At home the table is cleared: a tile let go there answers nothing.
    if (!answered && made && this.mode() !== PuzzleMode.Home) {
      this.answer(tile, made);
    }
    this.settling.add(tile);
  }

  /** Counts a held tile kept above the eyes for LIFT_SECONDS as a lift. */
  private trackLift(tile: Entity, delta: number): void {
    if (
      this.answeredInHold.has(tile) ||
      tile.object3D!.position.y < this.headPosition.y + LIFT_ABOVE_EYES
    ) {
      this.liftTime.delete(tile);
      return;
    }
    const held = (this.liftTime.get(tile) ?? 0) + delta;
    if (held < LIFT_SECONDS) {
      this.liftTime.set(tile, held);
      return;
    }
    this.liftTime.delete(tile);
    this.answeredInHold.add(tile);
    this.answer(tile, Move.Lift);
  }

  /** Counts a held tile kept up close to RUSH for SHOW_SECONDS as a show. */
  private trackShow(tile: Entity, delta: number): void {
    const rush = this.rush?.object3D;
    if (!rush || this.answeredInHold.has(tile)) {
      this.showTime.delete(tile);
      return;
    }
    rush.getWorldPosition(this.rushPosition);
    if (
      tile.object3D!.position.distanceTo(this.rushPosition) > SHOW_DISTANCE
    ) {
      this.showTime.delete(tile);
      return;
    }
    const held = (this.showTime.get(tile) ?? 0) + delta;
    if (held < SHOW_SECONDS) {
      this.showTime.set(tile, held);
      return;
    }
    this.showTime.delete(tile);
    this.answeredInHold.add(tile);
    this.answer(tile, Move.Show);
  }

  /** Judges a tile answered with `made`: object first, then the move. */
  private answer(tile: Entity, made: MoveName): void {
    const board = this.board;
    if (
      !board ||
      !this.isVisual ||
      this.status() !== PuzzleStatus.Playing
    ) {
      return;
    }
    const verdict = judge(
      made,
      this.move(),
      tile.getValue(PuzzleTile, 'correct') ?? false,
    );
    if (verdict === 'solved') {
      this.onSolved();
    } else if (verdict === 'wrongMove') {
      this.onWrongMove();
    } else {
      this.wrongMoveShown = false;
      const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
      board.setValue(PuzzleBoard, 'wrongAnswers', wrong + 1);
    }
    this.render();
  }

  /**
   * The right object with the wrong move. A run counts the puzzle as lost
   * and moves on after the usual beat; practice says so and lets you retry.
   */
  private onWrongMove(): void {
    const board = this.board!;
    board.setValue(
      PuzzleBoard,
      'wrongMoves',
      (board.getValue(PuzzleBoard, 'wrongMoves') ?? 0) + 1,
    );
    if (this.mode() === PuzzleMode.Run) {
      stopSpeaking();
      this.board!.setValue(PuzzleBoard, 'status', PuzzleStatus.WrongMove);
      this.advanceIn = SOLVE_BEAT_SECONDS;
    } else {
      this.wrongMoveShown = true;
    }
  }

  /** The move line under the clue, with "New move!" when it is new. */
  private moveText(): string {
    const move = t(MOVE_KEYS[this.move()]);
    return this.moveIsNew ? `${t('move.new')} ${move}` : move;
  }

  private move(): MoveName {
    return (this.board?.getValue(PuzzleBoard, 'move') ?? Move.Drop) as MoveName;
  }

  private mode(): Mode {
    return (this.board?.getValue(PuzzleBoard, 'mode') ??
      PuzzleMode.Practice) as Mode;
  }

  private category(): Category {
    return (this.board?.getValue(PuzzleBoard, 'category') ??
      PuzzleCategory.All) as Category;
  }

  /**
   * Capture per-instance copies of the shared floor and stage materials so
   * each selected category can tint its environment without changing the
   * source asset or other placements.
   */
  private captureWorldMaterials(): void {
    const targets: Array<[string, 'floor' | 'stage']> = [
      ['studio-floor', 'floor'],
      ['stage', 'stage'],
    ];
    for (const [id, role] of targets) {
      const entity = this.world.getSceneEntity(id);
      if (!entity?.object3D) continue;
      entity.object3D.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const original = Array.isArray(object.material)
          ? object.material
          : [object.material];
        const copies = original.map((source) => {
          if (!(source instanceof MeshStandardMaterial)) return source;
          const material = source.clone();
          this.worldMaterials.push({
            material,
            baseColor: source.color.getHex(),
            role,
          });
          return material;
        });
        object.material = Array.isArray(object.material) ? copies : copies[0];
      });
    }
  }

  /** A restrained color mood for each world; the table and puzzle stay familiar. */
  private applyWorldTheme(category: Category): void {
    const themes: Record<Category, { floor: string; stage: string }> = {
      [PuzzleCategory.All]: { floor: '#18203F', stage: '#D9A440' },
      [PuzzleCategory.Visual]: { floor: '#202A50', stage: '#D9A440' },
      [PuzzleCategory.Riddle]: { floor: '#172E43', stage: '#35B7AE' },
      [PuzzleCategory.Proverb]: { floor: '#382A32', stage: '#E8A06A' },
      [PuzzleCategory.Mafumbo]: { floor: '#27213F', stage: '#B9A7FF' },
    };
    const theme = themes[category] ?? themes[PuzzleCategory.All];
    for (const entry of this.worldMaterials) {
      entry.material.color.set(entry.baseColor);
      entry.material.color.multiplyScalar(1);
      entry.material.color.set(
        entry.role === 'floor' ? theme.floor : theme.stage,
      );
    }
  }

  /**
   * Puts the miniature for the tile's current word on its stand, replacing
   * the previous one: the owner's imported model once it has loaded, else
   * the code-built one; a word with no miniature is printed on the slab.
   */
  private setTileModel(slot: number): void {
    const tile = this.tileBySlot[slot];
    const label = this.tileWords[slot] ?? '';
    const previousModel = this.tileModels[slot];
    if (previousModel) {
      tile.object3D!.remove(previousModel);
      disposePuzzleObject(previousModel);
      this.tileModels[slot] = undefined;
    }
    const model = label
      ? createPuzzleObject(label, importedObject(label))
      : undefined;
    if (model) {
      // On top of the stand, while the tile's slab remains invisible.
      // Add to the offset createPuzzleObject set, which puts the model's
      // base on its origin: an imported model is centred on its middle.
      model.position.y += TILE_FLOOR_Y + this.standSeat;
      tile.object3D!.add(model);
      this.tileModels[slot] = model;
    }
    this.showSlab(slot, !model);
    this.tileLabels[slot]
      ?.getElementById('tile-text')
      ?.setProperties({ text: model ? '' : label });
  }

  /**
   * Imported miniatures load in the background, so the first puzzle can
   * start with code-built stand-ins. As each one arrives, swap it onto any
   * tile still showing the stand-in, without restarting the round.
   */
  private swapInImported(model: TileModel): void {
    this.tileWords.forEach((label, slot) => {
      if (
        tileModelFor(label) === model &&
        !this.tileModels[slot]?.userData.imported
      ) {
        this.setTileModel(slot);
      }
    });
  }

  /** Shows a tile's slab and printed word, or hides both for a miniature. */
  private showSlab(slot: number, visible: boolean): void {
    const tileMesh = this.tileBySlot[slot]?.object3D;
    const material = visible
      ? this.tileBaseMaterials[slot]
      : this.tileHiddenMaterials[slot];
    if (tileMesh instanceof Mesh && material) tileMesh.material = material;
    const label = this.tileLabels[slot];
    if (label) label.visible = visible;
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
    stopSpeaking();
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
    stopSpeaking();
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

  /**
   * Back to the home page: the voice stops, the table clears and RUSH rests
   * at full size until a world is picked. Not offered during a run.
   */
  private goHome(): void {
    const board = this.board;
    if (!board || this.mode() === PuzzleMode.Run) {
      return;
    }
    stopSpeaking();
    board.setValue(PuzzleBoard, 'mode', PuzzleMode.Home);
    board.setValue(PuzzleBoard, 'status', PuzzleStatus.Playing);
    board.setValue(PuzzleBoard, 'secondsLeft', ROUND_SECONDS);
    board.setValue(PuzzleBoard, 'wrongAnswers', 0);
    board.setValue(PuzzleBoard, 'wrongMoves', 0);
    this.advanceIn = 0;
    this.settling.clear();
    this.orbFlash.clear();
    this.tileBySlot.forEach((tile, slot) =>
      this.place(tile, this.tileHomes[slot], false),
    );
    this.orbBySlot.forEach((orb, slot) =>
      this.place(orb, this.orbHomes[slot], false),
    );
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
    const mode = this.mode();
    // The screen shows one page at a time.
    const atHome = mode === PuzzleMode.Home;
    this.elements.homePage?.setProperties({ display: atHome ? 'flex' : 'none' });
    this.elements.puzzlePage?.setProperties({
      display: atHome ? 'none' : 'flex',
    });
    if (!puzzle || !board || atHome) {
      return;
    }
    const status = this.status();
    const wrong = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
    const score = board.getValue(PuzzleBoard, 'score') ?? 0;

    let statusText = this.isVisual
      ? this.moveText()
      : t('puzzle.instructionsOrbs');
    const accent = CATEGORY_ACCENTS[puzzle.type as Category] ?? CATEGORY_ACCENTS[PuzzleCategory.All];
    let statusColor = accent;
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
    } else if (status === PuzzleStatus.WrongMove || this.wrongMoveShown) {
      statusText = t('puzzle.wrongMove');
      statusColor = STATUS_COLORS.wrong;
      // Under the verdict, the move that was asked for.
      detail = t(MOVE_KEYS[this.move()]);
    } else if (wrong > 0) {
      statusText = t('puzzle.wrong');
      statusColor = STATUS_COLORS.wrong;
      detail = `${t('puzzle.hint')} ${puzzle.hint}`;
    }

    this.elements.prompt?.setProperties({ text: puzzle.prompt });
    this.elements.question?.setProperties({
      text: puzzle.question ?? ' ',
      display: puzzle.question ? 'flex' : 'none',
      color: accent,
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
    // The button face is light, so its label keeps the kit's dark text: the
    // bright category accents are only readable on the dark panel itself.
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
    this.elements.read?.setProperties({
      display: mode === PuzzleMode.RunOver ? 'none' : 'flex',
    });
    // Home is offered whenever no run is under way.
    this.elements.home?.setProperties({
      display: mode === PuzzleMode.Run ? 'none' : 'flex',
    });
    this.elements.readLabel?.setProperties({
      text: this.noVoice ? t('readAloud.noVoice') : t('readAloud.again'),
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

/**
 * A fresh copy of the owner's imported model for `label`, once its
 * background load has finished; undefined means use the code-built one.
 */
function importedObject(label: string): Object3D | undefined {
  const model = tileModelFor(label);
  if (!model || !IMPORTED_OBJECTS.includes(model)) {
    return undefined;
  }
  return AssetManager.getGLTF(objectAssetId(model))?.scene ?? undefined;
}

function readMovesSeen(): number {
  try {
    const value = Number(localStorage.getItem(MOVES_SEEN_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeMovesSeen(seen: number): void {
  try {
    // Capped: past every introduction the count no longer matters.
    localStorage.setItem(MOVES_SEEN_KEY, String(Math.min(seen, 99)));
  } catch {
    // Storage can be blocked (private mode); moves then restart next visit.
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
