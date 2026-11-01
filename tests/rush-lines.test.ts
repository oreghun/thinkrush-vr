import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  FAST_SHARE,
  type LineEvent,
  pickLine,
  RUSH_LINES,
  solvedEvent,
} from '../src/rush-lines.ts';

const en = JSON.parse(
  readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'),
) as Record<string, string>;

const EVENTS = Object.keys(RUSH_LINES) as LineEvent[];

test('every line is written, short and plain', () => {
  for (const event of EVENTS) {
    assert.ok(RUSH_LINES[event].length >= 2, `${event}: needs a choice`);
    for (const key of RUSH_LINES[event]) {
      const line = en[key];
      assert.ok(line, `${key} is missing from en.json`);
      // A quip, not a speech: over before the next question starts.
      assert.ok(line.split(' ').length <= 6, `${key} is too long: ${line}`);
    }
  }
});

test('RUSH never says the same line twice running', () => {
  for (const event of EVENTS) {
    let last: string | undefined;
    for (let i = 0; i < 200; i += 1) {
      const key = pickLine(event, (i * 0.618) % 1, last);
      assert.ok(RUSH_LINES[event].includes(key));
      assert.notEqual(key, last, `${event} repeated ${key}`);
      last = key;
    }
  }
  // The whole pool gets used.
  const said = new Set<string>();
  for (let r = 0; r < 1; r += 0.01) said.add(pickLine('solved', r));
  assert.equal(said.size, RUSH_LINES.solved.length);
});

test('a quick solve gets a speedy line', () => {
  assert.equal(solvedEvent(1), 'fast');
  assert.equal(solvedEvent(FAST_SHARE), 'fast');
  assert.equal(solvedEvent(FAST_SHARE - 0.01), 'solved');
  assert.equal(solvedEvent(0), 'solved');
});
