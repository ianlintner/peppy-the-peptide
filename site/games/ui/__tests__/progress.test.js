import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJSON, importJSON, recommendation, lessonProgress } from '../progress.js';
import { emptyState, record } from '../../engine/mastery.js';

const T0 = 1_800_000_000_000;

test('export/import round trip keeps mastery state and rejects garbage', () => {
  const state = record(emptyState(), 'c', { tier: 2, correct: true }, T0);
  const text = exportJSON(state);
  assert.ok(text.startsWith('{\n  "app": "peppy-the-peptide"'));
  assert.deepEqual(importJSON(text, T0).state, state);
  assert.deepEqual(importJSON(JSON.stringify(state), T0).state, state);
  assert.equal(importJSON('{bad json', T0).error, 'That file is not valid progress JSON. Nothing was changed.');
});

test('import ignores a future version and empty files produce an empty state', () => {
  assert.deepEqual(importJSON(JSON.stringify({ v: 99, concepts: { a: {} } }), T0).state, emptyState());
  assert.deepEqual(importJSON('{}', T0).state, emptyState());
});

test('recommendation: not started, suggested tier from best correct, due flag', () => {
  assert.deepEqual(recommendation(emptyState(), ['a', 'b'], T0), { tier: 0, label: 'Not started yet' });
  let s = record(emptyState(), 'a', { tier: 2, correct: true }, T0);
  assert.equal(recommendation(s, ['a'], T0).tier, 2);
  assert.ok(!recommendation(s, ['a'], T0).label.includes('review due'));
  assert.ok(recommendation(s, ['a'], T0 + 2 * 86400000).label.includes('review due'));
});

test('lesson progress counts concepts and College+ mastery', () => {
  assert.equal(lessonProgress(emptyState(), ['a', 'b']), 'No practice yet');
  let s = record(emptyState(), 'a', { tier: 2, correct: true }, T0);
  assert.equal(lessonProgress(s, ['a', 'b']), '1/2 concepts practised · 1 at College or beyond');
});
