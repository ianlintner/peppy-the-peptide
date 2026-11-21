import test from 'node:test';
import assert from 'node:assert/strict';
import { itemReset, progressText, tierNote, finishReset } from '../view.js';
import { pickNext } from '../select.js';
import { createLadder, nextHint } from '../hints.js';

const names = { 1: 'Curious', 2: 'College', 3: 'Mechanism' };

test('itemReset clears every per-item field, including the hint note', () => {
  assert.deepEqual(itemReset(), { tentative: null, confident: null, revealed: null, showSrc: false, note: '' });
  // each call is a fresh object (no shared mutable state)
  assert.notEqual(itemReset(), itemReset());
});

test('hint -> check -> next: the previous hint text does not survive a load', () => {
  let state = { ...itemReset(), note: 'Hint 1: look at the first bead' };
  const l = nextHint(createLadder(['look at the first bead']));
  assert.equal(l.used, 1);
  state = { ...state, ...itemReset() }; // what GameShell.load() applies
  assert.equal(state.note, '');
});

test('progress line names the tier of the question shown, not the preferred tier', () => {
  const items = [
    { id: 'a', tier: 1, concept: 'c' },
    { id: 'b', tier: 3, concept: 'c' },
  ];
  // learner prefers tier 1 but has exhausted it: pickNext falls back to tier 3
  const item = pickNext(items, { tier: 1, seen: ['a'], seed: 's' });
  assert.equal(item.tier, 3);
  const text = progressText({ done: 1, total: 2, revealed: null, item, tierNames: names });
  assert.match(text, /Mechanism question/);
  assert.doesNotMatch(text, /Curious/);
});

test('progress line counts: first item, after reveal, clamped at total, no item', () => {
  const item = { tier: 2 };
  assert.match(progressText({ done: 0, total: 3, revealed: null, item, tierNames: names }), /^Question 1 of 3 · 0 answered · College question$/);
  assert.match(progressText({ done: 1, total: 3, revealed: {}, item, tierNames: names }), /^Question 1 of 3 · 1 answered/);
  assert.match(progressText({ done: 3, total: 3, revealed: null, item, tierNames: names }), /^Question 3 of 3/);
  assert.equal(progressText({ done: 0, total: 0, revealed: null, item: null, tierNames: names }), 'Question 0 of 0 · 0 answered');
});

test('finish clears the hint note so it cannot resurface on the completion screen', () => {
  let st = { ...itemReset(), note: 'Hint 1: x', revealed: { correct: true } };
  st = { ...st, ...finishReset() };
  assert.equal(st.note, '');
  assert.equal(st.revealed, null);
});

test('tier announcement names the preference and, on fallback, the shown tier', () => {
  const items = [{ id: 'a', tier: 1, concept: 'c' }, { id: 'b', tier: 3, concept: 'c' }];
  const same = pickNext(items, { tier: 3, seen: [], seed: 's' });
  assert.equal(tierNote(3, same, names), 'Now practicing Mechanism questions.');
  const fb = pickNext(items, { tier: 1, seen: ['a'], seed: 's' });
  const text = tierNote(1, fb, names);
  assert.match(text, /preference set to Curious/);
  assert.match(text, /Mechanism question/);
  assert.doesNotMatch(text, /Now practicing Curious/);
  assert.match(tierNote(2, null, names), /Now practicing College/);
});
