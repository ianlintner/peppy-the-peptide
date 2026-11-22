import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OUTCOME, SOURCE_TRIPLE, dispatchOutcome, expectedTriple, markedCorrectId, planText, validateItems,
} from '../evaluator.js';

const content = JSON.parse(
  readFileSync(new URL('../../../../content/games/islet-dispatch.json', import.meta.url), 'utf8'),
);
const items = content.items;
const byId = (id) => items.find((i) => i.id === id);

test('declared content is internally consistent with six items per tier', () => {
  assert.deepEqual(validateItems(items), []);
  for (const tier of [1, 2, 3]) assert.equal(items.filter((i) => i.tier === tier).length, 6);
});

test('every item has tier, misconception, sourced ids, and qualitative prose only', () => {
  const numeric = /\b\d+(?:\.\d+)?\s*(?:min|minutes|hours|mg|mL|mmol|pmol|units?)\b/i;
  const brands = /ozempic|wegovy|mounjaro|zepbound|victoza|trulicity|semaglutide|tirzepatide/i;
  for (const item of items) {
    assert.ok(item.tier && item.misconception && item.source_ids?.length, item.id);
    for (const sid of item.source_ids) assert.ok(sid === 1 || sid === 2, `${item.id}: source ${sid}`);
    const prose = [item.prompt, item.explanation, ...item.choices.flatMap((c) => [c.text, c.feedback || ''])].join(' ');
    assert.ok(!numeric.test(prose), `${item.id}: numeric physiology`);
    assert.ok(!brands.test(prose), `${item.id}: product name`);
  }
});

test('the two sourced triples are the only qualitative dispatch answers', () => {
  assert.deepEqual(expectedTriple('low'), SOURCE_TRIPLE.low);
  assert.deepEqual(expectedTriple('elevated'), SOURCE_TRIPLE.elevated);
  assert.equal(expectedTriple('normal'), null);
  assert.equal(planText(SOURCE_TRIPLE.elevated), 'Beta cell → insulin → many cell types');
});

test('a correct dispatch scores correct and carries no misconception', () => {
  for (const item of items) {
    const id = markedCorrectId(item);
    assert.equal(id, item.data.answer, item.id);
    const result = dispatchOutcome(item, id);
    assert.equal(result.correct, true, item.id);
    assert.equal(result.outcome, OUTCOME.CORRECT, item.id);
    assert.equal(result.feedback, '');
  }
});

test('cell/signal/target mismatches name the specific misconception', () => {
  const elevated = byId('t1-after-meal');
  assert.equal(dispatchOutcome(elevated, 'alpha-insulin-many-cells').outcome, OUTCOME.WRONG_CELL);
  assert.equal(dispatchOutcome(elevated, 'beta-glucagon-many-cells').outcome, OUTCOME.WRONG_SIGNAL);
  assert.equal(dispatchOutcome(elevated, 'beta-insulin-liver-only').outcome, OUTCOME.WRONG_TARGET);
  const low = byId('t1-between-meals');
  assert.equal(dispatchOutcome(low, 'beta-glucagon-many-cells').outcome, OUTCOME.WRONG_CELL);
  assert.equal(dispatchOutcome(low, 'alpha-glucagon-many-cells').outcome, OUTCOME.WRONG_TARGET);
});

test('non-answer plans and malformed items are refused, never guessed', () => {
  assert.equal(dispatchOutcome(byId('t1-qualitative'), 'none').outcome, OUTCOME.NO_SIGNAL);
  assert.equal(dispatchOutcome(byId('t2-contrast-pair'), 'same-both').outcome, OUTCOME.SAME_BOTH_STATES);
  assert.equal(dispatchOutcome(byId('t1-after-meal'), 'missing-id').outcome, OUTCOME.INCONSISTENT_ITEM);
  assert.equal(dispatchOutcome({ ...byId('t1-after-meal'), data: { state: 'odd' } }, 'x').outcome, OUTCOME.INCONSISTENT_ITEM);
});

test('tier 3 items are flagged with a review note and an evidence gap', () => {
  for (const item of items.filter((i) => i.tier === 3)) {
    assert.equal(item.needs_review, true, item.id);
    assert.ok(item.review_note?.trim(), item.id);
    assert.ok(item.data.gap?.trim(), item.id);
    assert.ok(item.worked_example?.trim(), item.id);
  }
});

test('validator rejects under-filled tiers, missing cues, and inconsistent answers', () => {
  const bad = items.filter((i) => i.tier !== 1);
  assert.ok(validateItems(bad).some((e) => e.includes('tier 1')));
  const missingCue = structuredClone(items);
  delete missingCue[0].data.cue;
  assert.ok(validateItems(missingCue).some((e) => e.includes('data.cue')));
  const badAnswer = structuredClone(items);
  badAnswer[0].data.answer = 'beta-insulin-liver-only';
  assert.ok(validateItems(badAnswer).some((e) => e.includes('data.answer')));
});
