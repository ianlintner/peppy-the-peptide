import test from 'node:test';
import assert from 'node:assert/strict';
import { newSession, answer, progress } from '../session.js';

const cases = [
  [7, 3],
  [0, 1],
  [-3, 1],
  ['2', 2],
  ['x', 1],
  [2.9, 2],
];

for (const [arg, tier] of cases) {
  test(`newSession(${JSON.stringify(arg)}) clamps tier and its first offer`, () => {
    const s = newSession(arg);
    assert.equal(s.tier, tier);
    assert.deepEqual(s.offer, { kind: 'none', tier });
  });
}

test('newSession() with no argument starts at tier 1', () => {
  const s = newSession();
  assert.equal(s.tier, 1);
  assert.deepEqual(s.offer, { kind: 'none', tier: 1 });
});

const item = (id, tier = 1) => ({ id, tier });

test('progress counts repeat answers to the same item once', () => {
  let s = newSession();
  s = answer(s, item('a'), { correct: true });
  s = answer(s, item('a'), { correct: false });
  assert.deepEqual(progress(s, 10), { done: 1, total: 10 });
});

test('progress counts two different answered items', () => {
  let s = newSession();
  s = answer(s, item('a'), { correct: true });
  s = answer(s, item('b'), { correct: false });
  assert.deepEqual(progress(s, 10), { done: 2, total: 10 });
});

test('progress leaves total unchanged', () => {
  const s = newSession();
  assert.equal(progress(s, 42).total, 42);
  assert.equal(progress(s, 0).total, 0);
});
