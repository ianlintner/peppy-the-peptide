import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEY } from '../store.js';
import { record, emptyState } from '../../engine/mastery.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const NOW = () => 1_700_000_000_000;

test('persists and reloads', () => {
  const st = mem();
  const a = createStore(st, NOW);
  a.set(record(a.get(), 'c', { tier: 1, correct: true }, NOW()));
  assert.equal(a.isPersistent(), true);
  assert.equal(createStore(st, NOW).get().concepts.c.seen, 1);
});

test('unversioned v0 data is migrated and rewritten with a version', () => {
  const st = mem();
  st.setItem(KEY, JSON.stringify({ concepts: { c: { box: 2 } } }));
  const s = createStore(st, NOW);
  assert.equal(s.get().concepts.c.box, 2);
  assert.equal(JSON.parse(st.getItem(KEY)).v, 1);
});

test('corrupt JSON falls back to empty, in-memory only', () => {
  const st = mem(); st.setItem(KEY, '{nope');
  const s = createStore(st, NOW);
  assert.deepEqual(s.get(), emptyState());
  assert.equal(s.isPersistent(), false);
  s.set(record(s.get(), 'c', { tier: 1, correct: true }, NOW()));
  assert.equal(st.getItem(KEY), '{nope', 'does not overwrite after a read failure');
  assert.equal(s.get().concepts.c.seen, 1);
});

test('storage unavailable, getItem throws, setItem throws: never throws, keeps working', () => {
  const n = createStore(null, NOW);
  assert.equal(n.isPersistent(), false);
  n.set(record(n.get(), 'c', { tier: 1, correct: true }, NOW()));
  assert.equal(n.get().concepts.c.seen, 1);
  const g = createStore({ getItem() { throw new Error('denied'); }, setItem() {}, removeItem() {} }, NOW);
  assert.equal(g.isPersistent(), false);
  const q = createStore({ getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } }, NOW);
  q.set(record(q.get(), 'c', { tier: 1, correct: true }, NOW()));
  assert.equal(q.isPersistent(), false);
  assert.equal(q.get().concepts.c.seen, 1);
  assert.doesNotThrow(() => q.reset());
  assert.deepEqual(q.get(), emptyState());
});
