// The game's music and RUSH's voice, as data: composed for ThinkRush and
// played by src/sound.ts with the browser's WebAudio synthesizer, so no
// recorded or third-party audio ships (and the build stays the same size).
//
// The music is a light groove on a five-note (pentatonic) scale: plucked
// kalimba-like notes, a shaker, a low and a high hand drum. RUSH is the
// timer, and the music is its heartbeat: as the clock runs down the tempo
// rises and the drums join in.
//
// No runtime imports, so Node's test runner can check it.

/** Steps per bar: sixteenth notes. */
export const STEPS = 16;

// Tempo with a full clock and an empty one (beats per minute); calmer at home.
export const TEMPO_FULL = 92;
export const TEMPO_EMPTY = 140;
export const TEMPO_HOME = 84;

/** The tempo for the share of the clock left (1 = full, 0 = out of time). */
export function musicTempo(fraction: number): number {
  const left = Math.min(1, Math.max(0, fraction));
  // Eased so most of the speed-up comes near the end, where it matters.
  const urgency = (1 - left) ** 1.6;
  return TEMPO_FULL + (TEMPO_EMPTY - TEMPO_FULL) * urgency;
}

/** Seconds per step (a sixteenth note) at `bpm`. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

export interface Layers {
  kalimba: boolean;
  shaker: boolean;
  bass: boolean;
  slap: boolean;
}

/** Which instruments play: more join as the clock runs down. */
export function musicLayers(fraction: number, atHome: boolean): Layers {
  if (atHome) {
    return { kalimba: true, shaker: true, bass: false, slap: false };
  }
  return {
    kalimba: true,
    shaker: true,
    bass: fraction < 0.75,
    slap: fraction < 0.4,
  };
}

/** The music's four moods: the home page, then calm, middle and urgent. */
export const MusicLevel = {
  Home: 'home',
  Calm: 'calm',
  Mid: 'mid',
  Urgent: 'urgent',
} as const;
export type MusicLevelName = (typeof MusicLevel)[keyof typeof MusicLevel];
export const MUSIC_LEVELS: readonly MusicLevelName[] = ['home', 'calm', 'mid', 'urgent'];

/** Each level's tempo: calmer at home, faster as the clock runs down. */
export const LEVEL_TEMPO: Record<MusicLevelName, number> = {
  home: TEMPO_HOME,
  calm: TEMPO_FULL,
  mid: 112,
  urgent: 134,
};

/** Each level's instruments: drums join as the clock runs down. */
export function levelLayers(level: MusicLevelName): Layers {
  return {
    kalimba: true,
    shaker: true,
    bass: level === 'mid' || level === 'urgent',
    slap: level === 'urgent',
  };
}

/** The level for the share of the clock left, or home. */
export function musicLevel(fraction: number, atHome: boolean): MusicLevelName {
  if (atHome) return 'home';
  if (fraction >= 0.75) return 'calm';
  if (fraction >= 0.4) return 'mid';
  return 'urgent';
}

/** Bars in one loop: the whole melody. */
export const LOOP_BARS = 4;

/** Seconds per bar at `bpm`. */
export function barSeconds(bpm: number): number {
  return STEPS * stepSeconds(bpm);
}

/**
 * The first bar line at or after `earliest`, for a loop whose bar 0 began
 * at `loopStart`: its time and how many bars since loopStart. Levels switch
 * only on bar lines, so the music never jumps mid-phrase.
 */
export function nextBarLine(
  loopStart: number,
  bar: number,
  earliest: number,
): { time: number; bars: number } {
  const bars = Math.max(0, Math.ceil((earliest - loopStart) / bar - 1e-9));
  return { time: loopStart + bars * bar, bars };
}

/**
 * A seamless loop from one rendered pass that rings on past its end: the
 * ring-out (note tails, reverb) is added back onto the loop's start, as the
 * previous pass would have left it there.
 */
export function foldTail(
  samples: Float32Array,
  loopLength: number,
): Float32Array<ArrayBuffer> {
  const loop = new Float32Array(loopLength);
  loop.set(samples.subarray(0, loopLength));
  for (let i = loopLength; i < samples.length; i += 1) {
    loop[(i - loopLength) % loopLength] += samples[i];
  }
  return loop;
}

/**
 * Whether the music plays, plays softly or is silent. It never stops dead:
 * after an answer or at time up it plays on softly; it fades out only when
 * paused, at a run's summary or with sound off.
 */
export function musicMood(
  mode: string,
  status: string,
  paused: boolean,
  soundOn: boolean,
): 'play' | 'soft' | 'off' {
  if (!soundOn || paused || mode === 'runOver') return 'off';
  if (mode === 'home') return 'play';
  return status === 'playing' ? 'play' : 'soft';
}

/** The music's share in each mood. */
export const MOOD_GAIN = { play: 1, soft: 0.4, off: 0 } as const;

/**
 * The music dips under the read-aloud voice and stays down through the
 * short gaps between its sentences, rising again only HOLD seconds after
 * the last word.
 */
export const DUCK = { gain: 0.35, hold: 0.9 } as const;

export function duckHeld(speaking: boolean, lastSpokeAt: number, now: number): boolean {
  return speaking || now - lastSpokeAt < DUCK.hold;
}

/**
 * A soft room's echo for the reverb, as `seconds` of decaying noise: different
 * on each channel (`seed`) for width, a little darker as it fades.
 */
export function roomImpulse(
  sampleRate: number,
  seconds: number,
  seed: number,
): Float32Array<ArrayBuffer> {
  const length = Math.round(sampleRate * seconds);
  const data = new Float32Array(length);
  let state = seed >>> 0;
  let smooth = 0;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = state / 2147483648 - 1;
    const t = i / sampleRate;
    // Darker later: a one-pole low-pass that closes as the echo fades.
    const keep = Math.min(0.85, 0.2 + t * 0.9);
    smooth = smooth * keep + white * (1 - keep);
    // A short pre-delay: the room answers a moment after the note.
    data[i] = t < 0.012 ? 0 : smooth * Math.exp(-t / (seconds / 6.9)) * 1.6;
  }
  return data;
}

// Pitches of the kalimba, as semitones above its lowest note (C4): two
// octaves of the major pentatonic scale.
export const KALIMBA_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const;

// The melody: one note per step (an index into KALIMBA_SEMITONES) or -1 for
// a rest, over four bars that answer each other. Original to this game.
export const MELODY: readonly (readonly number[])[] = [
  [5, -1, 7, -1, 6, -1, 4, -1, 5, -1, -1, 3, 4, -1, 2, -1],
  [3, -1, 5, -1, 4, -1, 2, -1, 3, -1, -1, 1, 2, -1, 0, -1],
  [5, -1, 7, -1, 8, -1, 7, -1, 6, -1, -1, 5, 6, -1, 4, -1],
  [3, -1, 4, -1, 2, -1, 1, -1, 0, -1, -1, 2, 1, -1, 0, -1],
];

// Drums and shaker, one value per step: 0 silent, else the hit's loudness.
export const BASS: readonly number[] = [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0];
export const SLAP: readonly number[] = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.6];
export const SHAKER: readonly number[] = [0.8, 0, 0.4, 0, 0.8, 0, 0.4, 0, 0.8, 0, 0.4, 0, 0.8, 0, 0.4, 0.3];

// What RUSH says for each reaction (see src/rush-mood.ts) and for the end of
// the clock: pitch steps of its voice as multiples of its base pitch, each
// with a start time and length in seconds; a glide slides to its pitch.
export interface Note {
  at: number;
  pitch: number;
  length: number;
  glideFrom?: number;
}

export type Cue =
  | 'present'
  | 'cheer'
  | 'worried'
  | 'surprised'
  | 'sleepy'
  | 'runOver';

export const CUES: Record<Cue, readonly Note[]> = {
  // A little "here you go": two quick rising notes.
  present: [
    { at: 0, pitch: 1, length: 0.09 },
    { at: 0.1, pitch: 1.5, length: 0.12 },
  ],
  // Delight: a bright rising arpeggio.
  cheer: [
    { at: 0, pitch: 1, length: 0.08 },
    { at: 0.08, pitch: 1.26, length: 0.08 },
    { at: 0.16, pitch: 1.5, length: 0.08 },
    { at: 0.24, pitch: 2, length: 0.2 },
  ],
  // "Uh-oh": two falling notes.
  worried: [
    { at: 0, pitch: 1.19, length: 0.14 },
    { at: 0.17, pitch: 0.89, length: 0.24, glideFrom: 1 },
  ],
  // "Huh?": a quick slide up.
  surprised: [{ at: 0, pitch: 1.7, length: 0.22, glideFrom: 0.8 }],
  // A slow yawn when time runs out.
  sleepy: [{ at: 0, pitch: 0.6, length: 0.7, glideFrom: 1.1 }],
  // The end of a run: a short fanfare.
  runOver: [
    { at: 0, pitch: 1, length: 0.1 },
    { at: 0.12, pitch: 1.26, length: 0.1 },
    { at: 0.24, pitch: 1.5, length: 0.1 },
    { at: 0.36, pitch: 2, length: 0.35 },
  ],
};

/** Stereo pan (-1 left to 1 right) for a sound at `angle` radians right of the face. */
export function panFor(angle: number): number {
  return Math.max(-1, Math.min(1, Math.sin(angle)));
}
