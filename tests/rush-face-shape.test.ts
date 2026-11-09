import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY } from '../src/rush-body-plan.ts';
import { FACE_SHAPE, type FacePatch } from '../src/rush-face-shape.ts';

const points = (patch: FacePatch) => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < patch.positions.length; i += 3) {
    out.push([patch.positions[i], patch.positions[i + 1], patch.positions[i + 2]]);
  }
  return out;
};

test('each lid is a whole grid with unit normals, on the front of her face', () => {
  for (const patch of FACE_SHAPE.lids) {
    const count = (patch.cols + 1) * (patch.rows + 1);
    assert.equal(patch.positions.length, count * 3);
    assert.equal(patch.normals.length, count * 3);
    for (let i = 0; i < patch.normals.length; i += 3) {
      const length = Math.hypot(patch.normals[i], patch.normals[i + 1], patch.normals[i + 2]);
      assert.ok(Math.abs(length - 1) < 0.01, `normal length ${length}`);
      // Facing forward, out of her face.
      assert.ok(patch.normals[i + 2] > 0.3, `normal ${patch.normals.slice(i, i + 3)}`);
    }
    for (const [x, y, z] of points(patch)) {
      assert.ok(Math.abs(x) < 0.09 && z > 0.06, `${x} ${y} ${z}`);
      // Between her chin and the top of her head.
      assert.ok(y > 0.82 && y < BODY.headCenterY + BODY.headRadius, `${y}`);
    }
  }
});

test('the lids mirror each other, the right one at -x, above the mouth', () => {
  const [right, left] = FACE_SHAPE.lids.map(points);
  assert.equal(right.length, left.length);
  const across = FACE_SHAPE.lids[0].cols + 1;
  right.forEach(([x, y, z], i) => {
    // The same point mirrored: same row, column counted from the other end.
    const row = Math.floor(i / across);
    const [mx, my, mz] = left[row * across + (across - 1 - (i % across))];
    assert.ok(x < 0 && mx > 0);
    // Her face is nearly symmetric: mirrored points within 4 mm.
    const apart = Math.max(Math.abs(x + mx), Math.abs(y - my), Math.abs(z - mz));
    assert.ok(apart < 0.004, `point ${i}: ${apart.toFixed(4)} m apart`);
  });
  const lowestLid = Math.min(...right.map(([, y]) => y));
  const [, my, mz] = FACE_SHAPE.mouth.centre;
  assert.ok(lowestLid > my + 0.03, 'the eyes sit well above the mouth');
  // The mouth sits on the front of her face, facing out.
  assert.ok(Math.abs(my - 0.8485) < 0.003 && mz > 0.08);
  assert.ok(FACE_SHAPE.mouth.normal[2] > 0.8);
});

test('each lid has a skin spot in the texture', () => {
  assert.equal(FACE_SHAPE.skinUv.length, FACE_SHAPE.lids.length);
  for (const uv of FACE_SHAPE.skinUv) {
    assert.equal(uv.length, 2);
    for (const c of uv) assert.ok(c >= 0 && c <= 1, `${c}`);
  }
});
