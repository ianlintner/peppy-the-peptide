import test from 'node:test';
import assert from 'node:assert/strict';
import { suggest, STEP_UP_STREAK } from '../adapt.js';

const a = (tier, correct, confident) => ({ tier, correct, confident });

test('no attempts: nothing to suggest', () => {
  assert.deepEqual(suggest([]), { kind: 'none', tier: 1 });
});

test('three consecutive correct at one tier offers a step up', () => {
  assert.equal(STEP_UP_STREAK, 3);
  assert.deepEqual(suggest([a(1, true), a(1, true), a(1, true)]), { kind: 'step-up', tier: 1 });
  assert.equal(suggest([a(1, true), a(1, true)]).kind, 'none');
});

test('no step up beyond tier 3', () => {
  assert.equal(suggest([a(3, true), a(3, true), a(3, true)]).kind, 'none');
});

test('a miss breaks the streak and a streak does not span tiers', () => {
  assert.equal(suggest([a(1, true), a(1, true), a(1, false), a(1, true)]).kind, 'none');
  assert.equal(suggest([a(1, true), a(1, true), a(2, true)]).kind, 'none');
});

test('two misses offer an easier tier, or a worked example at tier 1', () => {
  assert.deepEqual(suggest([a(2, false), a(2, false)]), { kind: 'easier', tier: 2 });
  assert.deepEqual(suggest([a(1, false), a(1, false)]), { kind: 'worked-example', tier: 1 });
});

test('a confident wrong answer triggers a worked example immediately', () => {
  assert.deepEqual(suggest([a(2, false, true)]), { kind: 'worked-example', tier: 2 });
  assert.equal(suggest([a(2, false, false)]).kind, 'none');
});
