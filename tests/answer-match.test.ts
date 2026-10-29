import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSpokenMatch, normalizeAnswer } from '../src/answer-match.ts';

test('normalizeAnswer ignores case, punctuation and articles', () => {
  assert.equal(normalizeAnswer('A Mirror.'), 'mirror');
  assert.equal(normalizeAnswer('  the   ECHO! '), 'echo');
  assert.equal(normalizeAnswer('An echo?'), 'echo');
  assert.equal(normalizeAnswer("the painter's flattery"), 'painters flattery');
  assert.equal(normalizeAnswer('looking-glass'), 'looking glass');
});

test('normalizeAnswer keeps articles inside other words', () => {
  assert.equal(normalizeAnswer('a theory'), 'theory');
  assert.equal(normalizeAnswer('banana'), 'banana');
});

test('findSpokenMatch accepts the answer or an accepted answer', () => {
  const accepted = ['mirror', 'a mirror', 'looking glass'];
  assert.equal(findSpokenMatch(['A mirror'], 'a mirror', accepted), 'A mirror');
  assert.equal(
    findSpokenMatch(['the looking glass'], 'a mirror', accepted),
    'the looking glass',
  );
  assert.equal(findSpokenMatch(['MIRROR!'], 'a mirror', []), 'MIRROR!');
});

test('findSpokenMatch checks every alternative, in order', () => {
  assert.equal(
    findSpokenMatch(['a mere', 'a mirror'], 'a mirror', []),
    'a mirror',
  );
  assert.equal(
    findSpokenMatch(['a window', 'a camera'], 'a mirror', ['mirror']),
    undefined,
  );
  assert.equal(findSpokenMatch([], 'a mirror', []), undefined);
});

test('findSpokenMatch needs the whole answer, not part of it', () => {
  assert.equal(findSpokenMatch(['it is a mirror'], 'a mirror', []), undefined);
  assert.equal(
    findSpokenMatch(['steps'], 'steps', ['footsteps', 'step']),
    'steps',
  );
  assert.equal(
    findSpokenMatch(['step'], 'steps', ['footsteps', 'step']),
    'step',
  );
});
