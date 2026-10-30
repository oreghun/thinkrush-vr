import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IMPORTED_OBJECTS, objectFile } from '../src/imported-objects.ts';

const sources = readFileSync(
  new URL('../art/SOURCES.md', import.meta.url),
  'utf8',
);

// An imported miniature needs its optimized file in the build and a row
// saying where it came from, or it should not be in the list.
for (const model of IMPORTED_OBJECTS) {
  test(`${model}: optimized model and source record`, () => {
    const file = new URL(`../public/${objectFile(model)}`, import.meta.url);
    assert.ok(existsSync(file), `missing public/${objectFile(model)}`);
    assert.ok(
      sources.includes(`public/${objectFile(model)}`),
      `art/SOURCES.md has no row for public/${objectFile(model)}`,
    );
  });
}
