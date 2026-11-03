// Adaptive tier suggestions. Pure logic: no DOM, no storage, no clock, no randomness.
// Nothing is ever locked: these functions only *suggest* an offer; the learner decides.
// Tiers: 1 = Curious, 2 = College, 3 = Mechanism.

export const MIN_TIER = 1;
export const MAX_TIER = 3;
export const STEP_UP_STREAK = 3; // consecutive correct answers before offering a harder tier
export const EASIER_MISSES = 2; // consecutive misses before offering an easier tier / worked example

/**
 * @param {{tier:number, correct:boolean, confident?:boolean}[]} attempts oldest first, current concept only
 * @returns {{kind:'none'|'step-up'|'easier'|'worked-example', tier:number}}
 *   `tier` is the tier the learner is currently on (that of the latest attempt).
 */
export function suggest(attempts) {
  if (!attempts.length) return { kind: 'none', tier: MIN_TIER };
  const last = attempts[attempts.length - 1];
  const tier = last.tier;
  // A confident wrong answer is the strongest misconception signal: show a worked example first.
  if (!last.correct && last.confident === true) return { kind: 'worked-example', tier };
  const run = (pred) => {
    let n = 0;
    for (let i = attempts.length - 1; i >= 0 && attempts[i].tier === tier && pred(attempts[i]); i--) n++;
    return n;
  };
  if (run((a) => a.correct) >= STEP_UP_STREAK && tier < MAX_TIER) return { kind: 'step-up', tier };
  if (run((a) => !a.correct) >= EASIER_MISSES) {
    return { kind: tier > MIN_TIER ? 'easier' : 'worked-example', tier };
  }
  return { kind: 'none', tier };
}
