/**
 * Pure evaluator for Claim Detective (Lesson 4 capstone, prebunking).
 *
 * A fictional social post is rendered as words. The learner highlights the key
 * claim with word-level keyboard selection, then classifies it as supported by
 * a cited course source / hypothesis / out of scope (needs a clinician), and
 * names the persuasion technique. Tier 3 items are partly right: only the
 * unsupported half is the claim to flag. No DOM, storage, time or network.
 */
export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  WRONG_SPAN: 'wrong-span',
  WRONG_CLASS: 'wrong-class',
  WRONG_TECHNIQUE: 'wrong-technique',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

export const CLASSIFICATIONS = Object.freeze({
  supported: 'Supported by a cited course source',
  hypothesis: 'Hypothesis, not settled by the cited source',
  'out-of-scope': 'Out of scope — needs a clinician',
});

export const TECHNIQUES = Object.freeze({
  'false-equivalence': 'False equivalence',
  'appeal-to-receptor-sameness': 'Appeal to receptor sameness',
  'unreviewed-product-reassurance': 'Unreviewed-product reassurance',
  'origin-over-evidence': 'Origin used in place of evidence',
});

const MAX_WORDS = 60;

/** Split post text into selectable words, dropping whitespace. */
export function words(post) {
  return typeof post === 'string' ? post.trim().split(/\s+/).filter(Boolean) : [];
}

/** Normalise a two-handed word selection into a half-open [start, end) span. */
export function spanForWords(anchor, focus, count) {
  const n = Math.max(0, count | 0);
  const clamp = (v) => Math.max(0, Math.min(n, v | 0));
  const a = clamp(anchor);
  const b = clamp(focus);
  if (a === b) return { start: a, end: Math.min(n, a + 1) };
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function spansEqual(a, b) {
  return !!(a && b && a.start === b.start && a.end === b.end);
}

function authoredSpan(item, id) {
  const span = (item?.data?.spans || []).find((s) => s && s.id === id);
  return span ? { start: span.start, end: span.end } : null;
}

function result(correct, outcome, extra = {}) {
  return {
    correct,
    outcome,
    choiceId: extra.choiceId ?? null,
    span: extra.span ?? null,
    expected: extra.expected ?? null,
    technique: extra.technique ?? null,
    feedback: extra.feedback ?? '',
    split: extra.split ?? false,
    shownAnswer: extra.shownAnswer === true,
  };
}

/**
 * Score highlight + classification + technique. A wrong highlight is reported
 * before the other two so the learner fixes the selection first; on a split
 * item the feedback says which part of the post was partly right.
 */
export function evaluatePost(item, selection, choiceId, techniqueId) {
  const d = item?.data || {};
  const expectedSpan = authoredSpan(item, d.answer_span);
  const marked = (item?.choices || []).find((c) => c && c.correct === true);
  const base = {
    choiceId, span: selection ?? null, expected: expectedSpan,
    technique: techniqueId, split: d.mode === 'split',
  };
  if (!expectedSpan || !marked || marked.id !== d.answer
      || !Object.hasOwn(CLASSIFICATIONS, d.answer || '')
      || !Object.hasOwn(TECHNIQUES, d.technique || '')) {
    return result(false, OUTCOME.INCONSISTENT_ITEM, {
      ...base, feedback: 'This item needs an authoring check before it can be scored.',
    });
  }
  if (!spansEqual(selection, expectedSpan)) {
    const feedback = d.mode === 'split'
      ? 'Partly right: look for the half that goes beyond the cited source, then highlight only that claim.'
      : 'Check your highlight: select the exact words that make the claim, not the surrounding post.';
    return result(false, OUTCOME.WRONG_SPAN, { ...base, feedback });
  }
  if (choiceId !== d.answer) {
    const chosen = (item.choices || []).find((c) => c && c.id === choiceId);
    const feedback = chosen?.feedback || (d.mode === 'split'
      ? 'One half of the post is supported; the highlighted half is not. Classify that half.'
      : 'That classification does not fit the highlighted claim and the cited source.');
    return result(false, OUTCOME.WRONG_CLASS, { ...base, feedback });
  }
  if (techniqueId !== d.technique) {
    return result(false, OUTCOME.WRONG_TECHNIQUE, {
      ...base,
      feedback: `The technique here is ${TECHNIQUES[d.technique]}. The post's framing, not the biology, is what gives it away.`,
    });
  }
  return result(true, OUTCOME.CORRECT, { ...base, feedback: '' });
}

/** Show-answer result consumed by GameShell's reveal path. */
export function answer(item) {
  const d = item?.data || {};
  const span = authoredSpan(item, d.answer_span);
  const marked = (item?.choices || []).find((c) => c && c.correct === true);
  return result(false, OUTCOME.CORRECT, {
    span, expected: span, choiceId: marked?.id ?? null, technique: d.technique ?? null,
    split: d.mode === 'split', shownAnswer: true,
    feedback: `Answer shown: highlight words ${span ? `${span.start + 1}–${span.end}` : '(check item data)'}, `
      + `${CLASSIFICATIONS[d.answer] || 'check item data'}; technique ${TECHNIQUES[d.technique] || 'check item data'}.`,
  });
}

/** Authoring validator; empty means the item set is internally consistent. */
export function validateItems(items) {
  if (!Array.isArray(items)) return ['items: expected an array'];
  const errors = [];
  const tiers = new Map();
  items.forEach((item, i) => {
    const where = `items[${i}]${item?.id ? ` (${item.id})` : ''}`;
    if (!item || typeof item !== 'object') { errors.push(`${where}: expected an object`); return; }
    tiers.set(item.tier, (tiers.get(item.tier) ?? 0) + 1);
    const d = item.data || {};
    const postWords = words(d.post);
    if (!postWords.length) errors.push(`${where}.data.post: non-empty post required`);
    if (postWords.length > MAX_WORDS) errors.push(`${where}.data.post: at most ${MAX_WORDS} words for keyboard selection`);
    if (!Array.isArray(d.spans) || d.spans.length < 1) {
      errors.push(`${where}.data.spans: need at least one authored span`);
    } else {
      for (const s of d.spans) {
        if (!s || !s.id || !Number.isInteger(s.start) || !Number.isInteger(s.end)
          || s.start < 0 || s.end <= s.start || s.end > postWords.length) {
          errors.push(`${where}.data.spans: need id and 0 <= start < end <= ${postWords.length}`);
        }
      }
      const ids = d.spans.map((s) => s?.id);
      if (new Set(ids).size !== ids.length) errors.push(`${where}.data.spans: span ids must be unique`);
      if (d.mode === 'split' && (d.spans.length !== 2 || !d.spans.some((s) => s.role === 'supported')
        || !d.spans.some((s) => s.role === 'unsupported'))) {
        errors.push(`${where}.data.spans: split mode needs one supported and one unsupported span`);
      }
    }
    if (!d.spans?.some((s) => s.id === d.answer_span)) errors.push(`${where}.data.answer_span: must name an authored span`);
    const marked = (item.choices || []).filter((c) => c && c.correct === true);
    if (marked.length !== 1 || marked[0].id !== d.answer || !Object.hasOwn(CLASSIFICATIONS, d.answer || '')) {
      errors.push(`${where}.choices: one correct choice must agree with data.answer`);
    }
    if (!Object.hasOwn(TECHNIQUES, d.technique || '')) errors.push(`${where}.data.technique: unknown technique`);
    // Preview rule: every item stays flagged until a qualified reviewer clears it.
    if (item.needs_review !== true) errors.push(`${where}.needs_review: Claim Detective items must be true (preview)`);
    if (!(item.review_note || '').trim()) errors.push(`${where}.review_note: required while preview is active`);
    if (item.mode === 'boss' || d.boss === true) {
      if (item.tier !== 3) errors.push(`${where}: Boss items are optional Tier 3 only`);
    }
  });
  for (const tier of [1, 2, 3]) {
    if ((tiers.get(tier) ?? 0) < 4) errors.push(`tier ${tier}: need at least 4 items`);
  }
  return errors;
}
