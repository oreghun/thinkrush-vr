import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DESKTOP_FRAMING,
  framingFor,
  MUST_SEE,
  viewAngles,
  WIDE_ASPECT,
} from '../src/flat-framing.ts';

const DEG = Math.PI / 180;

test('the desktop view is the one set in iwsdk.config.json', () => {
  const config = JSON.parse(readFileSync('iwsdk.config.json', 'utf8'));
  const render = config.world.render;
  assert.deepEqual([...DESKTOP_FRAMING.position], render.camera.position);
  assert.deepEqual([...DESKTOP_FRAMING.target], render.camera.lookAt);
  assert.equal(DESKTOP_FRAMING.fov, render.fov);
});

test('wide windows keep the desktop view exactly', () => {
  for (const aspect of [WIDE_ASPECT, 1.6, 16 / 9, 2.4]) {
    assert.equal(framingFor(aspect), DESKTOP_FRAMING);
  }
});

test('from a tall phone to a wide window, everything that matters is in frame', () => {
  for (let aspect = 0.4; aspect < 2; aspect += 0.01) {
    const { position, target, fov } = framingFor(aspect);
    assert.ok(fov <= 100, `fov ${fov} at ${aspect}`);
    const halfUp = (fov / 2) * DEG;
    const halfAcross = Math.atan(Math.tan(halfUp) * aspect);
    for (const point of MUST_SEE) {
      const [h, v] = viewAngles(position, target, point);
      assert.ok(Math.abs(h) <= halfAcross, `${point} across at ${aspect.toFixed(2)}`);
      assert.ok(Math.abs(v) <= halfUp, `${point} up/down at ${aspect.toFixed(2)}`);
    }
  }
});

test('resizing never makes the view jump', () => {
  let previous = framingFor(0.4);
  for (let aspect = 0.41; aspect < 2; aspect += 0.01) {
    const next = framingFor(aspect);
    assert.ok(Math.abs(next.fov - previous.fov) < 3, `fov at ${aspect.toFixed(2)}`);
    for (let i = 0; i < 3; i += 1) {
      assert.ok(Math.abs(next.position[i] - previous.position[i]) < 0.05);
    }
    previous = next;
  }
});

test('a phone held upright gets a view that is not too wide', () => {
  // 9:20 and 9:16 phones.
  assert.ok(framingFor(0.45).fov < 80);
  assert.ok(framingFor(0.5625).fov < 70);
});
