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
