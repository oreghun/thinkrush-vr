import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BODY,
  type BodyView,
  bodyEvent,
  CLIP,
  HEAD_CENTER_Y,
  type EventView,
  reactionClip,
  seatedShare,
  SHOW_SPOT,
  shouldRun,
  sitSpot,
  STAGE_SPOT,
  standingClip,
  SEAT_AFTER_SECONDS,
  turnToward,
  wantedPlace,
  yawToward,
} from '../src/rush-body-plan.ts';
import { POUF, POUF_PROFILE } from '../src/pouf-shape.ts';

const view = (change: Partial<BodyView> = {}): BodyView => ({
  mode: 'practice',
  phase: 'answering',
  status: 'playing',
  paused: false,
  speaking: false,
  fraction: 1,
  showMove: false,
  homeSeconds: 0,
  ...change,
});

test('every move the game asks for is in the model file', () => {
  const file = new URL('../public/models/rush/rush-body.glb', import.meta.url);
  assert.ok(existsSync(file), 'public/models/rush/rush-body.glb is missing');
  const glb = readFileSync(file);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  const names = new Set((json.animations ?? []).map((a: { name: string }) => a.name));
  for (const [key, name] of Object.entries(CLIP)) {
    assert.ok(names.has(name), `${key}: no animation named ${name}`);
  }
});

test('at home she strolls to her seat; in a puzzle she stands by the table', () => {
  assert.equal(wantedPlace(view({ mode: 'home', homeSeconds: 1 })), 'stage');
  assert.equal(wantedPlace(view({ mode: 'home', homeSeconds: SEAT_AFTER_SECONDS })), 'seat');
  for (const mode of ['practice', 'run', 'tour', 'runOver']) {
    assert.equal(wantedPlace(view({ mode })), 'stage', mode);
  }
  // SHOW: she comes within reach, only while the puzzle is in play.
  assert.equal(wantedPlace(view({ showMove: true })), 'show');
  assert.equal(wantedPlace(view({ showMove: true, status: 'solved' })), 'stage');
  // She runs back to the table, but strolls to her seat.
  assert.equal(shouldRun('stage', 5), true);
  assert.equal(shouldRun('stage', 0.5), false);
  assert.equal(shouldRun('seat', 5), false);
});

test('she talks while speaking, gets impatient as the clock runs low', () => {
  assert.equal(standingClip(view({ speaking: true })), 'talk');
  assert.equal(standingClip(view({ fraction: 0.8 })), 'calm');
  assert.equal(standingClip(view({ fraction: 0.2 })), 'sassy');
  assert.equal(standingClip(view({ paused: true, speaking: true })), 'calm');
  assert.equal(standingClip(view({ mode: 'home' })), 'idle');
  // The tour has no running clock: no impatience there.
  assert.equal(standingClip(view({ mode: 'tour', fraction: 0.1 })), 'idle');
});

test('she reacts to each answer with a move', () => {
  const before: EventView = { mode: 'practice', status: 'playing', wrongAnswers: 0, wrongMoves: 0, fraction: 0.8 };
  const after = (change: Partial<EventView>) => ({ ...before, ...change });
  assert.equal(bodyEvent(before, after({ status: 'solved', fraction: 0.8 })), 'fastSolved');
  assert.equal(bodyEvent(before, after({ status: 'solved', fraction: 0.3 })), 'solved');
  assert.equal(bodyEvent(before, after({ wrongMoves: 1, status: 'wrongMove' })), 'wrongMove');
  assert.equal(bodyEvent(before, after({ status: 'wrongPick', wrongAnswers: 1 })), 'wrongPick');
  assert.equal(bodyEvent(before, after({ status: 'timeUp' })), 'timeUp');
  assert.equal(bodyEvent(after({ mode: 'run' }), after({ mode: 'runOver' })), 'runOver');
  assert.equal(bodyEvent(after({ mode: 'home' }), after({ mode: 'tour' })), 'hello');
  assert.equal(bodyEvent(before, before), undefined);
  // The tour has no clock to beat: a plain cheer, never the speedy dance.
  assert.equal(bodyEvent(after({ mode: 'tour' }), after({ mode: 'tour', status: 'solved', fraction: 1 })), 'solved');
  assert.equal(reactionClip('fastSolved', 0), 'dance');
  assert.equal(reactionClip('solved', 0.2), 'cheer');
  assert.equal(reactionClip('solved', 0.8), 'jump');
  assert.equal(reactionClip('wrongPick', 0), 'point');
  assert.equal(reactionClip('wrongMove', 0), 'facepalm');
  assert.equal(reactionClip('timeUp', 0), 'shrug');
  assert.equal(reactionClip('hello', 0), 'wave');
});

test('by the table her head stays in view on Meta VR Glasses', () => {
  // Seated eyes at 1.15 m, looking straight ahead (-Z).
  const head = { x: STAGE_SPOT.x, y: HEAD_CENTER_Y, z: STAGE_SPOT.z };
  const across = (Math.atan2(head.x, -head.z) * 180) / Math.PI;
  const down = (Math.atan2(head.y - 1.15, -head.z) * 180) / Math.PI;
  assert.ok(Math.abs(across) <= 34, `${across.toFixed(1)} degrees across (37 is the edge)`);
  assert.ok(down <= 25 && down >= -43, `${down.toFixed(1)} degrees up or down`);
});

test('she never stands inside the table', () => {
  // The play table: 1.01 m wide, its top from z -0.19 to -0.70; her body
  // is about 0.17 m from its middle to her side.
  for (const spot of [STAGE_SPOT, SHOW_SPOT]) {
    const clearSide = Math.abs(spot.x) - 0.505 >= 0.17;
    const clearBehind = spot.z <= -0.7 - 0.17;
    assert.ok(clearSide || clearBehind, `${JSON.stringify(spot)} overlaps the table`);
  }
  // SHOW is within a seated reach: her head within 0.65 m of the right shoulder.
  const shoulder = { x: 0.18, y: 0.98, z: -0.05 };
  const reach = Math.hypot(SHOW_SPOT.x - shoulder.x, HEAD_CENTER_Y - shoulder.y, SHOW_SPOT.z - shoulder.z);
  assert.ok(reach <= 0.7, `head ${reach.toFixed(2)} m from the shoulder`);
});

test('to sit she stands in front of her seat, facing away from it', () => {
  const seat = { x: 4, z: -3 };
  const toward = { x: 0, z: -3 };
  const spot = sitSpot(seat, toward);
  // Facing -X (towards the room), about sitBack ahead of the seat.
  assert.ok(Math.abs(spot.yaw - yawToward(seat, toward)) < 1e-9);
  assert.ok(Math.abs(spot.x - (4 - BODY.sitBack)) < 1e-9, `${spot.x}`);
  // Shifted to her left, so her hips (which go to her right) land on it.
  assert.ok(Math.abs(spot.z - (-3 - BODY.sitSide)) < 1e-9, `${spot.z}`);
});

test('turning takes the short way round', () => {
  assert.equal(turnToward(0, 0.1, 0.5), 0.1);
  assert.ok(Math.abs(turnToward(0, 2, 0.5) - 0.5) < 1e-9);
  // From just under pi to just over -pi: a small step across, not a full turn.
  const start = Math.PI - 0.1;
  const next = turnToward(start, -Math.PI + 0.1, 0.05);
  assert.ok(Math.abs(next - (start + 0.05)) < 1e-9, `${next}`);
});

test('she rises onto the seat only while her hips come down', () => {
  // Standing at the start of the sit-down clip, seated at its end.
  assert.equal(seatedShare(0), 0);
  assert.equal(seatedShare(0.4), 0);
  assert.equal(seatedShare(1), 1);
  assert.equal(seatedShare(0.9), 1);
  // Smoothly in between, never going back down.
  let last = 0;
  for (let p = 0; p <= 1; p += 0.01) {
    const share = seatedShare(p);
    assert.ok(share >= last - 1e-12 && share <= 1, `${p}: ${share}`);
    last = share;
  }
});

test('the pouf is the seat her sit was fitted to', () => {
  // sitBack, sitLift and sitKnee were fitted to this pouf (see BODY): a
  // different seat needs them fitted again.
  assert.deepEqual(POUF, { radius: 0.22, height: 0.3 });
  // Its top is its highest point and its foot sits inside its widest part,
  // so her tucked feet have room under the bulge.
  const tops = POUF_PROFILE.map(([, up]) => up);
  assert.equal(Math.max(...tops), 1);
  const footRadius = POUF_PROFILE[1][0];
  assert.ok(footRadius < Math.max(...POUF_PROFILE.map(([across]) => across)));
  // She rises or settles only a little: the pouf is cut to her seat height.
  assert.ok(Math.abs(BODY.sitLift) <= 0.03);
  // She stands clear of the pouf before sitting down onto it.
  assert.ok(BODY.sitBack > POUF.radius + 0.1);
});
