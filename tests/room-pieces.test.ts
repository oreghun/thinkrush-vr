import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ROOM_PIECES, roomAssetId, roomFile } from '../src/room-pieces.ts';

const sources = readFileSync(
  new URL('../art/SOURCES.md', import.meta.url),
  'utf8',
);
const scene = readFileSync(
  new URL('../public/scenes/main.iwsdk.scene.json', import.meta.url),
  'utf8',
);

// Every room piece needs its optimized file, a row saying where it came
// from, and a place in the scene, or it should not be in the list.
for (const piece of ROOM_PIECES) {
  test(`${piece}: optimized model, source record and a place in the room`, () => {
    const file = new URL(`../public/${roomFile(piece)}`, import.meta.url);
    assert.ok(existsSync(file), `missing public/${roomFile(piece)}`);
    assert.ok(
      sources.includes(`public/${roomFile(piece)}`),
      `art/SOURCES.md has no row for public/${roomFile(piece)}`,
    );
    assert.ok(
      scene.includes(`"asset": "${roomAssetId(piece)}"`),
      `the scene does not place ${roomAssetId(piece)}`,
    );
  });
}
