import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BASS,
  CUES,
  KALIMBA_SEMITONES,
  MELODY,
  musicLayers,
  musicTempo,
  panFor,
  SHAKER,
  SLAP,
  STEPS,
  stepSeconds,
  TEMPO_EMPTY,
  TEMPO_FULL,
  barSeconds,
  DUCK,
  duckHeld,
  foldTail,
  LEVEL_TEMPO,
  levelLayers,
  LOOP_BARS,
  MOOD_GAIN,
  MUSIC_LEVELS,
  musicLevel,
  musicMood,
  nextBarLine,
  roomImpulse,
} from '../src/sound-design.ts';

test('the music speeds up as the clock runs down, and only then', () => {
  assert.equal(musicTempo(1), TEMPO_FULL);
  assert.equal(musicTempo(0), TEMPO_EMPTY);
  let last = 0;
  for (let f = 1; f >= 0; f -= 0.05) {
    const tempo = musicTempo(f);
    assert.ok(tempo >= last, 'tempo never slows as time runs out');
    last = tempo;
  }
  // Out-of-range clocks stay within the two tempos.
  assert.equal(musicTempo(2), TEMPO_FULL);
  assert.equal(musicTempo(-1), TEMPO_EMPTY);
});

test('a step is a sixteenth note', () => {
  assert.equal(stepSeconds(60), 0.25);
});

test('drums join as time runs out; home stays calm', () => {
  assert.deepEqual(musicLayers(1, false), { kalimba: true, shaker: true, bass: false, slap: false });
  assert.equal(musicLayers(0.5, false).bass, true);
  assert.equal(musicLayers(0.2, false).slap, true);
  assert.equal(musicLayers(0.1, true).slap, false);
});

test('every pattern is one bar long and every melody note is on the scale', () => {
  for (const pattern of [BASS, SLAP, SHAKER, ...MELODY]) {
    assert.equal(pattern.length, STEPS);
  }
  for (const bar of MELODY) {
    for (const note of bar) {
      assert.ok(note === -1 || (note >= 0 && note < KALIMBA_SEMITONES.length));
    }
  }
});

test('every cue has notes with positive lengths', () => {
  for (const [name, notes] of Object.entries(CUES)) {
    assert.ok(notes.length > 0, name);
    for (const note of notes) {
      assert.ok(note.length > 0 && note.pitch > 0 && note.at >= 0, name);
    }
  }
});

test('RUSH on the right is heard on the right', () => {
  assert.ok(panFor(0.6) > 0);
  assert.ok(panFor(-0.6) < 0);
  assert.equal(panFor(0), 0);
});

test('the music grows calm, middle, urgent as the clock runs down', () => {
  assert.equal(musicLevel(1, false), 'calm');
  assert.equal(musicLevel(0.75, false), 'calm');
  assert.equal(musicLevel(0.6, false), 'mid');
  assert.equal(musicLevel(0.39, false), 'urgent');
  assert.equal(musicLevel(0, false), 'urgent');
  assert.equal(musicLevel(0.1, true), 'home');
  // Faster and busier at every step up.
  assert.ok(LEVEL_TEMPO.home < LEVEL_TEMPO.calm);
  assert.ok(LEVEL_TEMPO.calm < LEVEL_TEMPO.mid && LEVEL_TEMPO.mid < LEVEL_TEMPO.urgent);
  const count = (level: (typeof MUSIC_LEVELS)[number]) =>
    Object.values(levelLayers(level)).filter(Boolean).length;
  assert.ok(count('calm') <= count('mid') && count('mid') < count('urgent'));
  assert.equal(LOOP_BARS % MELODY.length, 0, 'a loop holds the whole melody');
});

test('a level change lands on the next bar line, carrying the melody on', () => {
  const bar = barSeconds(LEVEL_TEMPO.calm);
  const start = 10;
  // Asked for mid-bar: waits for the next line.
  const line = nextBarLine(start, bar, start + 2.5 * bar);
  assert.equal(line.bars, 3);
  assert.ok(Math.abs(line.time - (start + 3 * bar)) < 1e-9);
  // Asked for exactly on a line: that line.
  assert.equal(nextBarLine(start, bar, start + 2 * bar).bars, 2);
  // Before the loop began: its first bar.
  assert.equal(nextBarLine(start, bar, 0).bars, 0);
  // The new loop starts at the same bar of the melody.
  const newBar = barSeconds(LEVEL_TEMPO.urgent);
  const offset = (line.bars % LOOP_BARS) * newBar;
  assert.ok(Math.abs(offset - 3 * newBar) < 1e-9);
});

test('a folded loop plays seamlessly: it equals a pass in the middle of the music', () => {
  // Notes every 25 samples ringing for 60: a loop of 100 rings past its end.
  const loopLength = 100;
  const ring = 60;
  const pass = (passes: number) => {
    const out = new Float32Array(loopLength * passes + ring);
    for (let p = 0; p < passes; p += 1) {
      for (let n = 0; n < loopLength; n += 25) {
        for (let k = 0; k < ring; k += 1) {
          out[p * loopLength + n + k] += Math.exp(-k / 15) * (1 + n / 100);
        }
      }
    }
    return out;
  };
  const folded = foldTail(pass(1), loopLength);
  const steady = pass(3).subarray(loopLength, 2 * loopLength);
  for (let i = 0; i < loopLength; i += 1) {
    assert.ok(Math.abs(folded[i] - steady[i]) < 1e-6, `sample ${i}`);
  }
});

test('the music never stops dead: it softens after an answer, fades only when paused', () => {
  assert.equal(musicMood('home', 'playing', false, true), 'play');
  assert.equal(musicMood('practice', 'playing', false, true), 'play');
  assert.equal(musicMood('run', 'playing', false, true), 'play');
  for (const status of ['solved', 'timeUp', 'wrongMove', 'wrongPick']) {
    assert.equal(musicMood('run', status, false, true), 'soft', status);
    assert.equal(musicMood('practice', status, false, true), 'soft', status);
  }
  assert.equal(musicMood('practice', 'playing', true, true), 'off');
  assert.equal(musicMood('runOver', 'playing', false, true), 'off');
  assert.equal(musicMood('home', 'playing', false, false), 'off');
  assert.ok(MOOD_GAIN.soft > 0 && MOOD_GAIN.soft < MOOD_GAIN.play);
});

test('the music stays down through the pauses between read-aloud sentences', () => {
  assert.equal(duckHeld(true, 0, 5), true);
  // Half a second after a sentence ends: still down.
  assert.equal(duckHeld(false, 5, 5.5), true);
  // Well after the last word: back up.
  assert.equal(duckHeld(false, 5, 5 + DUCK.hold + 0.01), false);
  assert.ok(DUCK.gain > 0 && DUCK.gain < 1);
});

test('the room echo starts after a short gap and fades to silence', () => {
  const rate = 48000;
  const echo = roomImpulse(rate, 1.1, 101);
  assert.equal(echo.length, Math.round(rate * 1.1));
  assert.equal(echo[0], 0, 'a short pre-delay');
  const peak = (from: number, to: number) => {
    let max = 0;
    for (let i = from; i < to; i += 1) max = Math.max(max, Math.abs(echo[i]));
    return max;
  };
  const early = peak(Math.round(0.02 * rate), Math.round(0.12 * rate));
  const late = peak(Math.round(1.0 * rate), echo.length);
  assert.ok(early > 0 && late < early / 300, `${early} vs ${late}`);
  assert.ok(echo.every((v) => Number.isFinite(v)));
});
