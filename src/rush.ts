import {
  Color,
  createSystem,
  type Entity,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from '@iwsdk/core';
import { Move } from './moves.js';
import {
  PuzzleBoard,
  PuzzleMode,
  PuzzleStatus,
  ROUND_SECONDS,
  RUN_SECONDS,
} from './puzzle-components.js';
import { PUZZLES } from './puzzles.js';
import { isSpeaking } from './read-aloud.js';
import { Rush } from './rush-component.js';
import {
  EYE_DEPTH,
  EYE_HEIGHT,
  EYE_WIDTH,
} from './scene-assets/rush.scene-asset.js';
import {
  baseMood,
  type BoardView,
  glowColor,
  Mood,
  type MoodName,
  Reaction,
  type ReactionName,
  reactionMood,
  reactionTo,
  rushScale,
  timeFraction,
} from './rush-mood.js';

// How long a reaction plays, and how RUSH moves while it does. All motion
// is RUSH's own: the player's view never moves (comfort contract).
const REACTION_SECONDS = 1.4;
const HOP = { present: 0.025, cheer: 0.05 };
const SHAKE = 0.012;
const BOB = 0.006;
// Eyes blink every few seconds, for a tenth of a second.
const BLINK_SECONDS = 0.12;
// Turning to face the player is smoothed, and never tips too far.
const TURN_RATE = 6;
const PITCH_LIMIT = 0.5;
const SCALE_RATE = 3;
// For the show move RUSH glides to a spot in easy reach of a seated player
// (its usual place beside the panel is beyond the 2 ft airplane-seat test):
// this far from the head, to the right, below the eyes and in front. The
// spot is fixed when the move starts, so RUSH does not follow the head.
// 0.2 m right (not further) keeps RUSH inside Meta VR Glasses' narrower view.
const SHOW_OFFSET = new Vector3(0.2, -0.2, -0.42);
const GLIDE_RATE = 2.5;

interface Eye {
  root: Object3D;
  open: Object3D;
  happy: Object3D;
  side: number;
}

/**
 * RUSH presents each puzzle and reacts to answers, and is the timer: it
 * shrinks and warms from gold to red as the clock runs out, glows while a
 * puzzle is read aloud, turns to face the player, and blinks.
 */
export class RushSystem extends createSystem({
  rushes: { required: [Rush] },
  boards: { required: [PuzzleBoard] },
}) {
  private rush?: Entity;
  private board?: Entity;
  private material?: MeshStandardMaterial;
  private readonly eyes: Eye[] = [];
  // Where RUSH floats beside the panel, the spot it glides to for the
  // show move, and where it is now on the way between them.
  private readonly home = new Vector3();
  private readonly showSpot = new Vector3();
  private readonly anchor = new Vector3();
  private showing = false;
  private readonly head = new Vector3();
  private readonly here = new Vector3();
  private readonly glow = new Color();
  private readonly seen: BoardView = blankView();
  private readonly now: BoardView = blankView();
  private reaction?: ReactionName;
  private reactionLeft = 0;
  private blinkIn = 3;
  private blinkLeft = 0;
  private scale = 1;
  private yaw = 0;
  private pitch = 0;
  private time = 0;

  init(): void {
    this.cleanupFuncs.push(
      this.queries.rushes.subscribe('qualify', (entity) => this.adopt(entity)),
      this.queries.boards.subscribe('qualify', (entity) => {
        this.board = entity;
      }),
    );
    for (const entity of this.queries.rushes.entities) {
      this.adopt(entity);
    }
    for (const entity of this.queries.boards.entities) {
      this.board = entity;
    }
  }

  /** Finds RUSH's parts and gives it its own glow material to change. */
  private adopt(entity: Entity): void {
    const object = entity.object3D;
    if (!object || this.rush) {
      return;
    }
    this.rush = entity;
    this.home.copy(object.position);
    this.anchor.copy(object.position);
    object.rotation.order = 'YXZ';
    const body = object.getObjectByName('Rush/Body');
    if (body instanceof Mesh && body.material instanceof MeshStandardMaterial) {
      this.material = body.material.clone();
      body.material = this.material;
    }
    for (const [name, side] of [
      ['Rush/EyeL', -1],
      ['Rush/EyeR', 1],
    ] as const) {
      const root = object.getObjectByName(name);
      const open = root?.getObjectByName('Open');
      const happy = root?.getObjectByName('Happy');
      if (root && open && happy) {
        this.eyes.push({ root, open, happy, side });
      }
    }
  }

  update(delta: number): void {
    const object = this.rush?.object3D;
    const board = this.board;
    if (!object || !board) {
      return;
    }
    this.time += delta;
    this.read(board);

    const wantsShow =
      (this.now.mode === PuzzleMode.Practice ||
        this.now.mode === PuzzleMode.Run) &&
      this.now.status === PuzzleStatus.Playing &&
      board.getValue(PuzzleBoard, 'move') === Move.Show &&
      PUZZLES[this.now.puzzleIndex]?.type === 'visual';
    if (wantsShow && !this.showing) {
      this.player.head.getWorldPosition(this.showSpot);
      this.showSpot.add(SHOW_OFFSET);
      object.parent?.worldToLocal(this.showSpot);
    }
    this.showing = wantsShow;

    const reaction = reactionTo(this.seen, this.now);
    if (reaction) {
      this.reaction = reaction;
      this.reactionLeft = REACTION_SECONDS;
    }
    copyView(this.now, this.seen);
    if (this.reactionLeft > 0) {
      this.reactionLeft -= delta;
      if (this.reactionLeft <= 0) {
        this.reaction = undefined;
      }
    }
    const lasting = baseMood(this.now);
    const mood = this.reaction ? reactionMood(this.reaction, lasting) : lasting;

    // RUSH is the timer: the run's clock in a run, the puzzle's otherwise;
    // at home and on the run summary no clock runs, so RUSH is full size.
    const mode = this.now.mode;
    const total = mode === PuzzleMode.Run ? RUN_SECONDS : ROUND_SECONDS;
    const fraction =
      mode === PuzzleMode.RunOver || mode === PuzzleMode.Home
        ? 1
        : timeFraction(board.getValue(PuzzleBoard, 'secondsLeft') ?? 0, total);
    this.scale +=
      (rushScale(fraction) - this.scale) * (1 - Math.exp(-SCALE_RATE * delta));
    object.scale.setScalar(this.scale);
    this.shine(fraction, mood);
    this.move(object, delta);
    this.showEyes(mood, delta);
  }

  private read(board: Entity): void {
    this.now.puzzleIndex = board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0;
    this.now.status = String(board.getValue(PuzzleBoard, 'status'));
    this.now.mode = String(board.getValue(PuzzleBoard, 'mode'));
    this.now.wrongAnswers = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
    this.now.wrongMoves = board.getValue(PuzzleBoard, 'wrongMoves') ?? 0;
    this.now.paused = Boolean(board.getValue(PuzzleBoard, 'paused'));
  }

  /** Gold to red with the clock; brighter in pulses while reading aloud. */
  private shine(fraction: number, mood: MoodName): void {
    if (!this.material) {
      return;
    }
    const [r, g, b] = glowColor(fraction);
    this.glow.setRGB(r, g, b);
    this.material.color.copy(this.glow);
    this.material.emissive.copy(this.glow);
    const talking = isSpeaking()
      ? 0.3 * (0.5 + 0.5 * Math.sin(this.time * 14))
      : 0;
    this.material.emissiveIntensity =
      (mood === Mood.Sleepy ? 0.22 : 0.55) + talking;
  }

  /** A gentle float, hops and shakes for reactions, and facing the player. */
  private move(object: Object3D, delta: number): void {
    const progress = this.reaction
      ? 1 - this.reactionLeft / REACTION_SECONDS
      : 1;
    let hop = 0;
    let shake = 0;
    if (
      this.reaction === Reaction.Present ||
      this.reaction === Reaction.Cheer
    ) {
      hop =
        (this.reaction === Reaction.Cheer ? HOP.cheer : HOP.present) *
        Math.sin(Math.PI * Math.min(1, progress * 2));
    } else if (this.reaction) {
      shake = SHAKE * Math.sin(this.time * 40) * (1 - progress);
    }
    this.anchor.lerp(
      this.showing ? this.showSpot : this.home,
      1 - Math.exp(-GLIDE_RATE * delta),
    );
    object.position.set(
      this.anchor.x + shake,
      this.anchor.y + BOB * Math.sin(this.time * 1.8) + Math.max(0, hop),
      this.anchor.z,
    );

    this.player.head.getWorldPosition(this.head);
    object.getWorldPosition(this.here);
    const dx = this.head.x - this.here.x;
    const dy = this.head.y - this.here.y;
    const dz = this.head.z - this.here.z;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, Math.atan2(-dy, Math.hypot(dx, dz))),
    );
    const turn = 1 - Math.exp(-TURN_RATE * delta);
    this.yaw += (yaw - this.yaw) * turn;
    this.pitch += (pitch - this.pitch) * turn;
    object.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Sets both eyes for the mood, with a blink every few seconds. */
  private showEyes(mood: MoodName, delta: number): void {
    this.blinkIn -= delta;
    if (this.blinkIn <= 0) {
      this.blinkLeft = BLINK_SECONDS;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - delta);
    const blinking = this.blinkLeft > 0 && mood !== Mood.Happy;

    let width = 1;
    let height = 1;
    let tilt = 0;
    if (mood === Mood.Worried) {
      height = 0.65;
      tilt = 0.35;
    } else if (mood === Mood.Surprised) {
      width = 1.3;
      height = 1.3;
    } else if (mood === Mood.Sleepy) {
      height = 0.12;
    }
    if (blinking) {
      height = 0.1;
    }
    for (const eye of this.eyes) {
      eye.open.visible = mood !== Mood.Happy;
      eye.happy.visible = mood === Mood.Happy;
      eye.open.scale.set(EYE_WIDTH * width, EYE_HEIGHT * height, EYE_DEPTH);
      // Worried eyes slant down towards the outside. The eye's own root
      // keeps its place on the sphere; only the oval turns.
      eye.open.rotation.z = -eye.side * tilt;
    }
  }
}

function blankView(): BoardView {
  return {
    puzzleIndex: 0,
    status: '',
    mode: '',
    wrongAnswers: 0,
    wrongMoves: 0,
  };
}

function copyView(from: BoardView, to: BoardView): void {
  to.puzzleIndex = from.puzzleIndex;
  to.status = from.status;
  to.mode = from.mode;
  to.wrongAnswers = from.wrongAnswers;
  to.wrongMoves = from.wrongMoves;
  to.paused = from.paused;
}
