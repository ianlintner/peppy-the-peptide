// Pure view helpers for GameShell so the per-item reset and the progress label are node-testable.

/** Everything that belongs to ONE displayed item. Applied on every load so nothing leaks to the next question. */
export const itemReset = () => ({ tentative: null, confident: null, revealed: null, showSrc: false, note: '' });

/**
 * Progress line. The tier shown is the tier of the question on screen (`item.tier`): pickNext may fall
 * back to another tier when the preferred one is exhausted. The learner's preferred tier stays on the chooser.
 */
export function progressText({ done, total, revealed, item, tierNames }) {
  const n = Math.min(done + (revealed ? 0 : 1), total);
  const tier = item && tierNames[item.tier] ? ` · ${tierNames[item.tier]} question` : '';
  return `Question ${n} of ${total} · ${done} answered${tier}`;
}

/** Polite announcement after the learner picks a tier. Names the preference, and the shown question's tier when pickNext fell back. */
export function tierNote(preferred, item, tierNames) {
  const pref = tierNames[preferred];
  if (!item || item.tier === preferred) return `Now practicing ${pref} questions.`;
  return `Tier preference set to ${pref}. No unseen ${pref} questions are left, so this is a ${tierNames[item.tier]} question.`;
}

/** Finish (last item revealed -> completion screen): drop all per-item text, including a hint note. */
export const finishReset = () => ({ revealed: null, note: '' });
