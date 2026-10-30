import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nextReadAloudSpeed,
  pickVoice,
  sentences,
  type VoiceInfo,
} from '../src/read-aloud.ts';

const voice = (lang: string, localService: boolean, isDefault = false) =>
  ({ lang, localService, default: isDefault }) as VoiceInfo;

test('only on-device voices are used', () => {
  assert.equal(pickVoice([voice('en-US', false)], 'en'), -1);
  assert.equal(
    pickVoice([voice('en-US', false), voice('en-GB', true)], 'en'),
    1,
  );
});

test('the voice must speak the language', () => {
  const voices = [voice('fr-FR', true), voice('sw-KE', true)];
  assert.equal(pickVoice(voices, 'en'), -1);
  assert.equal(pickVoice(voices, 'sw'), 1);
  assert.equal(pickVoice([voice('en_GB', true)], 'en'), 0);
});

test("the device's default voice wins among matches", () => {
  const voices = [voice('en-GB', true), voice('en-US', true, true)];
  assert.equal(pickVoice(voices, 'en'), 1);
});

test('text is split into sentences', () => {
  assert.deepEqual(
    sentences('Three of these let you in. Which one keeps you out?'),
    ['Three of these let you in.', 'Which one keeps you out?'],
  );
  assert.deepEqual(sentences('"Who goes there?" asked the guard. Wait...'), [
    '"Who goes there?"',
    'asked the guard.',
    'Wait...',
  ]);
  assert.deepEqual(sentences('No full stop'), ['No full stop']);
  assert.deepEqual(sentences(''), []);
});

test('the welcome button cycles off, slow, normal, fast', () => {
  assert.equal(nextReadAloudSpeed('off'), 'slow');
  assert.equal(nextReadAloudSpeed('slow'), 'normal');
  assert.equal(nextReadAloudSpeed('normal'), 'fast');
  assert.equal(nextReadAloudSpeed('fast'), 'off');
});
