import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LANE, OUTCOME, boardFromSelection, evaluateBoard, initialBoard, markedCorrectId, moveStep, validateItems,
} from '../evaluator.js';

const content = JSON.parse(
  readFileSync(new URL('../../../../content/games/relay-race.json', import.meta.url), 'utf8'),
);
const items = content.items;
const byId = (id) => items.find((i) => i.id === id);

test('declared content is internally consistent with six items per tier', () => {
  assert.deepEqual(validateItems(items), []);
  for (const tier of [1, 2, 3]) assert.equal(items.filter((i) => i.tier === tier).length, 6);
});

test('every item has tier, misconception, sourced ids, and no numeric physiology', () => {
  const numeric = /\b\d+(?:\.\d+)?\s*(?:min|minutes|hours|mg|mL|mmol|pmol|units?)\b/i;
  for (const item of items) {
    assert.ok(item.tier && item.misconception && item.source_ids?.length, item.id);
    for (const sid of item.source_ids) assert.ok(sid === 1 || sid === 2, `${item.id}: source ${sid}`);
    const prose = [item.prompt, item.explanation, ...item.choices.flatMap((c) => [c.text, c.feedback || ''])].join(' ');
    assert.ok(!numeric.test(prose), `${item.id}: numeric physiology`);
  }
});

test('every shipped board starts from its declared main order and separate branch', () => {
  for (const item of items) {
    assert.equal(markedCorrectId(item), 'main-branch', item.id);
    const board = initialBoard(item);
    assert.deepEqual(board.main, item.data.main_order, item.id);
    assert.deepEqual(board.branch, item.data.branch_ids, item.id);
    const solved = { main: item.data.main_answer.slice(), branch: item.data.branch_answer.slice() };
    const result = evaluateBoard(item, solved);
    assert.equal(result.correct, true, `${item.id}: ${result.outcome}`);
    assert.equal(result.outcome, OUTCOME.CORRECT, item.id);
  }
});

test('the sourced main order is meal → L cell → receptor → glucose-dependent effect', () => {
  const item = byId('t1-relay-order');
  assert.deepEqual(item.data.main_order, ['meal', 'lcell', 'receptor', 'insulin']);
  assert.deepEqual(item.data.branch_ids, ['dpp4']);
  assert.equal(item.data.steps.dpp4.lane, LANE.BRANCH);
});

test('multi-branch ordering: swapping two main steps is a wrong order, not a branch error', () => {
  const item = byId('t1-relay-order');
  const board = initialBoard(item);
  const swapped = { ...board, main: ['meal', 'receptor', 'lcell', 'insulin'] };
  const result = evaluateBoard(item, swapped);
  assert.equal(result.correct, false);
  assert.equal(result.outcome, OUTCOME.WRONG_ORDER);
  assert.equal(result.difference, 1);
});

test('multi-branch ordering: branch in main, main in branch, and distractors are distinct findings', () => {
  const item = byId('t1-relay-order');
  const board = initialBoard(item);
  const branchInMain = { ...board, main: ['meal', 'dpp4', 'receptor', 'insulin'], branch: [] };
  assert.equal(evaluateBoard(item, branchInMain).outcome, OUTCOME.BRANCH_IN_MAIN);

  const mainInBranch = { ...board, main: ['meal', 'lcell', 'receptor'], branch: ['dpp4', 'insulin'] };
  assert.equal(evaluateBoard(item, mainInBranch).outcome, OUTCOME.MAIN_IN_BRANCH);

  const distractor = byId('t1-surface-reader');
  const withDistractor = initialBoard(distractor);
  const onBoard = { main: withDistractor.main.concat('enters'), branch: withDistractor.branch };
  assert.equal(evaluateBoard(distractor, onBoard).outcome, OUTCOME.DISTRACTOR_ON_BOARD);
});

test('repair items start with the branch card in the tray and can be moved into place', () => {
  const item = byId('t2-insert-branch');
  const start = initialBoard(item);
  assert.deepEqual(start.branch, []);
  assert.ok(start.tray.includes('dpp4'));
  const moved = moveStep(start, 'dpp4', 'to-branch');
  assert.deepEqual(moved.branch, ['dpp4']);
  assert.equal(evaluateBoard(item, moved).correct, true);
});

test('moveStep supports keyboard actions without mutating the input board', () => {
  const item = byId('t1-relay-order');
  const start = initialBoard(item);
  const moved = moveStep(start, 'insulin', 'up', 3);
  assert.deepEqual(start.main, item.data.main_order);
  assert.deepEqual(moved.main, ['meal', 'lcell', 'insulin', 'receptor']);
  const back = moveStep(moved, 'insulin', 'down', 2);
  assert.equal(evaluateBoard(item, back).correct, true);
  assert.equal(moveStep(null, 'x', 'up'), null);
});

test('boardFromSelection uses authored data for the correct choice and initial board otherwise', () => {
  const item = byId('t1-relay-order');
  assert.deepEqual(boardFromSelection(item, 'main-branch').main, item.data.main_order);
  assert.deepEqual(boardFromSelection(item, 'dpp4-in-main'), initialBoard(item));
});

test('tier 3 items are flagged with a review note and an evidence gap', () => {
  for (const item of items.filter((i) => i.tier === 3)) {
    assert.equal(item.needs_review, true, item.id);
    assert.ok(item.review_note?.trim(), item.id);
    assert.ok(item.data.gap?.trim(), item.id);
    assert.ok(item.worked_example?.trim(), item.id);
  }
});

test('validator rejects lane overlap, bad lane labels, and non-main-branch correct choices', () => {
  const overlap = structuredClone(items);
  overlap[0].data.branch_ids.push('meal');
  assert.ok(validateItems(overlap).some((e) => e.includes('lanes must be disjoint')));

  const label = structuredClone(items);
  label[0].data.steps.meal.lane = LANE.BRANCH;
  assert.ok(validateItems(label).some((e) => e.includes('expected')));

  const wrongAnswer = structuredClone(items);
  wrongAnswer[0].choices[0].correct = false;
  wrongAnswer[0].choices[0].feedback = 'no';
  wrongAnswer[0].choices[1].correct = true;
  assert.ok(validateItems(wrongAnswer).some((e) => e.includes('main-branch')));
});
