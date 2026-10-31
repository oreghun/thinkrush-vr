import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NEAR_BELOW_EYES,
  NEAR_FORWARD,
  NEAR_MIN_BAR_HEIGHT,
  nearBar,
  releaseStop,
  ScreenStop,
} from '../src/screen-stops.ts';

test('pulling the bar toward you brings the screen near', () => {
  assert.equal(releaseStop(ScreenStop.Far, 0.12, 1), ScreenStop.Near);
  assert.equal(releaseStop(ScreenStop.Near, 0.12, 1), ScreenStop.Near);
});

test('pushing the bar away sends the screen far', () => {
  assert.equal(releaseStop(ScreenStop.Near, -0.1, 1), ScreenStop.Far);
  assert.equal(releaseStop(ScreenStop.Far, -0.1, 1), ScreenStop.Far);
});

test('a quick pinch without moving switches stops', () => {
  assert.equal(releaseStop(ScreenStop.Far, 0.01, 0.2), ScreenStop.Near);
  assert.equal(releaseStop(ScreenStop.Near, -0.01, 0.2), ScreenStop.Far);
});

test('a long hold or a small sideways move keeps the stop', () => {
  assert.equal(releaseStop(ScreenStop.Far, 0.01, 1.2), ScreenStop.Far);
  assert.equal(releaseStop(ScreenStop.Near, 0.05, 0.2), ScreenStop.Near);
  assert.equal(releaseStop(ScreenStop.Far, -0.05, 0.6), ScreenStop.Far);
});

test('the near stop is in front of and below the eyes, smaller, within reach', () => {
  const head = { x: 0.1, y: 1.25, z: 0 };
  const bar = nearBar(head, 1.6, 0.42);
  assert.ok(bar.scale < 1.6);
  assert.equal(bar.x, 0.1);
  assert.equal(bar.z, -NEAR_FORWARD);
  // The screen's centre (above the bar) sits NEAR_BELOW_EYES under the eyes.
  const centre = bar.y + 0.42 * bar.scale;
  assert.ok(Math.abs(centre - (head.y - NEAR_BELOW_EYES)) < 1e-9);
  // The airplane-seat test: the centre is well inside a 2 ft (0.61 m) reach.
  const reach = Math.hypot(NEAR_FORWARD, NEAR_BELOW_EYES);
  assert.ok(reach < 0.61);
});

test('the near stop keeps the bar above the table for a short sitter', () => {
  const bar = nearBar({ x: 0, y: 1.0, z: 0 }, 1.6, 0.42);
  assert.equal(bar.y, NEAR_MIN_BAR_HEIGHT);
});
