import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OUTCOME, beadColors, composition, evaluateBuild, evaluateChoice, evaluateItem, expectedChoice,
  isResidueString, poolFrom, relation, sameComposition, validateItems,
} from '../evaluator.js';

const root = new URL('../../../../', import.meta.url);
const content = JSON.parse(readFileSync(new URL('content/games/bead-chain-builder.json', root), 'utf8'));
const item = (id) => content.items.find((i) => i.id === id);

test('shipped items pass the domain validator and carry tier, tag, sources, feedback, hints', () => {
  assert.deepEqual(validateItems(content.items), []);
  for (const i of content.items) {
    assert.ok(i.misconception.trim() && i.source_ids.every((n) => n >= 1 && n <= 3), i.id);
    assert.ok(i.choices.filter((c) => !c.correct).every((c) => c.feedback.trim()), i.id);
    assert.equal(expectedChoice(i), i.choices.find((c) => c.correct).id, i.id);
    if (i.data.accession) assert.match(i.data.source_label, /UniProt P0\d{4}/, i.id);
  }
});

test('composition and relation separate order from beads', () => {
  assert.deepEqual(composition('HAH'), { H: 2, A: 1 });
  assert.ok(sameComposition('FVNQHLC', 'CLHQNVF'));
  assert.equal(relation('HAEGTFT', 'HAEGTFT'), 'same-sequence');
  assert.equal(relation('HAEGTFT', 'HAEGTTF'), 'same-beads-new-order');
  assert.equal(relation('HAEGTFT', 'HAEGTFS'), 'different-beads');
  assert.ok(isResidueString('HAEGTFT') && !isResidueString('HAEGTFB') && !isResidueString('HA'));
});

test('build: correct order, wrong order with same beads, wrong beads, incomplete', () => {
  const it = item('build-glp1-start');
  const ok = evaluateBuild(it, [...'HAEGTFT']);
  assert.equal(ok.correct, true);
  assert.equal(ok.choiceId, 'matches');
  const swapped = evaluateBuild(it, [...'HAEGTTF']);
  assert.equal(swapped.outcome, OUTCOME.SAME_BEADS_WRONG_ORDER);
  assert.deepEqual(swapped.wrongSlots, [5, 6]);
  assert.match(swapped.feedback, /same composition, different sequence/);
  assert.equal(evaluateBuild(it, [...'HAEGTFS']).outcome, OUTCOME.WRONG_BEADS);
  assert.equal(evaluateBuild(it, ['H', 'A', null, null, null, null, null]).outcome, OUTCOME.INCOMPLETE);
  assert.equal(evaluateBuild(it, undefined).outcome, OUTCOME.INCOMPLETE);
});

test('build: repeated letters are interchangeable', () => {
  assert.equal(evaluateBuild(item('build-insulin-a-start'), [...'GIVEQCC']).correct, true);
});

test('pool is never already the target', () => {
  assert.notEqual(poolFrom('HAEGTFT', [...'HAEGTFT']).join(''), 'HAEGTFT');
  assert.deepEqual([...poolFrom('HAEGTFT', [...'HAEGTFT'])].sort(), [...'HAEGTFT'].sort());
});

test('spot: only the reordered chain is right; copies and substitutions are not', () => {
  const it = item('spot-glp1-swap');
  assert.equal(evaluateChoice(it, 'b').correct, true);
  assert.equal(evaluateChoice(it, 'a').correct, false);
  assert.match(evaluateChoice(it, 'c').feedback, /composition/);
  assert.equal(evaluateChoice(item('spot-glucagon-reversed'), 'a').correct, true);
});

test('compare names composition vs sequence', () => {
  assert.equal(evaluateChoice(item('compare-same'), 'same-sequence').correct, true);
  assert.equal(evaluateChoice(item('compare-reordered'), 'same-beads-new-order').correct, true);
  assert.equal(evaluateChoice(item('compare-reordered'), 'different-beads').correct, false);
  assert.equal(evaluateChoice(item('compare-different'), 'different-beads').correct, true);
});

test('sorter buckets: cartoon, real, both', () => {
  assert.equal(evaluateChoice(item('cc-beads-round'), 'cartoon').correct, true);
  assert.equal(evaluateChoice(item('cc-side-chains'), 'real').correct, true);
  assert.equal(evaluateChoice(item('cc-side-chains'), 'both').correct, false);
  assert.equal(evaluateChoice(item('cc-direction-readout'), 'both').correct, true);
});

test('inference: activity cannot be read from sequence alone', () => {
  assert.equal(evaluateChoice(item('inf-glp1-activity'), 'does-not-follow').correct, true);
  const wrong = evaluateChoice(item('inf-glp1-activity'), 'follows');
  assert.equal(wrong.correct, false);
  assert.ok(wrong.feedback.length > 10);
  assert.equal(evaluateChoice(item('inf-glp1-ends'), 'follows').correct, true);
  assert.equal(evaluateItem(item('inf-glp1-ends'), 'nonsense').outcome, OUTCOME.INCONSISTENT_ITEM);
});

test('authoring-invalid payloads are flagged, never scored', () => {
  const bad = structuredClone(item('spot-glp1-swap'));
  bad.choices.find((c) => c.id === 'a').correct = true; // two correct
  assert.equal(evaluateChoice(bad, 'b').outcome, OUTCOME.INCONSISTENT_ITEM);
  const disagree = structuredClone(item('inf-glp1-activity'));
  disagree.data.follows = true;
  assert.equal(evaluateChoice(disagree, 'follows').outcome, OUTCOME.INCONSISTENT_ITEM);
  assert.equal(evaluateBuild({ data: { mode: 'build', target: 'HAZ' }, choices: [] }, []).outcome, OUTCOME.INCONSISTENT_ITEM);
  const probs = validateItems([{ id: 'x', tier: 1, data: { mode: 'build', target: 'HAEGTFB', accession: 'P01275', residues: '98-104', source_label: 'x' }, choices: [] }]);
  assert.ok(probs.some((p) => /target must be one-letter/.test(p)));
  assert.ok(validateItems([{ id: 'y', tier: 2, data: { mode: 'dance' } }]).some((p) => /data.mode/.test(p)));
  assert.deepEqual(validateItems('nope'), ['items must be an array']);
});

test('bead colours are stable per letter within an item', () => {
  const c = beadColors('HAEGTFT');
  assert.equal(Object.keys(c).length, 6);
  assert.ok(Object.values(c).every((v) => /^#[0-9a-f]{6}$/i.test(v)));
});
