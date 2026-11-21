import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AXES, CANNOT_DETERMINE, OUTCOME, evaluateSort, markedCorrectId, validateItems,
} from '../evaluator.js';

const root = new URL('../../../../', import.meta.url);
const content = JSON.parse(readFileSync(new URL('content/games/three-axis-sorter.json', root), 'utf8'));
const item = (id) => content.items.find((i) => i.id === id);

test('all published sorter items pass the domain validator', () => {
  assert.deepEqual(validateItems(content.items), []);
});

test('every item has an axis, tier, tag, sources, feedback on distractors and 2+ hints', () => {
  for (const i of content.items) {
    assert.ok(Object.hasOwn(AXES, i.data.axis), `${i.id}: axis`);
    assert.ok(i.tier >= 1 && i.tier <= 3, `${i.id}: tier`);
    assert.ok(i.misconception?.trim(), `${i.id}: misconception`);
    assert.ok(i.source_ids?.length && i.source_ids.every((n) => Number.isInteger(n) && n >= 1 && n <= 3), `${i.id}: sources`);
    assert.ok(i.choices.filter((c) => !c.correct).every((c) => c.feedback?.trim()), `${i.id}: distractor feedback`);
    assert.ok(i.hint_ladder.length >= 2, `${i.id}: hints`);
    assert.equal(markedCorrectId(i), i.data.answer, `${i.id}: marked answer agrees with data.answer`);
  }
});

test('tier 1 and 2 sort receptor, molecule and regulatory axes correctly', () => {
  const cases = [
    ['t1-native-signal', 'same-receptor'],
    ['t1-manufactured-agonist', 'same-receptor'],
    ['t1-unrelated-signal', 'different-receptor'],
    ['t1-natural-origin', 'same-receptor'],
    ['t1-synthetic-ligand', 'same-receptor'],
    ['t1-persistence-clue', 'same-receptor'],
    ['t2-same-receptor-other-molecule', 'same-receptor'],
    ['t2-body-made-not-a-product', 'same-molecule'],
    ['t2-unapproved-claim', 'regulatory-not-reviewed'],
    ['t2-compounded-not-approved', 'regulatory-not-reviewed'],
    ['t2-structure-difference', 'same-receptor'],
    ['t2-rapid-clearance', 'same-receptor'],
  ];
  for (const [id, expected] of cases) {
    const i = item(id);
    assert.ok(i, `missing ${id}`);
    const r = evaluateSort(i, expected);
    assert.equal(r.correct, true, `${id}: ${expected} should be correct`);
    assert.equal(r.expected, expected);
    assert.equal(r.axis, i.data.axis);
    assert.equal(r.outcome, OUTCOME.CORRECT);
  }
});

test('a wrong axis returns the distractor-specific feedback and not a generic message', () => {
  const i = item('t2-same-receptor-other-molecule');
  const r = evaluateSort(i, 'same-molecule');
  assert.equal(r.correct, false);
  assert.equal(r.outcome, OUTCOME.WRONG_AXIS);
  assert.match(r.feedback, /structure differs/);
});

test('all tier 3 items are flagged, undetermined, and settled only by cannot-determine', () => {
  const tier3 = content.items.filter((i) => i.tier === 3);
  assert.equal(tier3.length, 6);
  for (const i of tier3) {
    assert.equal(i.needs_review, true, `${i.id}: needs_review`);
    assert.ok(i.review_note?.trim(), `${i.id}: review note`);
    assert.equal(i.data.undetermined, true, `${i.id}: undetermined`);
    assert.equal(i.data.answer, CANNOT_DETERMINE, `${i.id}: gap answer`);

    const right = evaluateSort(i, CANNOT_DETERMINE);
    assert.equal(right.correct, true, `${i.id}: gap choice accepted`);
    assert.equal(right.outcome, OUTCOME.CORRECT);
    assert.ok(right.missingEvidence?.trim(), `${i.id}: missing evidence surfaced`);

    for (const wrong of i.choices.filter((c) => c.id !== CANNOT_DETERMINE)) {
      const r = evaluateSort(i, wrong.id);
      assert.equal(r.correct, false, `${i.id}/${wrong.id}: rejected`);
      assert.equal(r.outcome, OUTCOME.FALSE_CERTAINTY, `${i.id}/${wrong.id}: named as false certainty`);
      assert.ok(r.feedback.trim(), `${i.id}/${wrong.id}: feedback present`);
    }
  }
});

test('a confident answer to an under-specified item is never accepted as right', () => {
  const i = JSON.parse(JSON.stringify(item('t3-missing-identity-test')));
  i.choices.find((c) => c.id === 'same-molecule').correct = true;
  i.choices.find((c) => c.id === CANNOT_DETERMINE).correct = false;
  i.data.answer = 'same-molecule';
  const r = evaluateSort(i, 'same-molecule');
  assert.equal(r.correct, false);
  assert.equal(r.outcome, OUTCOME.INCONSISTENT_ITEM);
});

test('inconsistent authoring is reported, never guessed at', () => {
  const none = JSON.parse(JSON.stringify(item('t1-native-signal')));
  for (const c of none.choices) c.correct = false;
  assert.equal(markedCorrectId(none), null);
  assert.equal(evaluateSort(none, 'same-receptor').outcome, OUTCOME.INCONSISTENT_ITEM);

  const two = JSON.parse(JSON.stringify(item('t1-native-signal')));
  two.choices[1].correct = true;
  assert.equal(markedCorrectId(two), null);

  const drift = JSON.parse(JSON.stringify(item('t1-native-signal')));
  drift.data.answer = 'different-receptor';
  assert.equal(evaluateSort(drift, 'different-receptor').outcome, OUTCOME.INCONSISTENT_ITEM);

  const badAxis = JSON.parse(JSON.stringify(item('t1-native-signal')));
  badAxis.data.axis = 'made-up';
  assert.equal(evaluateSort(badAxis, 'same-receptor').outcome, OUTCOME.INCONSISTENT_ITEM);

  const missingChoice = evaluateSort(item('t1-native-signal'), 'not-a-shelf');
  assert.equal(missingChoice.outcome, OUTCOME.INCONSISTENT_ITEM);
});

test('missing evidence is surfaced on tier 3 misses, not hidden', () => {
  const i = item('t3-marketed-vs-reviewed');
  const r = evaluateSort(i, 'reviewed-approved');
  assert.equal(r.outcome, OUTCOME.FALSE_CERTAINTY);
  assert.match(r.missingEvidence, /review record/);
});

test('validateItems catches tier shortfalls and missing notes', () => {
  const short = content.items.filter((i) => i.tier !== 3);
  const errs = validateItems(short);
  assert.ok(errs.some((e) => /tier 3: need at least 6/.test(e)));
  const noNote = JSON.parse(JSON.stringify([item('t3-missing-identity-test')]));
  delete noNote[0].review_note;
  assert.ok(validateItems(noNote).some((e) => /review note/.test(e)));
});
