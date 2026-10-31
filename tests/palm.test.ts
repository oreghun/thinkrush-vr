import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOLD_SECONDS, PalmGesture, palmNormal } from '../src/palm.ts';

// A right hand held flat in front, fingers pointing away (-z): the index
// base is on the thumb side, which is left when the palm faces down.
const wrist = { x: 0, y: 1, z: -0.3 };
const rightPalmDown = { index: { x: -0.03, y: 1, z: -0.38 }, pinky: { x: 0.03, y: 1, z: -0.37 } };
const rightPalmUp = { index: { x: 0.03, y: 1, z: -0.38 }, pinky: { x: -0.03, y: 1, z: -0.37 } };

test('a right palm facing down points down, turned over it points up', () => {
  assert.ok(palmNormal(wrist, rightPalmDown.index, rightPalmDown.pinky, 'right').y < -0.9);
  assert.ok(palmNormal(wrist, rightPalmUp.index, rightPalmUp.pinky, 'right').y > 0.9);
});

test('a left hand is the mirror image', () => {
  // Left hand palm up: the index (thumb side) is on the left.
  const index = { x: -0.03, y: 1, z: -0.38 };
  const pinky = { x: 0.03, y: 1, z: -0.37 };
  assert.ok(palmNormal(wrist, index, pinky, 'left').y > 0.9);
  assert.ok(palmNormal(wrist, index, pinky, 'right').y < -0.9);
});

const run = (gesture: PalmGesture, seconds: number, upness: number, ready = true) => {
  let fired = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    if (gesture.update(0.05, upness, ready)) fired += 1;
  }
  return fired;
};

test('holding the palm up fires once, after the hold time', () => {
  const gesture = new PalmGesture();
  assert.equal(run(gesture, HOLD_SECONDS - 0.1, 0.95), 0);
  assert.equal(run(gesture, 0.2, 0.95), 1);
  // Still up: no second pause.
  assert.equal(run(gesture, 2, 0.95), 0);
});

test('the palm must turn away before the gesture fires again', () => {
  const gesture = new PalmGesture();
  assert.equal(run(gesture, 1, 0.95), 1);
  run(gesture, 0.3, 0.1);
  assert.equal(run(gesture, 1, 0.95), 1);
});

test('a pinch, a held piece or a quick glance never fires it', () => {
  const gesture = new PalmGesture();
  assert.equal(run(gesture, 2, 0.95, false), 0);
  // Up for a moment, then away: the count starts over.
  run(gesture, 0.5, 0.95);
  run(gesture, 0.1, 0.5);
  assert.equal(run(gesture, 0.5, 0.95), 0);
});
