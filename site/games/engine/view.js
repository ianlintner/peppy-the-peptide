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
