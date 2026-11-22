/**
 * RED-first tests for Claim Detective (Lesson 4 capstone, prebunking).
 * Run: node --test site/games/claim-detective/__tests__/evaluator.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME, words, spanForWords, spansEqual, evaluatePost, answer, validateItems,
} from '../evaluator.js';

const item = (overrides = {}) => ({
  id: 't1-example',
  tier: 1,
  concept: 'claim-evidence',
  needs_review: true,
  review_note: 'Pending clinical review of fictional social-post wording.',
  prompt: 'Fictional post: "Same receptor means same molecule."',
  choices: [
    { id: 'supported', text: 'Supported by a cited source', correct: true, feedback: '' },
    { id: 'hypothesis', text: 'Hypothesis only', correct: false, feedback: 'The source does not support that.' },
    { id: 'out-of-scope', text: 'Out of scope', correct: false, feedback: 'The lesson shelf does answer receptor questions.' },
  ],
  explanation: 'Sharing a receptor does not settle molecular identity.',
  hint_ladder: ['Name the claim.', 'Check the source shelf.'],
  source_ids: [1],
  data: {
    mode: 'single',
    post: 'Same receptor means same molecule.',
    spans: [
      { id: 'A', start: 0, end: 2, role: 'claim' },
      { id: 'B', start: 3, end: 5, role: 'context' },
    ],
    answer_span: 'A',
    answer: 'supported',
    technique: 'appeal-to-receptor-sameness',
  },
  ...overrides,
});

test('words() splits on whitespace and keeps indices for keyboard selection', () => {
  assert.deepEqual(words('  Same receptor means  same molecule. '), [
    'Same', 'receptor', 'means', 'same', 'molecule.',
  ]);
});

test('spanForWords() builds a half-open word span and tolerates out-of-order selection', () => {
  assert.deepEqual(spanForWords(4, 1, 5), { start: 1, end: 4 });
  assert.deepEqual(spanForWords(1, 1, 5), { start: 1, end: 2 });
  assert.deepEqual(spanForWords(0, 0, 3), { start: 0, end: 1 });
});

test('spansEqual() compares half-open word spans, not array identity', () => {
  assert.equal(spansEqual({ start: 0, end: 2 }, { start: 0, end: 2 }), true);
  assert.equal(spansEqual({ start: 0, end: 2 }, { start: 0, end: 3 }), false);
  assert.equal(spansEqual(null, { start: 0, end: 2 }), false);
});

test('evaluatePost() requires an exact highlighted claim span', () => {
  const good = evaluatePost(item(), { start: 0, end: 2 }, 'supported', 'appeal-to-receptor-sameness');
  assert.equal(good.correct, true);
  assert.equal(good.outcome, OUTCOME.CORRECT);
  const wrongSpan = evaluatePost(item(), { start: 0, end: 3 }, 'supported', 'appeal-to-receptor-sameness');
  assert.equal(wrongSpan.correct, false);
  assert.equal(wrongSpan.outcome, OUTCOME.WRONG_SPAN);
  assert.match(wrongSpan.feedback, /highlight/i);
  const partial = evaluatePost(item(), { start: 0, end: 1 }, 'supported', 'appeal-to-receptor-sameness');
  assert.equal(partial.outcome, OUTCOME.WRONG_SPAN);
});

test('evaluatePost() scores classification and technique independently of the span', () => {
  const wrongClass = evaluatePost(item(), { start: 0, end: 2 }, 'hypothesis', 'appeal-to-receptor-sameness');
  assert.equal(wrongClass.outcome, OUTCOME.WRONG_CLASS);
  const wrongTechnique = evaluatePost(item(), { start: 0, end: 2 }, 'supported', 'false-equivalence');
  assert.equal(wrongTechnique.outcome, OUTCOME.WRONG_TECHNIQUE);
  assert.match(wrongTechnique.feedback, /technique/i);
});

test('evaluatePost() scores partly-right split claims against both authored spans', () => {
  const split = item({
    id: 't3-split',
    choices: [
      { id: 'supported', text: 'Supported by a cited source', correct: false, feedback: 'That half is supported; highlight the other half.' },
      { id: 'hypothesis', text: 'Hypothesis only', correct: true, feedback: '' },
      { id: 'out-of-scope', text: 'Out of scope', correct: false, feedback: 'The cited source settles this.' },
    ],
    data: {
      mode: 'split',
      post: 'The body makes a short-lived signal and a receptor agonist is the same molecule.',
      spans: [
        { id: 'supported', start: 0, end: 8, role: 'supported' },
        { id: 'unsupported', start: 9, end: 13, role: 'unsupported' },
      ],
      answer_span: 'unsupported',
      answer: 'hypothesis',
      technique: 'unreviewed-product-reassurance',
    },
  });
  const good = evaluatePost(split, { start: 9, end: 13 }, 'hypothesis', 'unreviewed-product-reassurance');
  assert.equal(good.correct, true);
  const halfRight = evaluatePost(split, { start: 9, end: 13 }, 'supported', 'unreviewed-product-reassurance');
  assert.equal(halfRight.outcome, OUTCOME.WRONG_CLASS);
  assert.match(halfRight.feedback, /supported/i);
});

test('answer() reveals the authored span and classification', () => {
  const shown = answer(item());
  assert.equal(shown.shownAnswer, true);
  assert.equal(shown.correct, false);
  assert.equal(shown.choiceId, 'supported');
  assert.deepEqual(shown.span, { start: 0, end: 2 });
  assert.match(shown.feedback, /Answer shown/i);
});

test('validateItems() enforces preview mode and content invariants', () => {
  // validateItems checks the shipped-game tier floor, so pass a full tier set.
  const good = [1, 2, 3].flatMap((tier) => [1, 2, 3, 4].map((n) => item({ id: `t${tier}-${n}`, tier })));
  assert.deepEqual(validateItems(good), []);
  const notFlagged = good.map((i, idx) => idx === 0 ? { ...i, needs_review: false } : i);
  assert.ok(validateItems(notFlagged).some((e) => /needs_review/.test(e)));
  const noNote = good.map((i, idx) => idx === 0 ? { ...i, review_note: '' } : i);
  assert.ok(validateItems(noNote).some((e) => /review_note/.test(e)));
  const badSpan = good.map((i, idx) => idx === 0 ? { ...i, data: { ...i.data, spans: [{ id: 'A', start: 2, end: 1 }] } } : i);
  assert.ok(validateItems(badSpan).some((e) => /spans/.test(e)));
  const missingSpan = good.map((i, idx) => idx === 0 ? { ...i, data: { ...i.data, answer_span: 'Z' } } : i);
  assert.ok(validateItems(missingSpan).some((e) => /answer_span/.test(e)));
});

test('validateItems() rejects a post longer than the keyboard can address', () => {
  const tooMany = Array.from({ length: 61 }, (_, i) => `w${i}`).join(' ');
  const long = [{ ...item(), data: { ...item().data, post: tooMany } }];
  assert.ok(validateItems(long).some((e) => /post/.test(e)));
});
