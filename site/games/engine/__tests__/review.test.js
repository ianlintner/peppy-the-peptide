import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQueue, allCards, completedCards, lessonCards, toCard, withSources, dueCount, SESSION_MIN, SESSION_MAX, boxDays } from '../review.js';
import { record, emptyState, migrate } from '../mastery.js';
import { INTERVAL_DAYS, DAY_MS } from '../leitner.js';

const T0 = 1_800_000_000_000;
const card = (id, concept, lesson, over = {}) => ({ id, concept, lesson, prompt: 'Q ' + id, answer: 'A ' + id, tier: 1, ...over });
const withDue = (raw, due) => ({ ...raw, due });

test('review cards: toCard rejects junk, keeps source ids and lesson metadata', () => {
  const l = { slug: 'foundations', number: '01', title: 'Chains', sources: [{}, {}, {}] };
  assert.equal(toCard(null, l, 3), null);
  assert.equal(toCard({ id: '', concept: 'a', prompt: 'p', explanation: 'e' }, l, 3), null);
  const c = toCard({ id: 'i', concept: 'a', prompt: 'p', explanation: 'e', source_ids: [1, 9] }, l, 3);
  assert.deepEqual([c.id, c.lessonNumber, c.sourceIds, c.kind], ['i', '01', [1], 'game']);
});

test('lesson check questions become stable review cards', () => {
  const lessons = [
    { slug: 'a', number: '01', title: 'A', check_question: 'Q?', check_answer: 'A.', sources: [1, 2] },
    { slug: 'b', number: '02', title: 'B', check_question: 'Q2?', check_answer: 'A2.', sources: [] },
  ];
  const cards = lessonCards(lessons);
  assert.deepEqual(cards.map((c) => c.id), ['check:a', 'check:b']);
  assert.deepEqual(cards[0].sourceIds, [1, 2]);
  assert.equal(cards[1].kind, 'check');
});

test('allCards merges published game items and lesson checks; completedCards filters by state', () => {
  const lessons = [
    { slug: 'a', number: '01', title: 'A', sources: [1], check_question: 'Q?', check_answer: 'A.' },
    { slug: 'b', number: '02', title: 'B', sources: [1], check_question: 'Q2?', check_answer: 'A2.' },
  ];
  const games = [{ game: 'g', lesson: 'a', items: [{ ...card('i1', 'c1', 'a'), explanation: 'Because.' }] }];
  const all = allCards(games, lessons);
  assert.deepEqual(all.map((c) => c.id), ['i1', 'check:a', 'check:b']);
  assert.deepEqual(completedCards(all, emptyState()), []);
  const state = record(emptyState(), 'c1', { tier: 1, correct: true }, T0);
  assert.deepEqual(completedCards(all, state).map((c) => c.id), ['i1']);
});

test('toCard keeps lesson as a slug string, so interleaving and source lookup work', () => {
  const lesson = { slug: 'chains', number: '01', title: 'Chains', sources: [{ title: 'S1', url: 'https://x' }, { title: 'S2', url: 'https://y' }] };
  const game = { game: 'beads', lesson: 'chains', items: [
    { id: 'i1', concept: 'c1', prompt: 'P', explanation: 'A', source_ids: [1, 2], tier: 2 },
  ] };
  const cards = allCards([game], [{ ...lesson, check_question: 'Q?', check_answer: 'A.' }]);
  const gameCard = cards.find((c) => c.id === 'i1');
  assert.equal(gameCard.lesson, 'chains');
  assert.equal(typeof gameCard.lesson, 'string');
  assert.equal(gameCard.lessonTitle, 'Chains');
  assert.equal(gameCard.game, 'beads');
  assert.deepEqual(gameCard.sourceIds, [1, 2]);
});

test('source lookup resolves by lesson slug for game cards and lesson checks', () => {
  const lessons = [{ slug: 'chains', title: 'Chains', check_question: 'Q?', check_answer: 'A.', sources: [{ title: 'S1', url: 'https://example.test/1' }] }];
  const game = { game: 'beads', lesson: 'chains', items: [{ id: 'i1', concept: 'c1', prompt: 'P', explanation: 'A', source_ids: [1], tier: 2 }] };
  const cards = withSources(allCards([game], lessons), lessons);
  assert.equal(cards.length, 2);
  for (const c of cards) {
    assert.equal(c.lesson, 'chains');
    assert.deepEqual(c.sources, lessons[0].sources);
  }
});

test('selectQueue contains no repeated concept even when many items share one', () => {
  const pool = [
    card('a1', 'shared', 'l1'), card('a2', 'shared', 'l1'), card('a3', 'shared', 'l1'),
    card('b1', 'other', 'l2'), card('b2', 'third', 'l2'),
  ];
  const q = selectQueue(pool, emptyState(), { now: T0, size: 5, seed: 0 });
  assert.equal(new Set(q.map((c) => c.concept)).size, q.length, 'one card per concept');
  assert.ok(q.length >= SESSION_MIN);
  assert.deepEqual(q.map((c) => c.lesson), ['l1', 'l2', 'l2']);
});

test('queue: due ordering (most overdue first) and interleave across lessons', () => {
  const pool = [
    card('l1a', 'a', 'l1'), card('l1b', 'b', 'l1'), card('l1c', 'c', 'l1'),
    card('l2a', 'd', 'l2'), card('l2b', 'e', 'l2'),
  ];
  let state = emptyState();
  for (const [c, due] of [['a', T0 - 10 * DAY_MS], ['b', T0 - 5 * DAY_MS], ['c', T0 - DAY_MS], ['d', T0 - 2 * DAY_MS], ['e', T0 - DAY_MS]]) {
    state = { concepts: { ...state.concepts, [c]: { box: 2, due, seen: 1, correct: 1, bestTier: 1, recent: [1] } } };
  }
  const q = selectQueue(pool, state, { now: T0, seed: 0 });
  assert.equal(q.length, 5);
  // All five due; round-robin gives l1,l2,l1,l2,l1. Within l1: a (-10), b (-5), c (-1).
  assert.deepEqual(q.map((c) => c.lesson), ['l1', 'l2', 'l1', 'l2', 'l1']);
  assert.deepEqual(q.filter((c) => c.lesson === 'l1').map((c) => c.id), ['l1a', 'l1b', 'l1c']);
  assert.deepEqual(q.filter((c) => c.lesson === 'l2').map((c) => c.id), ['l2a', 'l2b']);
});

test('queue: unseen items capped, due items fill the rest, seen excluded', () => {
  const pool = [
    card('r1', 'r1', 'l1', { due: T0 - DAY_MS }), card('r2', 'r2', 'l2', { due: T0 - 2 * DAY_MS }),
    card('n1', 'n1', 'l1'), card('n2', 'n2', 'l2'), card('n3', 'n3', 'l3'),
  ];
  let state = { concepts: {} };
  for (const c of ['r1', 'r2']) state.concepts[c] = { box: 2, due: T0 - (c === 'r1' ? DAY_MS : 2 * DAY_MS), seen: 1, correct: 1, bestTier: 1, recent: [1] };
  const q = selectQueue(pool, state, { now: T0, seed: 0 });
  assert.equal(q.length, 5, 'new cap is a soft target; session fills to SESSION_MIN');
  assert.equal(q.filter((c) => !c.isNew).length, 2);
  assert.ok(q.filter((c) => c.isNew).length <= 3);
  const again = selectQueue(pool, state, { now: T0, seed: 0, seen: q.map((c) => c.id) });
  assert.equal(again.length, 0, 'items seen this session are not repeated');
});

test('queue: new-only pool interleaves, fills to SESSION_MIN and empty pool yields empty queue', () => {
  const pool = [card('n1', 'n1', 'l1'), card('n2', 'n2', 'l1'), card('n3', 'n3', 'l2'), card('n4', 'n4', 'l2')];
  const q = selectQueue(pool, emptyState(), { now: T0, size: 5, seed: 0 });
  assert.ok(q.length >= SESSION_MIN, 'a fresh session has at least three cards');
  assert.deepEqual(q.map((c) => c.lesson), ['l1', 'l2', 'l1', 'l2']);
  assert.deepEqual(selectQueue([], emptyState(), { now: T0 }), []);
});

test('queue: size floor/ceiling, no due cards means empty queue and zero due count', () => {
  const pool = Array.from({ length: 10 }, (_, i) => card('i' + i, 'c' + i, 'l' + (i % 2)));
  const state = { concepts: {} };
  for (let i = 0; i < 10; i++) state.concepts['c' + i] = { box: 3, due: T0 + DAY_MS, seen: 1, correct: 1, bestTier: 1, recent: [1] };
  assert.equal(selectQueue(pool, state, { now: T0, size: 5, seed: 0 }).length, 0, 'nothing new or due');
  assert.equal(dueCount(pool, state, T0), 0);
  assert.equal(dueCount(pool, state, T0 + DAY_MS), 10);
  // A mixed pool with 5 due cards: size is clamped to [SESSION_MIN, SESSION_MAX].
  const due = pool.map((c) => ({ ...c }));
  for (const c of due) state.concepts[c.concept].due = T0 - DAY_MS;
  assert.equal(selectQueue(due, state, { now: T0, size: 0, seed: 0 }).length, SESSION_MIN);
  assert.equal(selectQueue(due, state, { now: T0, size: 99, seed: 0 }).length, SESSION_MAX);
});

test('queue: deterministic for a seed, not trivially identical for another', () => {
  const pool = [card('a', 'a', 'l1'), card('b', 'b', 'l1'), card('c', 'c', 'l1'), card('d', 'd', 'l1'), card('e', 'e', 'l1')];
  const opts = { now: T0, seed: 'one' };
  assert.deepEqual(selectQueue(pool, emptyState(), opts), selectQueue(pool, emptyState(), opts));
  assert.deepEqual(boxDays, INTERVAL_DAYS);
});

test('record() stores the learner confidence tag without breaking migration', () => {
  const s = record(emptyState(), 'c', { tier: 2, correct: true, confidence: 'sure' }, T0);
  assert.equal(s.concepts.c.confidence, 'sure');
  const s2 = record(s, 'c', { tier: 2, correct: false, confidence: 'unsure' }, T0 + DAY_MS);
  assert.equal(s2.concepts.c.confidence, 'unsure');
  const migrated = migrate(JSON.parse(JSON.stringify(s2)), T0).state;
  assert.equal(migrated.concepts.c.confidence, 'unsure');
  assert.equal(migrate({ v: 1, concepts: { c: { confidence: 'bogus' } } }, T0).state.concepts.c.confidence, '');
});

test('record() schedules according to Leitner and the queue reflects a miss returning to box 1', () => {
  let state = record(emptyState(), 'c', { tier: 2, correct: true }, T0);
  assert.equal(state.concepts.c.box, 2);
  assert.equal(state.concepts.c.due, T0 + INTERVAL_DAYS[1] * DAY_MS);
  const pool = [card('i', 'c', 'l')];
  assert.equal(dueCount(pool, state, T0), 0);
  state = record(state, 'c', { tier: 2, correct: false }, T0);
  assert.equal(state.concepts.c.box, 1);
  assert.equal(dueCount(pool, state, T0), 1);
});
