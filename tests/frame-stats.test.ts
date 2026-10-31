import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type FrameSummary,
  FrameWindow,
  preferredFrameRate,
} from '../src/frame-stats.ts';

const empty = (): FrameSummary => ({ fps: 0, worstMs: 0, late: 0 });

test('a steady 72 Hz second reads 72 fps with no late frames', () => {
  const frames = new FrameWindow();
  const out = empty();
  let closed = false;
  for (let i = 0; i < 72 && !closed; i += 1) {
    closed = frames.add(1 / 72 + 1e-9, 72, out);
  }
  assert.ok(closed);
  assert.deepEqual(out, { fps: 72, worstMs: 14, late: 0 });
});

test('a missed frame is late and is the slowest', () => {
  const frames = new FrameWindow();
  const out = empty();
  let closed = frames.add(2 / 72, 72, out);
  for (let i = 0; i < 80 && !closed; i += 1) {
    closed = frames.add(1 / 72, 72, out);
  }
  assert.ok(closed);
  assert.equal(out.late, 1);
  assert.equal(out.worstMs, 28);
  // The missed frame took two intervals, so the second held 71 frames.
  assert.equal(out.fps, 71);
});

test('a slow second shows the lower rate and every frame late', () => {
  const frames = new FrameWindow();
  const out = empty();
  let closed = false;
  for (let i = 0; i < 40 && !closed; i += 1) {
    closed = frames.add(1 / 36, 72, out);
  }
  assert.ok(closed);
  assert.equal(out.fps, 36);
  assert.equal(out.late, 36);
});

test('each window starts over', () => {
  const frames = new FrameWindow();
  const out = empty();
  for (let i = 0; i < 40; i += 1) {
    if (frames.add(1 / 36, 72, out)) break;
  }
  let closed = false;
  for (let i = 0; i < 100 && !closed; i += 1) {
    closed = frames.add(1 / 90, 90, out);
  }
  assert.ok(closed);
  assert.deepEqual(out, { fps: 90, worstMs: 11, late: 0 });
});

test('zero or bad frame times are ignored', () => {
  const frames = new FrameWindow();
  const out = empty();
  assert.equal(frames.add(0, 72, out), false);
  assert.equal(frames.add(Number.NaN, 72, out), false);
  assert.equal(frames.add(-1, 72, out), false);
  assert.deepEqual(out, empty());
});

test('asks for 72 Hz only when the headset offers it', () => {
  assert.equal(preferredFrameRate(new Float32Array([72, 80, 90, 120])), 72);
  assert.equal(preferredFrameRate([90, 120]), null);
  assert.equal(preferredFrameRate(undefined), null);
});
