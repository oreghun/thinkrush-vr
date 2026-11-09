import {
  type AnimationAction,
  AnimationClip,
  AnimationMixer,
  AssetManager,
  createSystem,
  type Entity,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from '@iwsdk/core';
import { Move } from './moves.js';
import { PuzzleBoard } from './puzzle-components.js';
import { PUZZLES } from './puzzles.js';
import { isSpeaking } from './read-aloud.js';
import {
  BODY,
  type BodyView,
  bodyEvent,
  CLIP,
  type ClipKey,
  type EventView,
  type Place,
  REACTION_SECONDS,
  reactionClip,
  seatedShare,
  SHOW_SPOT,
  shouldRun,
  sitSpot,
  type Spot,
  STAGE_SPOT,
  standingClip,
  turnToward,
  wantedPlace,
  yawToward,
} from './rush-body-plan.js';
import { Rush } from './rush-component.js';
import { GirlFace } from './rush-face.js';
import { type MoodName, timeFraction } from './rush-mood.js';
import { RUSH_RADIUS } from './scene-assets/rush.scene-asset.js';

// Moves blend into each other over this long, so she never snaps.
const FADE = 0.3;
// How fast she turns on the spot (radians a second), and how close to her
// spot counts as there.
const TURN_RATE = 5;
const ARRIVED = 0.04;
// She only steps forward while facing about the way she is going.
const STEP_ANGLE = 0.6;
// Standing up is sitting down played backwards, this much faster.
const STAND_UP_SPEED = 1.6;
// Her knee bones, which straighten while she sits (BODY.sitKnee).
const KNEES = ['mixamorigLeftLeg', 'mixamorigRightLeg'];
const KNEE_AXIS = new Vector3(1, 0, 0);

type Activity = 'stand' | 'move' | 'sitDown' | 'sit' | 'standUp';

/**
 * RUSH's body: the owner's rigged character (public/models/rush/), loaded
 * in the background. Until it arrives (or if it never does) the floating
 * RUSH plays as before. Once it is in, she is a cartoon girl with her own
 * head and face, and no glow (owner, 2026-11-03: the screen clock, the
 * music and her acting show the time). The floating RUSH's parts stay as a
 * hidden ball riding her head bone, sized to her head, which the SHOW move
 * is measured from. This system walks her about and plays her moves from
 * the board (src/rush-body-plan.ts): by the table during a puzzle, to her
 * pouf at home, within reach for the SHOW move, talking while she reads, a
 * cheer, a dance, a shrug or a facepalm after each answer. She moves; the
 * player's view never does.
 */
export class RushBodySystem extends createSystem({
  rushes: { required: [Rush] },
  boards: { required: [PuzzleBoard] },
}) {
  private rush?: Entity;
  private mixer?: AnimationMixer;
  private readonly actions = new Map<ClipKey, AnimationAction>();
  private current?: AnimationAction;
  private activity: Activity = 'stand';
  private activityLeft = 0;
  private reactionLeft = 0;
  private homeSeconds = 0;
  // A hello that came while she was getting up or on her way: she waves
  // when she arrives.
  private helloPending = false;
  private yaw = 0;
  private lift = 0;
  private seat?: Spot;
  // How far she has sat down: 0 standing, 1 seated (follows the clip).
  private seated = 0;
  private knees: Object3D[] = [];
  // Each knee as the clips left it, before the sitting turn went on.
  private readonly kneeBase = KNEES.map(() => new Quaternion());
  private kneesTurned = false;
  private readonly kneeTurn = new Quaternion();
  private readonly feet = new Vector3();
  private readonly scratch = new Vector3();
  // Her moving face (lids, mouth), and two markers that ride her head and
  // neck at the mouth's place: the mouth sits between them each frame.
  private girl?: GirlFace;
  private readonly mouthOnHead = new Object3D();
  private readonly mouthOnNeck = new Object3D();
  private readonly headPoint = new Vector3();
  private readonly neckPoint = new Vector3();
  private readonly headTurn = new Quaternion();
  private readonly neckTurn = new Quaternion();
  private readonly rootTurn = new Quaternion();
  private faceTime = 0;
  private readonly view: BodyView = {
    mode: '',
    phase: '',
    status: '',
    paused: false,
    speaking: false,
    fraction: 1,
    showMove: false,
    homeSeconds: 0,
  };
  private readonly seen: EventView = blankEvents();
  private readonly now: EventView = blankEvents();

  init(): void {
    AssetManager.loadGLTFById('rush-body')
      .then(() => this.embody())
      // No body: the floating RUSH carries on.
      .catch(() => undefined);
  }

  /** Puts RUSH's head on the body and starts her moves. */
  private embody(): void {
    const rush = this.queries.rushes.entities.values().next().value;
    const root = rush?.object3D;
    const gltf = AssetManager.getGLTF('rush-body');
    if (!rush || !root || !gltf || this.mixer) return;
    const model = gltf.scene;
    const head = model.getObjectByName('mixamorigHead');
    if (!head) return;
    this.rush = rush;
    rush.setValue(Rush, 'embodied', true);

    // The floating RUSH's parts become a hidden ball the size of her head,
    // riding it: the SHOW move is measured from it (Rush/Body).
    const face = new Group();
    face.name = 'Rush/Face';
    for (const part of [...root.children]) face.add(part);
    face.position.set(0, BODY.headCenterY, 0);
    face.scale.setScalar(BODY.headRadius / RUSH_RADIUS);
    face.visible = false;

    // Her feet go on the floor at her spot by the table, facing the seat.
    root.scale.setScalar(1);
    root.rotation.set(0, 0, 0);
    this.feet.set(STAGE_SPOT.x, 0, STAGE_SPOT.z);
    this.yaw = yawToward(STAGE_SPOT, { x: 0, z: 0 });
    this.place(root);
    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        // Animated limbs reach outside the resting bounds.
        object.frustumCulled = false;
      }
    });
    root.add(model, face);
    root.updateMatrixWorld(true);
    // The ball now rides the head bone, keeping where it is.
    head.attach(face);

    // Her moving face, built at rest like the ball: the lids ride her head
    // bone; the mouth is placed each frame between her head and neck.
    let skin: MeshStandardMaterial | undefined;
    model.traverse((object) => {
      if (object instanceof SkinnedMesh && object.material instanceof MeshStandardMaterial) {
        skin = object.material;
      }
    });
    const neck = model.getObjectByName('mixamorigNeck');
    if (skin && neck) {
      const girl = new GirlFace(skin);
      root.add(...girl.lids, girl.mouth, this.mouthOnHead, this.mouthOnNeck);
      root.updateMatrixWorld(true);
      for (const lid of girl.lids) head.attach(lid);
      head.attach(this.mouthOnHead);
      neck.attach(this.mouthOnNeck);
      this.girl = girl;
    }

    const seat = this.world.getSceneEntity('pouf')?.object3D;
    if (seat) {
      seat.getWorldPosition(this.scratch);
      this.seat = { x: this.scratch.x, z: this.scratch.z };
    }

    this.knees = KNEES.map((name) => model.getObjectByName(name)).filter(
      (bone): bone is Object3D => bone !== undefined,
    );
    this.mixer = new AnimationMixer(model);
    for (const [key, name] of Object.entries(CLIP) as [ClipKey, string][]) {
      const clip = AnimationClip.findByName(gltf.animations, name);
      if (clip) this.actions.set(key, this.mixer.clipAction(clip));
    }
    this.playMove('idle');
  }

  update(delta: number): void {
    const root = this.rush?.object3D;
    const board = this.queries.boards.entities.values().next().value;
    if (!this.mixer || !root || !board) return;
    this.read(board, delta);

    let event = bodyEvent(this.seen, this.now);
    copyEvents(this.now, this.seen);
    if (event === 'hello' && this.activity !== 'stand') {
      this.helloPending = true;
      event = undefined;
    }
    if (this.view.mode === 'home') this.helloPending = false;
    let place = wantedPlace(this.view);
    // No seat in the scene: she waits by the table instead of sitting on air.
    if (place === 'seat' && !this.seat) place = 'stage';
    const goal = this.goal(place);

    switch (this.activity) {
      case 'sit':
        if (place !== 'seat') this.standUp();
        break;
      case 'sitDown':
      case 'standUp': {
        this.activityLeft -= delta;
        // She settles onto the seat as her hips come down (and the reverse
        // as she stands), following the clip, so she never hovers or sinks.
        const sit = this.actions.get('sitDown');
        const length = sit?.getClip().duration ?? 1;
        this.seated = seatedShare((sit?.time ?? 0) / length);
        if (this.activityLeft <= 0) {
          if (this.activity === 'sitDown') {
            this.activity = 'sit';
            this.seated = 1;
            this.playMove('sitting');
          } else {
            this.activity = 'stand';
            this.seated = 0;
          }
        }
        this.lift = BODY.sitLift * this.seated;
        break;
      }
      default:
        this.walk(goal, place, delta, event);
    }
    this.place(root);
    this.restorePose();
    this.mixer.update(delta);
    this.adjustPose();
    this.showFace(root, delta);
    if (this.rush?.getValue(Rush, 'activity') !== this.activity) {
      this.rush?.setValue(Rush, 'activity', this.activity);
    }
  }

  /** Walks towards `goal`, then turns to face its way, then stands or sits. */
  private walk(
    goal: { x: number; z: number; yaw: number },
    place: Place,
    delta: number,
    event: ReturnType<typeof bodyEvent>,
  ): void {
    const dx = goal.x - this.feet.x;
    const dz = goal.z - this.feet.z;
    const distance = Math.hypot(dx, dz);
    if (distance > ARRIVED) {
      const running = shouldRun(place, distance);
      this.activity = 'move';
      this.reactionLeft = 0;
      this.playMove(running ? 'run' : 'walk');
      const heading = Math.atan2(dx, dz);
      this.yaw = turnToward(this.yaw, heading, TURN_RATE * delta);
      if (Math.abs(Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw))) < STEP_ANGLE) {
        const step = Math.min(distance, (running ? BODY.runSpeed : BODY.walkSpeed) * delta);
        this.feet.x += (dx / distance) * step;
        this.feet.z += (dz / distance) * step;
      }
      return;
    }
    this.feet.x = goal.x;
    this.feet.z = goal.z;
    this.yaw = turnToward(this.yaw, goal.yaw, TURN_RATE * delta);
    const facing = Math.abs(Math.atan2(Math.sin(goal.yaw - this.yaw), Math.cos(goal.yaw - this.yaw))) < 0.05;
    if (place === 'seat' && facing) {
      this.activity = 'sitDown';
      const sit = this.actions.get('sitDown');
      this.activityLeft = sit ? sit.getClip().duration : 0;
      this.playMove('sitDown', true);
      return;
    }
    this.activity = 'stand';
    if (!event && this.helloPending) {
      this.helloPending = false;
      event = 'hello';
    }
    if (event) {
      const key = reactionClip(event, Math.random());
      const action = this.actions.get(key);
      this.reactionLeft = Math.min(REACTION_SECONDS, action?.getClip().duration ?? 0);
      this.playMove(key, true);
      return;
    }
    if (this.reactionLeft > 0) {
      this.reactionLeft -= delta;
      return;
    }
    this.playMove(standingClip(this.view));
  }

  /**
   * Adjusts the pose the clips set: her knees straighten as far as she has
   * sat down, so her tucked-back feet clear the side of her seat.
   */
  private adjustPose(): void {
    if (this.seated <= 0) return;
    this.kneeTurn.setFromAxisAngle(KNEE_AXIS, -BODY.sitKnee * this.seated);
    this.knees.forEach((knee, index) => {
      this.kneeBase[index].copy(knee.quaternion);
      knee.quaternion.multiply(this.kneeTurn);
    });
    this.kneesTurned = true;
  }

  /**
   * Places her mouth where her skin there is (it moves with her head and a
   * little with her neck: BODY.mouthHeadShare), and shows her mood and
   * talking on her face.
   */
  private showFace(root: Object3D, delta: number): void {
    const girl = this.girl;
    if (!girl) return;
    this.faceTime += delta;
    this.mouthOnHead.getWorldPosition(this.headPoint);
    this.mouthOnHead.getWorldQuaternion(this.headTurn);
    this.mouthOnNeck.getWorldPosition(this.neckPoint);
    this.mouthOnNeck.getWorldQuaternion(this.neckTurn);
    const share = BODY.mouthHeadShare;
    girl.mouth.position.lerpVectors(this.neckPoint, this.headPoint, share);
    root.worldToLocal(girl.mouth.position);
    root.getWorldQuaternion(this.rootTurn).invert();
    girl.mouth.quaternion
      .slerpQuaternions(this.neckTurn, this.headTurn, share)
      .premultiply(this.rootTurn);
    const mood = String(this.rush?.getValue(Rush, 'mood') ?? 'idle') as MoodName;
    girl.update(mood, isSpeaking(), this.faceTime, delta);
  }

  /** Takes last frame's adjustments off, so they never build up. */
  private restorePose(): void {
    if (!this.kneesTurned) return;
    this.knees.forEach((knee, index) => knee.quaternion.copy(this.kneeBase[index]));
    this.kneesTurned = false;
  }

  private standUp(): void {
    this.activity = 'standUp';
    const sit = this.actions.get('sitDown');
    this.activityLeft = sit ? sit.getClip().duration / STAND_UP_SPEED : 0;
    this.playMove('sitDown', true, -STAND_UP_SPEED);
  }

  /** Where `place` is, and which way she faces there. */
  private goal(place: Place): { x: number; z: number; yaw: number } {
    if (place === 'seat' && this.seat) {
      return sitSpot(this.seat, STAGE_SPOT);
    }
    const spot = place === 'show' ? SHOW_SPOT : STAGE_SPOT;
    return { x: spot.x, z: spot.z, yaw: yawToward(spot, { x: 0, z: 0 }) };
  }

  /** Plays a move, blending from the last; `once` holds its last frame. */
  private playMove(key: ClipKey, once = false, speed = 1): void {
    const next = this.actions.get(key);
    if (!next || (next === this.current && !once)) return;
    next.reset();
    next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    if (speed < 0) next.time = next.getClip().duration;
    next.play();
    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, FADE, false);
    }
    this.current = next;
    this.rush?.setValue(Rush, 'move', key);
  }

  /** Sets her root from her feet, lift and turn (parent frame = world). */
  private place(root: Object3D): void {
    root.position.set(this.feet.x, this.lift, this.feet.z);
    root.rotation.set(0, this.yaw, 0);
  }

  private read(board: Entity, delta: number): void {
    const mode = String(board.getValue(PuzzleBoard, 'mode'));
    const status = String(board.getValue(PuzzleBoard, 'status'));
    const fraction =
      mode === 'home' || mode === 'runOver'
        ? 1
        : timeFraction(
            board.getValue(PuzzleBoard, 'secondsLeft') ?? 0,
            board.getValue(PuzzleBoard, 'answerSeconds') ?? 0,
          );
    this.homeSeconds = mode === 'home' ? this.homeSeconds + delta : 0;
    const view = this.view;
    view.mode = mode;
    view.phase = String(board.getValue(PuzzleBoard, 'phase'));
    view.status = status;
    view.paused = Boolean(board.getValue(PuzzleBoard, 'paused'));
    view.speaking = isSpeaking();
    view.fraction = fraction;
    view.showMove =
      board.getValue(PuzzleBoard, 'move') === Move.Show &&
      PUZZLES[board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0]?.type === 'visual';
    view.homeSeconds = this.homeSeconds;
    this.now.mode = mode;
    this.now.status = status;
    this.now.wrongAnswers = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
    this.now.wrongMoves = board.getValue(PuzzleBoard, 'wrongMoves') ?? 0;
    this.now.fraction = fraction;
  }
}

function blankEvents(): EventView {
  return { mode: 'home', status: 'playing', wrongAnswers: 0, wrongMoves: 0, fraction: 1 };
}

function copyEvents(from: EventView, to: EventView): void {
  to.mode = from.mode;
  to.status = from.status;
  to.wrongAnswers = from.wrongAnswers;
  to.wrongMoves = from.wrongMoves;
  to.fraction = from.fraction;
}
