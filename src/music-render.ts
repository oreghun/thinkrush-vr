import {
  BASS,
  barSeconds,
  foldTail,
  KALIMBA_SEMITONES,
  LEVEL_TEMPO,
  levelLayers,
  LOOP_BARS,
  MELODY,
  type MusicLevelName,
  roomImpulse,
  SHAKER,
  SLAP,
  STEPS,
  stepSeconds,
} from './sound-design.js';

// The game's instruments and its music loops, synthesized in code: nothing
// is downloaded or licensed. Plain WebAudio, no game imports, so a test page
// can render the loops to listen to them.

const KALIMBA_ROOT = 261.63; // C4
export const VOICE_ROOT = 523.25; // C5
// How long the room's echo rings, and how much of each note goes to it.
const ECHO_SECONDS = 1.1;
const ECHO_SEND = 0.28;
// A loop renders this much past its end, so note tails and echo can fold
// back onto its start.
const RING_OUT = 1.6;

/** One mono buffer of `seconds` at the context's own rate, from `sample(t)`. */
function render(
  context: BaseAudioContext,
  seconds: number,
  sample: (t: number) => number,
): AudioBuffer {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.round(seconds * rate), rate);
  const data = buffer.getChannelData(0);
  const fadeFrom = data.length - Math.round(0.02 * rate);
  for (let i = 0; i < data.length; i += 1) {
    // A 20 ms fade at the end: no buffer ever stops with a click.
    const fade = i < fadeFrom ? 1 : (data.length - i) / (data.length - fadeFrom);
    data[i] = sample(i / rate) * fade;
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

/**
 * A kalimba tine: a warm fundamental that rings for over a second, the
 * tine's bright inharmonic overtones fading fast, and a soft pluck.
 */
function kalimba(context: BaseAudioContext, f: number): AudioBuffer {
  const pluck = noise(7);
  return render(context, 1.9, (t) => {
    const ring =
      Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 1.05) +
      0.22 * Math.sin(2 * Math.PI * f * 2.005 * t) * Math.exp(-t / 0.32) +
      0.16 * Math.sin(2 * Math.PI * f * 5.86 * t) * Math.exp(-t / 0.09) +
      0.05 * Math.sin(2 * Math.PI * f * 11.3 * t) * Math.exp(-t / 0.035);
    const attack = 1 - Math.exp(-t / 0.0015);
    return 0.38 * attack * ring + 0.1 * pluck() * Math.exp(-t / 0.003);
  });
}

/** A shaker: two quick grains of bright seed noise, "ch-k". */
function shaker(context: BaseAudioContext): AudioBuffer {
  const grains = noise(11);
  let previous = 0;
  return render(context, 0.13, (t) => {
    const raw = grains();
    const bright = raw - previous; // a simple high-pass
    previous = raw;
    const first = Math.min(1, t / 0.004) * Math.exp(-t / 0.022);
    const second = t > 0.035 ? 0.55 * Math.exp(-(t - 0.035) / 0.03) : 0;
    return 0.3 * bright * (first + second);
  });
}

/** The low hand-drum stroke: a falling tone with a soft thump. */
function bassDrum(context: BaseAudioContext): AudioBuffer {
  const thump = noise(17);
  let phase = 0;
  const rate = context.sampleRate;
  return render(context, 0.5, (t) => {
    const f = 54 + 46 * Math.exp(-t / 0.045);
    phase += (2 * Math.PI * f) / rate;
    const tone = Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / 0.2);
    return 0.85 * tone + 0.12 * thump() * Math.exp(-t / 0.006);
  });
}

/** The high slap: a short ringing skin with a bright crack. */
function slap(context: BaseAudioContext): AudioBuffer {
  const skin = noise(23);
  return render(context, 0.2, (t) => {
    const tone =
      Math.sin(2 * Math.PI * 382 * t) * Math.exp(-t / 0.06) +
      0.4 * Math.sin(2 * Math.PI * 681 * t) * Math.exp(-t / 0.035);
    return 0.42 * (0.6 * tone + 0.55 * skin() * Math.exp(-t / 0.018));
  });
}

/** RUSH's voice: a soft, round tone; each cue note sets its pitch and length. */
function voice(context: BaseAudioContext): AudioBuffer {
  return render(context, 1.2, (t) => {
    // A touch of vibrato keeps it alive.
    const wobble = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);
    const phase = 2 * Math.PI * VOICE_ROOT * wobble * t;
    return 0.5 * (Math.sin(phase) + 0.22 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase));
  });
}

export interface Instruments {
  kalimba: AudioBuffer[];
  shaker: AudioBuffer;
  bass: AudioBuffer;
  slap: AudioBuffer;
  voice: AudioBuffer;
}

/** Synthesizes every instrument once, at the context's own sample rate. */
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

/** The room's echo as a stereo impulse for a ConvolverNode. */
export function createEcho(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const left = roomImpulse(rate, ECHO_SECONDS, 101);
  const right = roomImpulse(rate, ECHO_SECONDS, 202);
  const buffer = context.createBuffer(2, left.length, rate);
  buffer.copyToChannel(left, 0);
  buffer.copyToChannel(right, 1);
  return buffer;
}

/**
 * Renders one level's loop: the whole melody (LOOP_BARS bars) with that
 * level's instruments, through the room's echo, folded so it loops without
 * a seam. Rendering runs on the browser's audio thread, off the frame loop.
 * Pass the game's `instruments` (made at this sample rate) to skip
 * synthesizing them again.
 */
export async function renderLoop(
  level: MusicLevelName,
  sampleRate: number,
  instruments?: Instruments,
): Promise<AudioBuffer> {
  const bpm = LEVEL_TEMPO[level];
  const step = stepSeconds(bpm);
  const loopSeconds = LOOP_BARS * barSeconds(bpm);
  const loopLength = Math.round(loopSeconds * sampleRate);
  const context = new OfflineAudioContext(
    2,
    Math.round((loopSeconds + RING_OUT) * sampleRate),
    sampleRate,
  );
  const kit =
    instruments && instruments.voice.sampleRate === sampleRate
      ? instruments
      : createInstruments(context);
  const dry = context.createGain();
  dry.connect(context.destination);
  const echo = context.createConvolver();
  echo.buffer = createEcho(context);
  echo.normalize = true;
  const send = context.createGain();
  send.gain.value = ECHO_SEND;
  send.connect(echo).connect(context.destination);

  const layers = levelLayers(level);
  const hit = (buffer: AudioBuffer, time: number, loudness: number) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = loudness;
    source.connect(gain);
    gain.connect(dry);
    gain.connect(send);
    source.start(time);
  };
  for (let bar = 0; bar < LOOP_BARS; bar += 1) {
    for (let i = 0; i < STEPS; i += 1) {
      const time = (bar * STEPS + i) * step;
      const note = MELODY[bar % MELODY.length][i];
      if (layers.kalimba && note >= 0) hit(kit.kalimba[note], time, 0.8);
      if (layers.shaker && SHAKER[i] > 0) hit(kit.shaker, time, SHAKER[i]);
      if (layers.bass && BASS[i] > 0) hit(kit.bass, time, BASS[i]);
      if (layers.slap && SLAP[i] > 0) hit(kit.slap, time, SLAP[i]);
    }
  }
  const rendered = await context.startRendering();
  const loop = new AudioBuffer({ numberOfChannels: 2, length: loopLength, sampleRate });
  for (let channel = 0; channel < 2; channel += 1) {
    loop.copyToChannel(foldTail(rendered.getChannelData(channel), loopLength), channel);
  }
  return loop;
}
