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
