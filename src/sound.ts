import {
  AudioContext as SharedAudio,
  createSystem,
  type Entity,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { isSpeaking } from './read-aloud.js';
import { Rush } from './rush-component.js';
import {
  type BoardView,
  Reaction,
  reactionTo,
  timeFraction,
} from './rush-mood.js';
import {
  PuzzleBoard,
  PuzzleMode,
  PuzzleStatus,
  ROUND_SECONDS,
  RUN_SECONDS,
} from './puzzle-components.js';
import {
  BASS,
  CUES,
  type Cue,
  KALIMBA_SEMITONES,
  MELODY,
  musicLayers,
  musicTempo,
  panFor,
  SHAKER,
  SLAP,
  LOOKAHEAD,
  STEPS,
  stepSeconds,
  stepsToCatchUp,
  TEMPO_HOME,
} from './sound-design.js';
import { isSoundOn, onSoundChange } from './sound-settings.js';

const RATE = 22050;
// Notes booked but not yet played, so a rest (solved, time up, paused) can
// cancel them: at most a few steps of four layers fit in LOOKAHEAD.
const PENDING_NOTES = 48;
const LEVELS = { master: 0.9, music: 0.3, cues: 0.55 };
// Under the read-aloud voice the music drops to this share, so every word
// is clear.
const DUCKED = 0.3;
const KALIMBA_ROOT = 261.63; // C4
const VOICE_ROOT = 523.25; // C5
// RUSH's cheer follows the solve chime instead of talking over it.
const CHEER_DELAY = 0.25;

const REACTION_CUES: Record<string, Cue> = {
  [Reaction.Present]: 'present',
  [Reaction.Cheer]: 'cheer',
  [Reaction.Worried]: 'worried',
  [Reaction.Surprised]: 'surprised',
};

/** One mono buffer of `seconds`, filled by `sample(t)` for t in seconds. */
function render(
  context: BaseAudioContext,
  seconds: number,
  sample: (t: number, i: number) => number,
): AudioBuffer {
  const buffer = context.createBuffer(1, Math.round(seconds * RATE), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = sample(i / RATE, i);
  }
  return buffer;
}

// A small seeded noise source, so the shaker and drums sound the same on
// every visit.
function noise(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
}

function kalimba(context: BaseAudioContext, frequency: number): AudioBuffer {
  const click = noise(7);
  return render(context, 0.9, (t) => {
    const body =
      Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / 0.42) +
      0.35 * Math.sin(2 * Math.PI * frequency * 3.01 * t) * Math.exp(-t / 0.08) +
      0.12 * Math.sin(2 * Math.PI * frequency * 5.4 * t) * Math.exp(-t / 0.03);
    const attack = Math.min(1, t / 0.003);
    return 0.5 * attack * body + (t < 0.004 ? 0.15 * click() : 0);
  });
}

function shaker(context: BaseAudioContext): AudioBuffer {
  const grains = noise(11);
  let previous = 0;
  return render(context, 0.09, (t) => {
    const raw = grains();
    // A simple high-pass (the difference of neighbours) makes it bright.
    const bright = raw - previous;
    previous = raw;
    return 0.35 * bright * Math.min(1, t / 0.006) * Math.exp(-t / 0.03);
  });
}

function bassDrum(context: BaseAudioContext): AudioBuffer {
  let phase = 0;
  return render(context, 0.35, (t) => {
    const frequency = 58 + 62 * Math.exp(-t / 0.05);
    phase += (2 * Math.PI * frequency) / RATE;
    return 0.9 * Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / 0.13);
  });
}

function slap(context: BaseAudioContext): AudioBuffer {
  const skin = noise(23);
  return render(context, 0.14, (t) => {
    const tone = Math.sin(2 * Math.PI * 390 * t) * Math.exp(-t / 0.05);
    return 0.5 * (0.6 * tone + 0.5 * skin() * Math.exp(-t / 0.02));
  });
}

/** RUSH's voice: a soft, round tone; each cue note sets its pitch and length. */
function voice(context: BaseAudioContext): AudioBuffer {
  return render(context, 1.2, (t) =>
    0.5 *
    (Math.sin(2 * Math.PI * VOICE_ROOT * t) +
      0.25 * Math.sin(2 * Math.PI * VOICE_ROOT * 2 * t) +
      0.08 * Math.sin(2 * Math.PI * VOICE_ROOT * 3 * t)),
  );
}

export interface Instruments {
  kalimba: AudioBuffer[];
  shaker: AudioBuffer;
  bass: AudioBuffer;
  slap: AudioBuffer;
  voice: AudioBuffer;
}

/** Synthesizes every instrument once (also used to render previews offline). */
export function createInstruments(context: BaseAudioContext): Instruments {
  return {
    kalimba: KALIMBA_SEMITONES.map((semitones) =>
      kalimba(context, KALIMBA_ROOT * 2 ** (semitones / 12)),
    ),
    shaker: shaker(context),
    bass: bassDrum(context),
    slap: slap(context),
    voice: voice(context),
  };
}

/**
 * The game's sound: a groove that speeds up as RUSH (the timer) shrinks,
 * RUSH's voice for its reactions, heard from RUSH's side, and the read-aloud
 * voice kept clear above the music. Everything is synthesized here from
 * src/sound-design.ts; nothing is downloaded. Sound pauses with the game
 * when the headset is taken off, and the home page can switch it off.
 *
 * WebAudio plays each note through a fresh source node (they cannot be
 * restarted), so scheduling creates one small node per note: the one
 * allocation update() makes, and the browser's audio design requires it.
 * Gain nodes are shared, one per loudness.
 */
export class SoundSystem extends createSystem({
  boards: { required: [PuzzleBoard] },
  rushes: { required: [Rush] },
}) {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private cues?: GainNode;
  private pan?: StereoPannerNode;
  private buffers?: Instruments;
  private board?: Entity;
  private rush?: Entity;
  private nextStep = 0;
  private step = 0;
  private bar = 0;
  // Booked notes, a ring of PENDING_NOTES: the source and its start time.
  private readonly pending: (AudioBufferSourceNode | null)[] = new Array(
    PENDING_NOTES,
  ).fill(null);
  private readonly pendingAt = new Float64Array(PENDING_NOTES);
  private pendingNext = 0;
  // One gain node per loudness, shared by every note at that loudness.
  private readonly loudness = new Map<number, GainNode>();
  private ducked = false;
  private readonly now: BoardView = view();
  private readonly seen: BoardView = view();
  private readonly at = new Vector3();

  init(): void {
    let context: AudioContext;
    try {
      context = SharedAudio.getContext() as AudioContext;
    } catch {
      return; // No WebAudio here: the game plays silently.
    }
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = isSoundOn() ? LEVELS.master : 0;
    this.master.connect(context.destination);
    this.music = context.createGain();
    this.music.gain.value = LEVELS.music;
    this.music.connect(this.master);
    this.pan = context.createStereoPanner();
    this.pan.connect(this.master);
    this.cues = context.createGain();
    this.cues.gain.value = LEVELS.cues;
    this.cues.connect(this.pan);
    this.buffers = createInstruments(context);

    // Browsers start audio only after the player touches the page; entering
    // VR is such a touch.
    const wake = () => {
      if (context.state === 'suspended' && isSoundOn()) {
        void context.resume();
      }
    };
    document.addEventListener('pointerdown', wake);
    document.addEventListener('keydown', wake);
    this.cleanupFuncs.push(
      () => document.removeEventListener('pointerdown', wake),
      () => document.removeEventListener('keydown', wake),
      this.world.visibilityState.subscribe((state) => {
        // Headset off or a system menu up: the music waits with the clock.
        if (state === VisibilityState.VisibleBlurred) {
          void context.suspend();
        } else {
          wake();
        }
      }),
      onSoundChange((on) => {
        this.master?.gain.setTargetAtTime(
          on ? LEVELS.master : 0,
          context.currentTime,
          0.05,
        );
        if (on) wake();
      }),
      this.queries.boards.subscribe('qualify', (entity) => {
        this.board = entity;
      }),
      this.queries.rushes.subscribe('qualify', (entity) => {
        this.rush = entity;
      }),
      () => this.master?.disconnect(),
    );
    this.board = this.queries.boards.entities.values().next().value;
    this.rush = this.queries.rushes.entities.values().next().value;
    if (this.board) {
      read(this.board, this.seen);
    }
  }

  update(): void {
    const context = this.context;
    const board = this.board;
    if (!context || !board) {
      return;
    }
    // Follow the board even while audio waits for a first touch, so RUSH
    // never answers late for something that happened before.
    read(board, this.now);
    const running = context.state === 'running';
    if (running) {
      this.react(context.currentTime);
    }
    copy(this.now, this.seen);
    if (!running) {
      return;
    }

    const speaking = isSpeaking();
    if (speaking !== this.ducked) {
      this.ducked = speaking;
      this.music!.gain.setTargetAtTime(
        LEVELS.music * (speaking ? DUCKED : 1),
        context.currentTime,
        0.12,
      );
    }

    const atHome = this.now.mode === PuzzleMode.Home;
    const playing =
      isSoundOn() &&
      !board.getValue(PuzzleBoard, 'paused') &&
      (atHome ||
        ((this.now.mode === PuzzleMode.Practice ||
          this.now.mode === PuzzleMode.Run) &&
          this.now.status === PuzzleStatus.Playing));
    if (!playing) {
      // The groove rests between puzzles and starts again on the bar; notes
      // already booked ahead are cancelled, so it stops on the moment.
      if (this.nextStep !== 0) {
        this.cancelPending(context.currentTime);
      }
      this.nextStep = 0;
      return;
    }
    const fraction = timeFraction(
      board.getValue(PuzzleBoard, 'secondsLeft') ?? 0,
      this.now.mode === PuzzleMode.Run ? RUN_SECONDS : ROUND_SECONDS,
    );
    const bpm = atHome ? TEMPO_HOME : musicTempo(fraction);
    if (this.nextStep === 0) {
      // Starting (again): on the bar, just ahead of now.
      this.nextStep = context.currentTime + 0.05;
      this.step = 0;
    } else {
      // Fallen behind (a long stall): skip whole steps and keep the beat.
      const skip = stepsToCatchUp(
        this.nextStep,
        context.currentTime,
        stepSeconds(bpm),
      );
      for (let i = 0; i < skip; i += 1) {
        this.nextStep += stepSeconds(bpm);
        this.advanceStep();
      }
    }
    const layers = musicLayers(fraction, atHome);
    while (this.nextStep < context.currentTime + LOOKAHEAD) {
      this.playStep(this.nextStep, layers);
      this.nextStep += stepSeconds(bpm);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    this.step = (this.step + 1) % STEPS;
    if (this.step === 0) {
      this.bar = (this.bar + 1) % MELODY.length;
    }
  }

  /** Stops every booked note that has not started by `time`. */
  private cancelPending(time: number): void {
    for (let i = 0; i < PENDING_NOTES; i += 1) {
      const source = this.pending[i];
      if (source && this.pendingAt[i] > time) {
        source.stop();
      }
      this.pending[i] = null;
    }
  }

  private playStep(time: number, layers: ReturnType<typeof musicLayers>): void {
    const buffers = this.buffers!;
    const note = MELODY[this.bar][this.step];
    if (layers.kalimba && note >= 0) {
      this.hit(buffers.kalimba[note], time, 0.8);
    }
    if (layers.shaker && SHAKER[this.step] > 0) {
      this.hit(buffers.shaker, time, SHAKER[this.step]);
    }
    if (layers.bass && BASS[this.step] > 0) {
      this.hit(buffers.bass, time, BASS[this.step]);
    }
    if (layers.slap && SLAP[this.step] > 0) {
      this.hit(buffers.slap, time, SLAP[this.step]);
    }
  }

  private hit(buffer: AudioBuffer, time: number, loudness: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    let gain = this.loudness.get(loudness);
    if (!gain) {
      gain = context.createGain();
      gain.gain.value = loudness;
      gain.connect(this.music!);
      this.loudness.set(loudness, gain);
    }
    source.connect(gain);
    source.start(time);
    this.pending[this.pendingNext] = source;
    this.pendingAt[this.pendingNext] = time;
    this.pendingNext = (this.pendingNext + 1) % PENDING_NOTES;
  }

  /** RUSH answers what just happened on the board, from where it floats. */
  private react(time: number): void {
    let cue: Cue | undefined;
    const reaction = reactionTo(this.seen, this.now);
    if (reaction) {
      cue = REACTION_CUES[reaction];
    }
    if (this.now.status === PuzzleStatus.TimeUp && this.seen.status !== PuzzleStatus.TimeUp) {
      cue = 'sleepy';
    }
    if (this.now.mode === PuzzleMode.RunOver && this.seen.mode !== PuzzleMode.RunOver) {
      cue = 'runOver';
    }
    if (!cue || !isSoundOn()) {
      return;
    }
    this.aimAtRush(time);
    const start = time + (cue === 'cheer' ? CHEER_DELAY : 0.02);
    for (const note of CUES[cue]) {
      this.say(start + note.at, note.pitch, note.length, note.glideFrom);
    }
  }

  private say(time: number, pitch: number, length: number, glideFrom?: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.buffers!.voice;
    source.playbackRate.setValueAtTime(glideFrom ?? pitch, time);
    if (glideFrom !== undefined) {
      source.playbackRate.linearRampToValueAtTime(pitch, time + length * 0.85);
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + 0.012);
    envelope.gain.setValueAtTime(1, time + Math.max(0.013, length - 0.05));
    envelope.gain.linearRampToValueAtTime(0, time + length);
    source.connect(envelope).connect(this.cues!);
    source.start(time);
    source.stop(time + length + 0.02);
  }

  /** Pans RUSH's voice toward where RUSH is, seen from the player's head. */
  private aimAtRush(time: number): void {
    const object = this.rush?.object3D;
    if (!object || !this.pan) {
      return;
    }
    object.getWorldPosition(this.at);
    this.player.head.worldToLocal(this.at);
    this.pan.pan.setValueAtTime(panFor(Math.atan2(this.at.x, -this.at.z)), time);
  }
}

function view(): BoardView {
  return { puzzleIndex: 0, status: '', mode: '', wrongAnswers: 0, wrongMoves: 0 };
}

function read(board: Entity, into: BoardView): void {
  into.puzzleIndex = board.getValue(PuzzleBoard, 'puzzleIndex') ?? 0;
  into.status = String(board.getValue(PuzzleBoard, 'status'));
  into.mode = String(board.getValue(PuzzleBoard, 'mode'));
  into.wrongAnswers = board.getValue(PuzzleBoard, 'wrongAnswers') ?? 0;
  into.wrongMoves = board.getValue(PuzzleBoard, 'wrongMoves') ?? 0;
}

function copy(from: BoardView, to: BoardView): void {
  to.puzzleIndex = from.puzzleIndex;
  to.status = from.status;
  to.mode = from.mode;
  to.wrongAnswers = from.wrongAnswers;
  to.wrongMoves = from.wrongMoves;
}
