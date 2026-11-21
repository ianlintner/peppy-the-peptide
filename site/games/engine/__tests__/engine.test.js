import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, rng, hashSeed } from '../shuffle.js';
import { newCard, review, isDue, dueConcepts, DAY_MS, INTERVAL_DAYS } from '../leitner.js';
import { migrate, record, emptyState, startTier, VERSION, RECENT_CAP } from '../mastery.js';
import { createLadder, nextHint, hasMore, hintLabel, shownHints } from '../hints.js';
import { pickNext } from '../select.js';
import { newSession, answer, chooseTier, offerTarget, dismissOffer, clampTier } from '../session.js';

const T0 = 1_700_000_000_000;

test('shuffle is deterministic, a permutation, and does not mutate input', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = shuffle(src, 'seed'), b = shuffle(src, 'seed');
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notDeepEqual(shuffle(src, 'other'), a);
  assert.deepEqual(shuffle([], 1), []);
  assert.deepEqual(shuffle([9], 1), [9]);
  assert.equal(hashSeed('x'), hashSeed('x'));
  const r = rng(42); for (let i = 0; i < 100; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});

test('leitner: promotion, cap, reset on miss, due dates, injectable clock', () => {
  assert.deepEqual(newCard(T0), { box: 1, due: T0 });
  let c = review(null, true, T0);
  assert.deepEqual(c, { box: 2, due: T0 + INTERVAL_DAYS[1] * DAY_MS });
  for (let i = 0; i < 10; i++) c = review(c, true, T0);
  assert.equal(c.box, 5);
  assert.equal(review(c, false, T0).box, 1);
  assert.equal(review(c, false, T0).due, T0);
  assert.equal(isDue({ box: 2, due: T0 + 1 }, T0), false);
  assert.equal(isDue({ box: 2, due: T0 }, T0), true);
  assert.equal(isDue(undefined, T0), true);
});

test('dueConcepts: only due, most overdue first, stable ties', () => {
  const cards = { b: { due: 5 }, a: { due: 5 }, c: { due: 1 }, late: { due: 99 } };
  assert.deepEqual(dueConcepts(cards, 10), ['c', 'a', 'b']);
  assert.deepEqual(dueConcepts({}, 10), []);
});

test('mastery record: first attempt, tier tracking, recent cap', () => {
  let s = record(emptyState(), 'k', { tier: 2, correct: true }, T0);
  assert.deepEqual([s.concepts.k.seen, s.concepts.k.correct, s.concepts.k.bestTier, s.concepts.k.box], [1, 1, 2, 2]);
  s = record(s, 'k', { tier: 3, correct: false }, T0);
  assert.deepEqual([s.concepts.k.bestTier, s.concepts.k.box], [2, 1]);
  for (let i = 0; i < 20; i++) s = record(s, 'k', { tier: 1, correct: true }, T0);
  assert.equal(s.concepts.k.recent.length, RECENT_CAP);
  assert.equal(emptyState().concepts.k, undefined);
});

test('mastery migrate: current, v0, garbage, newer version, bad fields', () => {
  const ok = migrate({ v: VERSION, concepts: { a: { box: 3, due: 7, seen: 2, correct: 1, bestTier: 2, recent: [1, 0] } } }, T0);
  assert.equal(ok.migrated, false);
  assert.equal(ok.state.concepts.a.box, 3);
  const v0 = migrate({ concepts: { a: { box: 9, seen: -4, recent: [1, 'x', 0] } } }, T0);
  assert.equal(v0.migrated, true);
  assert.deepEqual([v0.state.v, v0.state.concepts.a.box, v0.state.concepts.a.seen, v0.state.concepts.a.recent], [VERSION, 5, 0, [1, 0]]);
  for (const bad of [null, undefined, 5, 'x', [], { v: 99, concepts: {} }, { v: VERSION }, { v: VERSION, concepts: [] }]) {
    assert.deepEqual(migrate(bad, T0).state, emptyState());
  }
});

test('startTier: floor 1, cap 3, best correct tier across concepts', () => {
  assert.equal(startTier(emptyState(), ['a']), 1);
  const s = record(record(emptyState(), 'a', { tier: 3, correct: true }, T0), 'b', { tier: 2, correct: true }, T0);
  assert.equal(startTier(s, ['b']), 2);
  assert.equal(startTier(s, ['a', 'b']), 3);
});

test('hint ladder: steps gentle to strong, exhausts, tolerates empty/absent', () => {
  let l = createLadder(['a', ' ', 'b']);
  assert.equal(hintLabel(l), 'Hint (1 of 2)');
  l = nextHint(l); assert.deepEqual(shownHints(l), ['a']);
  l = nextHint(l); assert.equal(hasMore(l), false); assert.equal(hintLabel(l), null);
  assert.equal(nextHint(l), l);
  for (const e of [[], undefined, null]) { const x = createLadder(e); assert.equal(hintLabel(x), null); assert.deepEqual(shownHints(nextHint(x)), []); }
});

const bank = [1, 2, 3].flatMap((t) => [`a${t}`, `b${t}`].map((id) => ({ id, tier: t })));

test('pickNext: tier first, unseen first, fallbacks, avoids last, empty bank', () => {
  assert.equal(pickNext([], { tier: 1, seen: [], seed: 1 }), null);
  assert.equal(pickNext(bank, { tier: 2, seen: [], seed: 1 }).tier, 2);
  assert.equal(pickNext(bank, { tier: 2, seen: ['a2', 'b2'], seed: 1 }).tier, 1, 'nearest tier, easier side wins ties');
  const only = [{ id: 'x', tier: 3 }];
  assert.equal(pickNext(only, { tier: 1, seen: [], seed: 1 }).id, 'x', 'tier ceiling falls back across tiers');
  assert.equal(pickNext(only, { tier: 3, seen: ['x'], seed: 1 }).id, 'x', 'single item repeats');
  const allSeen = bank.map((i) => i.id);
  const n = pickNext(bank, { tier: 1, seen: allSeen, seed: 1 });
  assert.equal(n.tier, 1); assert.notEqual(n.id, allSeen[allSeen.length - 1]);
  assert.deepEqual(pickNext(bank, { tier: 1, seen: [], seed: 'q' }), pickNext(bank, { tier: 1, seen: [], seed: 'q' }));
});

const item = (tier, id = 'i') => ({ id, tier });

test('session: first item has no offer; 3 correct offers step up; never forced', () => {
  let s = newSession(1);
  assert.equal(s.offer.kind, 'none');
  s = answer(s, item(1, 'a'), { correct: true, confident: true });
  s = answer(s, item(1, 'b'), { correct: true, confident: false });
  assert.equal(s.offer.kind, 'none');
  s = answer(s, item(1, 'c'), { correct: true, confident: true });
  assert.equal(s.offer.kind, 'step-up');
  assert.equal(offerTarget(s.offer), 2);
  assert.equal(s.tier, 1, 'offer alone does not change tier');
  assert.equal(dismissOffer(s).offer.kind, 'none');
  assert.equal(dismissOffer(s).tier, 1);
  const c = chooseTier(s, 2);
  assert.deepEqual([c.tier, c.attempts.length, c.offer.kind], [2, 0, 'none']);
});

test('session: ceiling, floor, 2 misses, high-confidence-wrong, unsure-wrong, show-answer', () => {
  let s = newSession(3);
  for (const id of 'abc') s = answer(s, item(3, id), { correct: true, confident: true });
  assert.equal(s.offer.kind, 'none', 'no step up at tier 3');
  assert.equal(offerTarget({ kind: 'step-up', tier: 3 }), 3);
  let f = newSession(1);
  f = answer(f, item(1, 'a'), { correct: false, confident: false });
  assert.equal(f.offer.kind, 'none');
  f = answer(f, item(1, 'b'), { correct: false, confident: false });
  assert.equal(f.offer.kind, 'worked-example', 'tier 1 floor: worked example, not easier');
  assert.equal(offerTarget(f.offer), null);
  let m = newSession(2);
  m = answer(m, item(2, 'a'), { correct: false, confident: false });
  m = answer(m, item(2, 'b'), { correct: false, confident: undefined });
  assert.deepEqual([m.offer.kind, offerTarget(m.offer)], ['easier', 1]);
  const hc = answer(newSession(2), item(2), { correct: false, confident: true });
  assert.equal(hc.offer.kind, 'worked-example');
  assert.deepEqual([clampTier(0), clampTier(9), clampTier('x'), clampTier(2.7)], [1, 3, 1, 2]);
});
