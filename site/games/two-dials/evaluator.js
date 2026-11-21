/**
 * Pure evaluator for the Two Dials predict-observe-explain lab.
 *
 * The lab has two independent dials: clearance (quick/slow) and glucose
 * (low/mid/high). A learner first commits a prediction about which readout
 * will move, then the reveal shows the turned dial's readout moving while
 * the other readout holds steady. This module owns that rule and the
 * misconception classification; it never touches DOM, storage or network.
 *
 * Qualitative only: no numeric physiology values, no time scales, no curves.
 */
export const DIALS = Object.freeze({
  clearance: { label: 'Signal clearance', settings: ['quick', 'slow'], readout: 'Clearance' },
  glucose: { label: 'Glucose level', settings: ['low', 'mid', 'high'], readout: 'Glucose-dependence' },
});

/** All outcomes used by the UI and the tests. */
export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  LIFETIME_EXPLAINS_GLUCOSE: 'lifetime-explains-glucose',
  GLUCOSE_EXPLAINS_LIFETIME: 'glucose-explains-lifetime',
  BOTH_CHANGE: 'both-change',
  NEITHER_CHANGES: 'neither-changes',
  WRONG_CHOICE: 'wrong-choice',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

export const MISCONCEPTION_TEXT = Object.freeze({
  [OUTCOME.LIFETIME_EXPLAINS_GLUCOSE]: 'That makes clearance explain glucose-dependence — the two observations are separate.',
  [OUTCOME.GLUCOSE_EXPLAINS_LIFETIME]: 'That makes glucose level explain clearance — the two observations are separate.',
  [OUTCOME.BOTH_CHANGE]: 'That turns one dial into two; this trial moved only one readout.',
  [OUTCOME.NEITHER_CHANGES]: 'A dial was turned, so one readout does move; the other holds steady.',
  [OUTCOME.WRONG_CHOICE]: 'That statement does not fit what the reveal showed.',
});

export function markedCorrectId(item) {
  const correct = (item?.choices || []).filter((c) => c && c.correct === true);
  if (correct.length !== 1) return null;
  return correct[0].id ?? null;
}

/** Which readout should move when a dial is turned: its own. */
export function movedReadout(dial) {
  return DIALS[dial]?.readout ?? null;
}

/** Which readout holds steady when a dial is turned: the other one. */
export function heldReadout(dial) {
  return DIALS[dial] ? DIALS[dial === 'clearance' ? 'glucose' : 'clearance'].readout : null;
}

/**
 * Build the observation/reveal pair for a dial setting. Pure and reusable by
 * the runner so what the learner sees is derived from the declared data.
 *
 * @returns {{changed: string, steady: string, observation: string}}
 */
export function revealFor(dial, setting) {
  const spec = DIALS[dial];
  if (!spec || !spec.settings.includes(setting)) return null;
  return {
    changed: spec.readout,
    steady: heldReadout(dial),
    observation: `${spec.label}: ${setting}.`,
  };
}

/** Classify a misconception tag from the chosen choice id. */
export function classify(choiceId, item) {
  const id = typeof choiceId === 'string' ? choiceId : '';
  const data = item?.data || {};
  const dial = data.dial;
  if (/both|all|together|same-dial/.test(id)) return OUTCOME.BOTH_CHANGE;
  if (/neither|nothing|no-change|broken|absent/.test(id)) return OUTCOME.NEITHER_CHANGES;
  if (dial === 'clearance' && /glucose|dependence|stronger|lost/.test(id)) return OUTCOME.LIFETIME_EXPLAINS_GLUCOSE;
  if (dial === 'glucose' && /clearance|lifetime|persist|digestion/.test(id)) return OUTCOME.GLUCOSE_EXPLAINS_LIFETIME;
  // A learner who names the opposite dial's readout also conflates the dials.
  if (dial === 'clearance' && /glucose-moves/.test(id)) return OUTCOME.LIFETIME_EXPLAINS_GLUCOSE;
  if (dial === 'glucose' && /only-clearance|clearance-moves/.test(id)) return OUTCOME.GLUCOSE_EXPLAINS_LIFETIME;
  return OUTCOME.WRONG_CHOICE;
}

/**
 * Evaluate a learner's prediction and best-statement explanation against an item.
 *
 * `prediction` is the choice id selected before the reveal; `explanation` is
 * the id of the picked one-line statement (optional, for runners that use it).
 * The evaluator refuses to score malformed authoring as right or wrong.
 */
export function evaluatePrediction(item, prediction, explanation = null) {
  const data = item && typeof item.data === 'object' && item.data ? item.data : {};
  const expected = typeof data.answer === 'string' ? data.answer : null;
  const marked = markedCorrectId(item);
  const reveal = revealFor(data.dial, data.setting);
  const result = (correct, outcome, feedback) => ({
    correct,
    outcome,
    prediction: prediction ?? null,
    explanation: explanation ?? null,
    expected,
    dial: data.dial ?? null,
    readout: reveal ? reveal.changed : null,
    steady: reveal ? reveal.steady : null,
    observation: reveal ? reveal.observation : null,
    feedback,
    missingEvidence: typeof data.missing_evidence === 'string' && data.missing_evidence.trim()
      ? data.missing_evidence.trim()
      : null,
  });

  // Authoring consistency: exactly one correct choice, it must agree with
  // data.answer, the dial/setting must be declared and within the qualitative set.
  if (!expected || !marked || expected !== marked || !reveal || !data.invariant) {
    return result(false, OUTCOME.INCONSISTENT_ITEM,
      'This item needs an authoring check before it can be scored.');
  }
  const chosen = (item.choices || []).find((c) => c && c.id === prediction) || null;
  if (!chosen) {
    return result(false, OUTCOME.INCONSISTENT_ITEM,
      'That is not one of the statements on this card.');
  }

  if (chosen.id === expected) {
    return result(true, OUTCOME.CORRECT,
      'That matches the reveal: one readout moved and the other held steady.');
  }

  const outcome = classify(chosen.id, item);
  const feedback = chosen.feedback || MISCONCEPTION_TEXT[outcome] || item.explanation || '';
  return result(false, outcome, feedback);
}

/**
 * Authoring validator for a Two Dials game. Returns a list of problems;
 * empty means the content is internally consistent and safe to publish.
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
    if (!Object.hasOwn(DIALS, data.dial)) {
      problems.push(`${where}: data.dial must be one of ${Object.keys(DIALS).join(', ')}`);
    }
    if (!DIALS[data.dial]?.settings.includes(data.setting)) {
      problems.push(`${where}: data.setting is not a qualitative setting of that dial`);
    }
    if (markedCorrectId(item) !== data.answer) {
      problems.push(`${where}: correct choice disagrees with data.answer`);
    }
    if (data.invariant !== (data.dial === 'clearance' ? 'glucose-dependence' : 'clearance')) {
      problems.push(`${where}: data.invariant must name the other readout`);
    }
    // A flagged item must state what evidence is missing: the Tier 3 critique
    // rule asks learners to say what would be needed, not to invent a why.
    if (item.tier === 3) {
      if (item.needs_review !== true) problems.push(`${where}: tier 3 must be needs_review: true`);
      if (!(item.review_note || '').trim()) problems.push(`${where}: tier 3 needs a review note`);
      if (!(data.missing_evidence || '').trim()) problems.push(`${where}: tier 3 needs missing_evidence`);
    }
    if (item.tier !== 3 && (item.hint_ladder || []).length < 2) {
      problems.push(`${where}: at least 2 hint rungs required`);
    }
    tiers.set(item.tier, (tiers.get(item.tier) || 0) + 1);
  }
  for (const tier of [1, 2, 3]) {
    if ((tiers.get(tier) || 0) < 6) problems.push(`tier ${tier}: need at least 6 items`);
  }
  return problems;
}
