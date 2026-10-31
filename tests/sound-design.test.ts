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
  LOOKAHEAD,
  stepsToCatchUp,
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

/**
 * The music scheduler as SoundSystem runs it, once per frame: `gaps` are
 * the frame times (seconds). Returns the booked note times and how many
 * steps were skipped because a stall outlasted the lookahead.
 */
function schedule(gaps: number[], step: number, lookahead: number) {
  let now = 0;
  let next = 0;
  let skipped = 0;
  const notes: number[] = [];
  for (const gap of gaps) {
    now += gap;
    if (next === 0) {
      next = now + 0.05;
    } else {
      const skip = stepsToCatchUp(next, now, step);
      next += skip * step;
      skipped += skip;
    }
    while (next < now + lookahead) {
      notes.push(next);
      next += step;
    }
  }
  return { notes, skipped };
}

/** 72 fps frames with a stall of `stall` seconds every two seconds. */
function framesWithStalls(stall: number): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < 72 * 20; i += 1) {
    gaps.push(i % 144 === 143 ? stall : 1 / 72);
  }
  return gaps;
}

test('stalls shorter than the lookahead never cost a note', () => {
  const step = stepSeconds(TEMPO_EMPTY);
  // The old 0.15 s lookahead dropped notes on a 0.4 s stall...
  assert.ok(schedule(framesWithStalls(0.4), step, 0.15).skipped > 0);
  // ...the new one does not, and the notes stay evenly spaced.
  const { notes, skipped } = schedule(framesWithStalls(0.4), step, LOOKAHEAD);
  assert.equal(skipped, 0);
  for (let i = 1; i < notes.length; i += 1) {
    assert.ok(Math.abs(notes[i] - notes[i - 1] - step) < 1e-9);
  }
});

test('a longer stall drops notes but keeps the beat', () => {
  const step = stepSeconds(TEMPO_FULL);
  const { notes, skipped } = schedule(framesWithStalls(1.2), step, LOOKAHEAD);
  assert.ok(skipped > 0);
  // Every note still falls on the original grid: the bar never restarts.
  for (const time of notes) {
    const steps = (time - notes[0]) / step;
    assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6);
  }
});

test('catching up skips the fewest whole steps', () => {
  assert.equal(stepsToCatchUp(1.0, 0.5, 0.1), 0);
  assert.equal(stepsToCatchUp(1.0, 1.33, 0.1), 4);
  assert.equal(stepsToCatchUp(1.0, 1.0, 0.1), 1);
});
