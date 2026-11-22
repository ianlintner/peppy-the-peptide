/**
 * Pure evaluator for Islet Dispatch (Lesson 2).
 *
 * A scenario card states a qualitative glucose state. The learner dispatches
 * one of the offered cell → signal → target plans. The evaluator scores a
 * chosen plan against the sourced triple for that state and names the
 * misconception the wrong plan commits. No DOM, storage, network or time.
 */
export const STATE = Object.freeze({
  LOW: 'low',
  ELEVATED: 'elevated',
});

/** The only two sourced triples. Qualitative: no concentrations or timings. */
export const SOURCE_TRIPLE = Object.freeze({
  [STATE.LOW]: Object.freeze({ cell: 'Alpha cell', signal: 'glucagon', target: 'liver' }),
  [STATE.ELEVATED]: Object.freeze({ cell: 'Beta cell', signal: 'insulin', target: 'many cell types' }),
});

/** Outcome codes consumed by the runner and asserted by the tests. */
export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  WRONG_CELL: 'wrong-cell',
  WRONG_SIGNAL: 'wrong-signal',
  WRONG_TARGET: 'wrong-target',
  MULTIPLE_SLOTS: 'multiple-slots',
  NO_SIGNAL: 'no-signal',
  SAME_BOTH_STATES: 'same-both-states',
  WRONG_CHOICE: 'wrong-choice',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

export const MISCONCEPTION_TEXT = Object.freeze({
  [OUTCOME.WRONG_CELL]: 'The cell and its peptide belong together: alpha cells release glucagon, beta cells release insulin.',
  [OUTCOME.WRONG_SIGNAL]: 'That signal belongs to the other islet cell; the state selects which cell responds.',
  [OUTCOME.WRONG_TARGET]: 'The target phrase belongs to the other signal; the lesson describes each one generally.',
  [OUTCOME.MULTIPLE_SLOTS]: 'More than one slot is wrong. Check the cell, then the signal, then the target.',
  [OUTCOME.NO_SIGNAL]: 'Both signals have a described source and context; the lesson does not leave the slot empty.',
  [OUTCOME.SAME_BOTH_STATES]: 'One plan cannot serve both states. The lesson contrasts two different signals.',
  [OUTCOME.WRONG_CHOICE]: 'That dispatch does not fit the scenario card.',
});

export function markedCorrectId(item) {
  const right = (item?.choices || []).filter((c) => c && c.correct === true);
  return right.length === 1 ? (right[0].id ?? null) : null;
}

/** Which source-backed triple the card should dispatch. */
export function expectedTriple(state) {
  return SOURCE_TRIPLE[state] ?? null;
}

function tripleFromOption(option) {
  if (!option || typeof option !== 'object') return null;
  const { cell, signal, target } = option;
  return typeof cell === 'string' && typeof signal === 'string' && typeof target === 'string'
    ? { cell, signal, target }
    : null;
}

function sameTriple(a, b) {
  return !!a && !!b && a.cell === b.cell && a.signal === b.signal && a.target === b.target;
}

/**
 * Score a dispatch for one item. `choiceId` is the id of a plan in
 * `item.data.options`; unknown ids and malformed items score as inconsistent.
 * @returns {{correct: boolean, outcome: string, feedback: string, expected: object|null}}
 */
export function dispatchOutcome(item, choiceId) {
  const data = item?.data;
  const expected = expectedTriple(data?.state);
  if (!data || !expected || !markedCorrectId(item)) {
    return { correct: false, outcome: OUTCOME.INCONSISTENT_ITEM, feedback: 'This item is not authorable.', expected: null };
  }
  const plan = tripleFromOption(data.options?.[choiceId]);
  if (!plan) {
    return { correct: false, outcome: OUTCOME.INCONSISTENT_ITEM, feedback: 'Unknown dispatch plan.', expected };
  }
  if (sameTriple(plan, expected)) {
    return { correct: true, outcome: OUTCOME.CORRECT, feedback: '', expected };
  }
  const wrong = ['cell', 'signal', 'target'].filter((slot) => plan[slot] !== expected[slot]);
  let outcome = OUTCOME.WRONG_CHOICE;
  if (choiceId === 'none') outcome = OUTCOME.NO_SIGNAL;
  else if (choiceId === 'same-both') outcome = OUTCOME.SAME_BOTH_STATES;
  else if (wrong.length > 1) outcome = OUTCOME.MULTIPLE_SLOTS;
  else if (wrong[0] === 'cell') outcome = OUTCOME.WRONG_CELL;
  else if (wrong[0] === 'signal') outcome = OUTCOME.WRONG_SIGNAL;
  else if (wrong[0] === 'target') outcome = OUTCOME.WRONG_TARGET;
  return {
    correct: false,
    outcome,
    feedback: MISCONCEPTION_TEXT[outcome] ?? 'That dispatch does not fit the scenario card.',
    expected,
  };
}

/** Textual rendering of a plan, used by the runner for the dispatch receipt. */
export function planText(plan) {
  if (!plan) return '';
  return `${plan.cell} → ${plan.signal} → ${plan.target}`;
}

/**
 * Content invariants for load time. Pure, so the runner can refuse malformed
 * authoring without imposing errors on the learner.
 */
export function validateItems(items) {
  if (!Array.isArray(items)) return ['items: expected an array'];
  const errors = [];
  const tiers = new Map();
  items.forEach((item, index) => {
    const where = `items[${index}]`;
    if (!item || typeof item !== 'object') { errors.push(`${where}: expected an object`); return; }
    tiers.set(item.tier, (tiers.get(item.tier) ?? 0) + 1);
    const data = item.data;
    if (!data || !expectedTriple(data.state)) errors.push(`${where}.data.state: expected low or elevated`);
    if (typeof data?.cue !== 'string' || !data.cue.trim()) errors.push(`${where}.data.cue: missing`);
    if (!data?.options || typeof data.options !== 'object') errors.push(`${where}.data.options: missing`);
    const expected = expectedTriple(data?.state);
    const answer = data?.answer;
    if (expected && !sameTriple(tripleFromOption(data?.options?.[answer]), expected)) {
      errors.push(`${where}.data.answer: not the sourced triple for this state`);
    }
    if (markedCorrectId(item) !== answer) errors.push(`${where}.choices: correct id must equal data.answer`);
    if (item.needs_review === true && typeof item.review_note !== 'string') {
      errors.push(`${where}.review_note: required for flagged items`);
    }
  });
  for (const tier of [1, 2, 3]) {
    if ((tiers.get(tier) ?? 0) < 5) errors.push(`tier ${tier}: need at least 5 items`);
  }
  return errors;
}
