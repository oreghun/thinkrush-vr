import {
  AudioContext as SharedAudio,
  createSystem,
  type Entity,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import {
  createEcho,
  createInstruments,
  type Instruments,
  renderLoop,
} from './music-render.js';
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
} from './puzzle-components.js';
import { RoundPhase } from './round-flow.js';
import {
  barSeconds,
  CUES,
  type Cue,
  DUCK,
  duckHeld,
  LEVEL_TEMPO,
  LOOP_BARS,
  MOOD_GAIN,
  MUSIC_LEVELS,
  musicLevel,
  musicMood,
  type MusicLevelName,
  nextBarLine,
  panFor,
} from './sound-design.js';
import { isSoundOn, onSoundChange } from './sound-settings.js';

const LEVELS = { master: 0.9, music: 0.3, cues: 0.55 };
// RUSH's cheer follows the solve chime instead of talking over it.
const CHEER_DELAY = 0.25;
// A level change waits for a bar line at least this far ahead, so it is
// booked on the audio clock in time even when frames stall.
const SWITCH_LEAD = 0.12;
// Levels cross over this quickly on the bar line.
const CROSSFADE = 0.08;
// How much of RUSH's voice reaches the room's echo.
const CUE_ECHO = 0.18;

const REACTION_CUES: Record<string, Cue> = {
  [Reaction.Present]: 'present',
  [Reaction.Cheer]: 'cheer',
  [Reaction.Worried]: 'worried',
  [Reaction.Surprised]: 'surprised',
};

interface LoopPlaying {
  level: MusicLevelName;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** When bar 0 of this loop began (or would have), on the audio clock. */
  start: number;
  bar: number;
}

/**
 * The game's sound: a groove that grows busier and faster as RUSH (the
 * timer) shrinks, RUSH's voice for its reactions, heard from RUSH's side,
 * and the read-aloud voice kept clear above the music. Everything is
 * synthesized in code (src/music-render.ts, src/sound-design.ts); nothing is
 * downloaded. Sound pauses with the game when the headset is taken off, and
 * the home page can switch it off.
 *
 * The music is four pre-rendered loops (home, calm, middle, urgent), each
 * playing on the browser's audio thread: a stalled frame can never cut a
 * note. Levels change only on a bar line, crossing over in 80 ms, with the
 * melody carrying on from the same bar. The music never stops dead: after an
 * answer it plays on softly, and it fades out only when paused, at a run's
 * summary or with sound off.
 */
export class SoundSystem extends createSystem({
  boards: { required: [PuzzleBoard] },
  rushes: { required: [Rush] },
}) {
  private context?: AudioContext;
  private master?: GainNode;
  private moodGain?: GainNode;
  private duckGain?: GainNode;
  private cues?: GainNode;
  private pan?: StereoPannerNode;
  private buffers?: Instruments;
  private readonly loops = new Map<MusicLevelName, AudioBuffer>();
  private playing?: LoopPlaying;
  // A level change is booked for this time on the audio clock.
  private switchAt = 0;
  private mood: 'play' | 'soft' | 'background' | 'off' = 'off';
  private ducked = false;
  private lastSpokeAt = -Infinity;
  private board?: Entity;
  private rush?: Entity;
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
    // A gentle compressor on everything, so cues over music never get harsh.
    const glue = context.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.knee.value = 12;
    glue.ratio.value = 3;
    glue.attack.value = 0.004;
    glue.release.value = 0.2;
    glue.connect(context.destination);
    this.master = context.createGain();
    this.master.gain.value = isSoundOn() ? LEVELS.master : 0;
    this.master.connect(glue);
    // Music: loops -> mood (play, soft, off) -> dip under the voice -> bus.
    const music = context.createGain();
    music.gain.value = LEVELS.music;
    music.connect(this.master);
    this.duckGain = context.createGain();
    this.duckGain.connect(music);
    this.moodGain = context.createGain();
    this.moodGain.gain.value = 0;
    this.moodGain.connect(this.duckGain);
    // RUSH's voice, panned toward RUSH, with a little of the room's echo.
    this.pan = context.createStereoPanner();
    this.pan.connect(this.master);
    this.cues = context.createGain();
    this.cues.gain.value = LEVELS.cues;
    this.cues.connect(this.pan);
    const echo = context.createConvolver();
    echo.buffer = createEcho(context);
    const send = context.createGain();
    send.gain.value = CUE_ECHO;
    this.cues.connect(send).connect(echo).connect(this.master);
    this.buffers = createInstruments(context);
    void this.renderLoops(context.sampleRate);

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
      () => {
        this.playing?.source.stop();
        this.master?.disconnect();
      },
    );
    this.board = this.queries.boards.entities.values().next().value;
    this.rush = this.queries.rushes.entities.values().next().value;
    if (this.board) {
      read(this.board, this.seen);
    }
  }

  /** Renders the loops one by one, home first: it plays at once. */
  private async renderLoops(sampleRate: number): Promise<void> {
    for (const level of MUSIC_LEVELS) {
      try {
        this.loops.set(level, await renderLoop(level, sampleRate, this.buffers));
      } catch {
        return; // No offline rendering here: the game plays without music.
      }
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
    const time = context.currentTime;

    // RUSH reading a question or naming its choices: the music sits in
    // the background until the answer clock starts.
    const reading =
      board.getValue(PuzzleBoard, 'phase') !== RoundPhase.Answering;
    const mood = musicMood(
      this.now.mode,
      this.now.status,
      board.getValue(PuzzleBoard, 'paused') ?? false,
      isSoundOn(),
      reading,
    );
    if (mood !== this.mood) {
      this.mood = mood;
      this.moodGain!.gain.setTargetAtTime(MOOD_GAIN[mood], time, mood === 'off' ? 0.3 : 0.25);
    }

    // One gentle dip for any other read-aloud (Read it out, the tour),
    // held through its pauses; in the background mood the music is already
    // low, so it does not dip again.
    const speaking = isSpeaking();
    if (speaking) this.lastSpokeAt = time;
    const ducked =
      mood !== 'background' && duckHeld(speaking, this.lastSpokeAt, time);
    if (ducked !== this.ducked) {
      this.ducked = ducked;
      this.duckGain!.gain.setTargetAtTime(ducked ? DUCK.gain : 1, time, ducked ? 0.12 : 0.5);
    }

    const fraction = timeFraction(
      board.getValue(PuzzleBoard, 'secondsLeft') ?? 0,
      board.getValue(PuzzleBoard, 'answerSeconds') ?? 0,
    );
    this.followLevel(musicLevel(fraction, this.now.mode === PuzzleMode.Home), time);
  }

  /**
   * Plays `level`'s loop. A change waits for the next bar line of the loop
   * playing and carries the melody on from the same bar, so it never jumps
   * mid-phrase; both are booked on the audio clock, so a stalled frame
   * cannot break them.
   */
  private followLevel(level: MusicLevelName, now: number): void {
    const playing = this.playing;
    if (playing?.level === level || now < this.switchAt) {
      return;
    }
    const buffer = this.loops.get(level);
    if (!buffer) {
      return; // Still rendering: keep what is playing.
    }
    const context = this.context!;
    const bar = barSeconds(LEVEL_TEMPO[level]);
    let when = now + 0.05;
    let offset = 0;
    if (playing) {
      const line = nextBarLine(playing.start, playing.bar, now + SWITCH_LEAD);
      when = line.time;
      offset = (line.bars % LOOP_BARS) * bar;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = LOOP_BARS * bar;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + CROSSFADE);
    source.connect(gain).connect(this.moodGain!);
    source.start(when, offset);
    if (playing) {
      playing.gain.gain.setValueAtTime(1, when);
      playing.gain.gain.linearRampToValueAtTime(0, when + CROSSFADE);
      playing.source.stop(when + CROSSFADE + 0.02);
    }
    this.playing = { level, source, gain, start: when - offset, bar };
    this.switchAt = when;
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
