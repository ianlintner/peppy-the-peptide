/**
 * Pure evaluator for the Three-Axis Sorter.
 *
 * The generic ChoiceRunner asks "was this choice marked correct?"; this module adds the
 * game's domain rule: the marked-correct choice must agree with the item's declared
 * `data.answer`, and an item flagged `data.undetermined` may ONLY be settled by the
 * explicit "cannot determine" choice. That second rule is what stops a learner from
 * smuggling a receptor match into the molecule or regulatory shelf.
 *
 * No DOM, no storage, no network — safe to import from node --test.
 */

export const AXES = Object.freeze({
  receptor: 'Same receptor',
  molecule: 'Same molecule',
  regulatory: 'Reviewed-approved for a stated use',
});

export const CANNOT_DETERMINE = 'cannot-determine';

/** All-choice status used by the UI and by tests. */
export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  WRONG_AXIS: 'wrong-axis',
  FALSE_CERTAINTY: 'false-certainty',
  MISSED_GAP: 'missed-gap',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

/**
 * Return the id of the unique choice marked correct, or null.
 * A malformed item (zero or several correct choices) is rejected rather than guessed.
 */
export function markedCorrectId(item) {
  const correct = (item?.choices || []).filter((c) => c && c.correct === true);
  if (correct.length !== 1) return null;
  return correct[0].id ?? null;
}

/**
 * Evaluate a learner's chosen choice id against a sorter item.
 *
 * @returns {{
 *   correct: boolean,
 *   outcome: string,
 *   choiceId: string|null,
 *   expected: string|null,
 *   axis: string|null,
 *   feedback: string,
 *   missingEvidence: string|null
 * }}
 */
export function evaluateSort(item, choiceId) {
  const data = item && typeof item.data === 'object' && item.data ? item.data : {};
  const axis = Object.hasOwn(AXES, data.axis) ? data.axis : null;
  const expected = typeof data.answer === 'string' ? data.answer : null;
  const marked = markedCorrectId(item);
  const missingEvidence = typeof data.missing_evidence === 'string' && data.missing_evidence.trim()
    ? data.missing_evidence.trim()
    : null;

  const result = (correct, outcome, feedback) => ({
    correct,
    outcome,
    choiceId: choiceId ?? null,
    expected,
    axis,
    feedback,
    missingEvidence,
  });

  // Authoring errors must never be reported to the learner as a right/wrong answer.
  if (!axis || !expected || !marked || expected !== marked) {
    return result(false, OUTCOME.INCONSISTENT_ITEM,
      'This item needs an authoring check before it can be scored.');
  }

  const chosen = (item.choices || []).find((c) => c && c.id === choiceId) || null;
  if (!chosen) {
    return result(false, OUTCOME.INCONSISTENT_ITEM, 'That answer is not one of the shelves on this card.');
  }

  if (data.undetermined === true) {
    if (expected !== CANNOT_DETERMINE) {
      return result(false, OUTCOME.INCONSISTENT_ITEM,
        'An evidence-gap item must be answered by the "cannot determine" choice.');
    }
    if (chosen.id === CANNOT_DETERMINE) {
      return result(true, OUTCOME.CORRECT, 'Right — the stated evidence cannot settle this axis.');
    }
    // A confident answer to an under-specified item is the misconception we want to name.
    return result(false, OUTCOME.FALSE_CERTAINTY, chosen.feedback || item.explanation || '');
  }

  if (chosen.id === expected) {
    return result(true, OUTCOME.CORRECT, 'That matches the shelf supported by the card.');
  }

  if (chosen.id === CANNOT_DETERMINE) {
    return result(false, OUTCOME.MISSED_GAP, chosen.feedback || item.explanation || '');
  }

  return result(false, OUTCOME.WRONG_AXIS, chosen.feedback || item.explanation || '');
}

/**
 * Validate every item in a published sorter game. Used by the item evaluator tests
 * and by the dev-time check in main.js; returns a list of authoring problems.
 */
export function validateItems(items) {
  const problems = [];
  if (!Array.isArray(items)) return ['items must be an array'];
  const tiers = new Map();
  for (const [index, item] of items.entries()) {
    const where = `items[${index}]${item?.id ? ` (${item.id})` : ''}`;
    if (!item || typeof item !== 'object') {
      problems.push(`${where}: not an object`);
      continue;
    }
    const data = item.data || {};
    if (!Object.hasOwn(AXES, data.axis)) problems.push(`${where}: data.axis must be one of ${Object.keys(AXES).join(', ')}`);
    if (markedCorrectId(item) !== data.answer) problems.push(`${where}: correct choice disagrees with data.answer`);
    if (data.undetermined === true) {
      if (data.answer !== CANNOT_DETERMINE) problems.push(`${where}: undetermined item must answer "cannot determine"`);
      if (!data.missing_evidence || !String(data.missing_evidence).trim()) problems.push(`${where}: undetermined item needs missing_evidence`);
    }
    if (item.tier === 3 && item.needs_review !== true) problems.push(`${where}: tier 3 must be needs_review: true`);
    if (item.tier === 3 && !(item.review_note || '').trim()) problems.push(`${where}: tier 3 needs a review note`);
    if (item.tier !== 3 && (item.hint_ladder || []).length < 2) problems.push(`${where}: at least 2 hint rungs required`);
    tiers.set(item.tier, (tiers.get(item.tier) || 0) + 1);
  }
  for (const tier of [1, 2, 3]) {
    if ((tiers.get(tier) || 0) < 6) problems.push(`tier ${tier}: need at least 6 items`);
  }
  return problems;
}
