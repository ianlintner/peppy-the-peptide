import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIALS,
  OUTCOME,
  evaluatePrediction,
  validateItems,
  revealFor,
  markedCorrectId,
  movedReadout,
  heldReadout,
  classify,
} from '../evaluator.js';

const content = JSON.parse(
  readFileSync(new URL('../../../../content/games/two-dials.json', import.meta.url), 'utf8'),
);
const items = content.items;

test('declared content is internally consistent and has six items per tier', () => {
  assert.deepEqual(validateItems(items), []);
  for (const tier of [1, 2, 3]) {
    assert.equal(items.filter((i) => i.tier === tier).length, 6);
  }
});

test('every item has tier, misconception, source ids, and no numeric physiology', () => {
  const physiology = /\b(?:\d+(?:\.\d+)?)\s*(?:min|minutes|hours|pmol|mmol|mg|mL)\b/i;
  for (const item of items) {
    assert.ok(item.tier, `${item.id}: tier`);
    assert.ok(item.misconception, `${item.id}: misconception`);
    assert.ok(item.source_ids?.length, `${item.id}: source_ids`);
    for (const sid of item.source_ids) assert.ok(sid === 1 || sid === 2, `${item.id}: source id ${sid}`);
    const prose = [item.prompt, item.explanation, ...item.choices.map((c) => c.text + (c.feedback || ''))].join(' ');
    assert.ok(!physiology.test(prose), `${item.id}: numeric physiology value`);
  }
});

test('reveal derives the moved and steady readouts from the dial only', () => {
  assert.deepEqual(revealFor('clearance', 'slow'), {
    changed: 'Clearance',
    steady: 'Glucose-dependence',
    observation: 'Signal clearance: slow.',
  });
  assert.deepEqual(revealFor('glucose', 'high'), {
    changed: 'Glucose-dependence',
    steady: 'Clearance',
    observation: 'Glucose level: high.',
  });
  assert.equal(revealFor('clearance', 'nonsense'), null);
  assert.equal(movedReadout('glucose'), 'Glucose-dependence');
  assert.equal(heldReadout('glucose'), 'Clearance');
  assert.deepEqual(Object.keys(DIALS), ['clearance', 'glucose']);
});

test('the marked correct choice matches data.answer for all items', () => {
  for (const item of items) assert.equal(markedCorrectId(item), item.data.answer, item.id);
});

test('correct predictions score as correct with reveal evidence', () => {
  for (const item of items) {
    const result = evaluatePrediction(item, item.data.answer);
    assert.equal(result.correct, true, item.id);
    assert.equal(result.outcome, OUTCOME.CORRECT, item.id);
    assert.equal(result.readout, movedReadout(item.data.dial), item.id);
    assert.equal(result.steady, heldReadout(item.data.dial), item.id);
    assert.ok(result.observation, item.id);
  }
});

test('the best-statement explanation can be scored when supplied', () => {
  const item = items.find((i) => i.id === 't2-best-explanation-independence');
  const wrong = item.choices.find((c) => !c.correct);
  const result = evaluatePrediction(item, wrong.id, item.data.answer);
  assert.equal(result.correct, false);
  assert.equal(result.explanation, item.data.answer);
});

test('misconceptions classify by dial relationship', () => {
  const clearanceItem = items.find((i) => i.data.dial === 'clearance');
  const glucoseItem = items.find((i) => i.data.dial === 'glucose');
  assert.equal(classify('both-change', clearanceItem), OUTCOME.BOTH_CHANGE);
  assert.equal(classify('glucose-only', clearanceItem), OUTCOME.LIFETIME_EXPLAINS_GLUCOSE);
  assert.equal(classify('clearance-only', glucoseItem), OUTCOME.GLUCOSE_EXPLAINS_LIFETIME);
  assert.equal(classify('neither-changes', clearanceItem), OUTCOME.NEITHER_CHANGES);
});

test('each tier 3 critique carries the missing evidence it asks for', () => {
  for (const item of items.filter((i) => i.tier === 3)) {
    assert.equal(item.needs_review, true, item.id);
    assert.ok(item.review_note, item.id);
    const result = evaluatePrediction(item, item.data.answer);
    assert.ok(result.missingEvidence, item.id);
  }
});

test('malformed items refuse to score instead of guessing', () => {
  const broken = {
    id: 'broken', tier: 1, choices: [{ id: 'a', correct: true }, { id: 'b', correct: true }],
    data: { dial: 'clearance', setting: 'slow', answer: 'a', invariant: 'glucose-dependence' },
  };
  assert.equal(evaluatePrediction(broken, 'a').outcome, OUTCOME.INCONSISTENT_ITEM);
  assert.equal(evaluatePrediction(items[0], 'not-a-choice').outcome, OUTCOME.INCONSISTENT_ITEM);
});
