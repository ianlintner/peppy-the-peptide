/**
 * Pure evaluator for the Bead Chain Builder (no DOM, storage or network; safe for node --test).
 *
 * Item modes (item.data.mode):
 *   build      learner places beads into slots; compared with data.target
 *   spot       pick the one chain with the same beads as data.target in a different order
 *   compare    name how data.other differs from data.target (same sequence / new order / different beads)
 *   sorter     bonus round: statement is true of the cartoon, of real peptides, or of both
 *   inference  does a conclusion follow from the written sequence alone?
 * Every mode derives its expected answer from the data and cross-checks it against the choice marked
 * `correct`; an authoring disagreement is reported as INCONSISTENT_ITEM, never as a learner error.
 */

export const RESIDUES = 'ACDEFGHIKLMNPQRSTVWY';
export const MODES = Object.freeze(['build', 'spot', 'compare', 'sorter', 'inference']);
export const BUCKETS = Object.freeze(['cartoon', 'real', 'both']);
export const MAX_BEADS = 7; // Peppy has seven spheres
/** Cartoon fills only; letters are always printed, so colour never carries meaning (and encodes no chemistry). */
export const PALETTE = Object.freeze(['#7cc7ea', '#f5c85b', '#e8846f', '#9fd39b', '#b6a4e0', '#7fd0c6', '#f0a96b']);

export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  INCOMPLETE: 'incomplete',
  SAME_BEADS_WRONG_ORDER: 'same-beads-wrong-order',
  WRONG_BEADS: 'wrong-beads',
  WRONG_CHOICE: 'wrong-choice',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

export function isResidueString(s, min = 3, max = MAX_BEADS) {
  return typeof s === 'string' && s.length >= min && s.length <= max && [...s].every((c) => RESIDUES.includes(c));
}

/** Letter counts, e.g. 'HAH' -> {A:1,H:2}. */
export function composition(seq) {
  const out = {};
  for (const c of seq || '') out[c] = (out[c] || 0) + 1;
  return out;
}

export function sameComposition(a, b) {
  return [...(a || '')].sort().join('') === [...(b || '')].sort().join('');
}

/** 'same-sequence' | 'same-beads-new-order' | 'different-beads'. */
export function relation(a, b) {
  if (a === b) return 'same-sequence';
  return sameComposition(a, b) ? 'same-beads-new-order' : 'different-beads';
}

/** Letter -> palette colour, by first appearance across the given sequences. */
export function beadColors(...seqs) {
  const map = {};
  let n = 0;
  for (const c of seqs.join('')) if (!(c in map)) map[c] = PALETTE[n++ % PALETTE.length];
  return map;
}

/** Peppy bead list (head = first residue = N end) for a sequence, with optional empty slots (null). */
export function beadsFor(letters, colors) {
  return [...letters].map((l) => (l ? { letter: l, color: colors[l] } : {}));
}

/**
 * Deterministic starting pool for a build item: the target's letters in a fixed scrambled order
 * that is never equal to the target (the caller supplies the shuffled order, e.g. engine/shuffle).
 */
export function poolFrom(target, shuffled) {
  const letters = [...shuffled];
  if (letters.join('') === target && letters.length > 1) letters.push(letters.shift());
  if (letters.join('') === target && letters.length > 1) letters.reverse();
  return letters;
}

export function markedCorrectId(item) {
  const correct = (item?.choices || []).filter((c) => c && c.correct === true);
  return correct.length === 1 ? (correct[0].id ?? null) : null;
}

const dataOf = (item) => (item && typeof item.data === 'object' && item.data ? item.data : {});

function result(correct, outcome, feedback, extra = {}) {
  return { correct, outcome, feedback, choiceId: null, ...extra };
}
const broken = () => result(false, OUTCOME.INCONSISTENT_ITEM, 'This item needs an authoring check before it can be scored.');

/** Expected choice id for the choice-based modes, derived from data (null if the data is unusable). */
export function expectedChoice(item) {
  const d = dataOf(item);
  switch (d.mode) {
    case 'build': return 'matches';
    case 'spot': {
      if (!isResidueString(d.target) || !d.chains) return null;
      const hits = Object.entries(d.chains).filter(([, s]) => relation(d.target, s) === 'same-beads-new-order');
      return hits.length === 1 ? hits[0][0] : null;
    }
    case 'compare': return isResidueString(d.target) && isResidueString(d.other) ? relation(d.target, d.other) : null;
    case 'sorter': return BUCKETS.includes(d.bucket) ? d.bucket : null;
    case 'inference': return typeof d.follows === 'boolean' ? (d.follows ? 'follows' : 'does-not-follow') : null;
    default: return null;
  }
}

/**
 * Score a build attempt. `placed` is an array of letters or null (empty slot), slot 0 = N end.
 */
export function evaluateBuild(item, placed) {
  const d = dataOf(item);
  const target = d.target;
  if (d.mode !== 'build' || !isResidueString(target) || markedCorrectId(item) !== 'matches') return broken();
  const slots = Array.isArray(placed) ? placed : [];
  const filled = slots.filter(Boolean).length;
  const base = { choiceId: 'differs', wrongSlots: [], target };
  if (slots.length !== target.length || filled < target.length) {
    return result(false, OUTCOME.INCOMPLETE, `Fill all ${target.length} slots first (${filled} filled).`, base);
  }
  const attempt = slots.join('');
  const wrongSlots = [...target].map((c, i) => (slots[i] === c ? -1 : i)).filter((i) => i >= 0);
  if (!wrongSlots.length) return result(true, OUTCOME.CORRECT, 'Every bead is in the target position.', { ...base, choiceId: 'matches' });
  if (sameComposition(attempt, target)) {
    return result(false, OUTCOME.SAME_BEADS_WRONG_ORDER,
      'You used the right beads in a different order: same composition, different sequence. Check slot' +
      `${wrongSlots.length > 1 ? 's' : ''} ${wrongSlots.map((i) => i + 1).join(', ')}.`, { ...base, wrongSlots });
  }
  return result(false, OUTCOME.WRONG_BEADS, 'Some beads are not in the target at all. Compare the beads in the pool with the target.', { ...base, wrongSlots });
}

/** Score a choice-mode answer (spot / compare / sorter / inference). */
export function evaluateChoice(item, choiceId) {
  const d = dataOf(item);
  const expected = expectedChoice(item);
  if (!MODES.includes(d.mode) || d.mode === 'build' || !expected || markedCorrectId(item) !== expected) return broken();
  const chosen = (item.choices || []).find((c) => c && c.id === choiceId);
  if (!chosen) return result(false, OUTCOME.INCONSISTENT_ITEM, 'That answer is not one of the choices on this card.');
  if (chosen.id === expected) return result(true, OUTCOME.CORRECT, 'That fits the evidence on the card.', { choiceId, expected });
  return result(false, OUTCOME.WRONG_CHOICE, chosen.feedback || item.explanation || '', { choiceId, expected });
}

/** Dispatcher for non-build modes; build items go through evaluateBuild. */
export function evaluateItem(item, answer) {
  return dataOf(item).mode === 'build' ? evaluateBuild(item, answer) : evaluateChoice(item, answer);
}

function checkSequenceBlock(d, where, problems, key = 'target', max = MAX_BEADS) {
  if (!isResidueString(d[key], 3, max)) problems.push(`${where}: data.${key} must be one-letter standard residues (3..${max})`);
  if (typeof d.accession !== 'string' || !/^[A-Z0-9]{6,10}$/.test(d.accession)) problems.push(`${where}: data.accession missing`);
  const m = /^(\d+)-(\d+)$/.exec(d.residues || '');
  if (!m || (isResidueString(d[key], 3, max) && Number(m[2]) - Number(m[1]) + 1 !== d[key].length)) problems.push(`${where}: data.residues must be "start-end" matching the sequence length`);
  if (typeof d.source_label !== 'string' || !d.source_label.trim()) problems.push(`${where}: data.source_label missing`);
}

/** Authoring problems for a published game's items (used by main.js and the tests). */
export function validateItems(items) {
  const problems = [];
  if (!Array.isArray(items)) return ['items must be an array'];
  const tiers = new Map();
  for (const [index, item] of items.entries()) {
    const where = `items[${index}]${item?.id ? ` (${item.id})` : ''}`;
    if (!item || typeof item !== 'object') { problems.push(`${where}: not an object`); continue; }
    const d = dataOf(item);
    if (!MODES.includes(d.mode)) { problems.push(`${where}: data.mode must be one of ${MODES.join(', ')}`); continue; }
    if (d.view !== undefined && !['cartoon', 'chemistry'].includes(d.view)) problems.push(`${where}: data.view`);
    if (['build', 'spot', 'compare'].includes(d.mode) || d.target !== undefined) checkSequenceBlock(d, where, problems);
    if (d.mode === 'sorter' && d.readout) checkSequenceBlock(d.readout, `${where}.readout`, problems, 'sequence', 40);
    if (d.mode === 'spot' && !(d.chains && Object.keys(d.chains).every((k) => isResidueString(d.chains[k])))) problems.push(`${where}: data.chains`);
    if (d.mode === 'compare' && !isResidueString(d.other)) problems.push(`${where}: data.other`);
    if (['spot', 'compare', 'sorter', 'inference', 'build'].includes(d.mode) && expectedChoice(item) !== markedCorrectId(item)) {
      problems.push(`${where}: correct choice disagrees with the data`);
    }
    if (item.tier !== 3 && (item.hint_ladder || []).length < 2) problems.push(`${where}: at least 2 hint rungs required`);
    tiers.set(item.tier, (tiers.get(item.tier) || 0) + 1);
  }
  for (const tier of [1, 2, 3]) if ((tiers.get(tier) || 0) < 6) problems.push(`tier ${tier}: need at least 6 items`);
  return problems;
}
