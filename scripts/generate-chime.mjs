// Writes public/audio/chime.wav: a short two-note chime synthesized from sine
// partials, so the project ships no recorded or third-party audio.
// Run: node scripts/generate-chime.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const DURATION_S = 1.0;
const PEAK = 0.6;

// [start time (s), fundamental (Hz)]: A5 then E6, a rising fifth.
const NOTES = [
  [0, 880],
  [0.11, 1318.51],
];
// [frequency multiple, relative amplitude, decay time constant (s)]
const PARTIALS = [
  [1, 1, 0.32],
  [2, 0.3, 0.16],
  [3, 0.1, 0.08],
];
const ATTACK_S = 0.004;

const length = Math.round(SAMPLE_RATE * DURATION_S);
const samples = new Float64Array(length);
for (const [start, fundamental] of NOTES) {
  for (let i = Math.round(start * SAMPLE_RATE); i < length; i += 1) {
    const t = i / SAMPLE_RATE - start;
    const attack = Math.min(1, t / ATTACK_S);
    for (const [multiple, amplitude, decay] of PARTIALS) {
      samples[i] +=
        attack *
        amplitude *
        Math.exp(-t / decay) *
        Math.sin(2 * Math.PI * fundamental * multiple * t);
    }
  }
}

// Fade the tail to silence so the file never ends on a click.
const fadeLength = Math.round(0.05 * SAMPLE_RATE);
for (let i = 0; i < fadeLength; i += 1) {
  samples[length - 1 - i] *= i / fadeLength;
}

const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
const pcm = Buffer.alloc(length * 2);
for (let i = 0; i < length; i += 1) {
  pcm.writeInt16LE(Math.round((samples[i] / peak) * PEAK * 32767), i * 2);
}

// 16-bit mono PCM WAV header.
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const output = fileURLToPath(
  new URL('../public/audio/chime.wav', import.meta.url),
);
writeFileSync(output, Buffer.concat([header, pcm]));
console.log(`Wrote ${output}`);
