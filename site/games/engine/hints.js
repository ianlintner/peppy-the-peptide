// Hint-ladder state. Pure. Hints go gentle -> strong; "show answer" is always available
// and is tracked separately so the shell can record it as a miss without blocking the learner.

export function createLadder(hints) {
  const list = Array.isArray(hints) ? hints.filter((h) => typeof h === 'string' && h.trim()) : [];
  return { hints: list, used: 0 };
}

export const hasMore = (l) => l.used < l.hints.length;
export const nextHint = (l) => (hasMore(l) ? { ...l, used: l.used + 1 } : l);
export const shownHints = (l) => l.hints.slice(0, l.used);
/** Label for the hint button, e.g. "Hint (1 of 2)"; null when the ladder is empty or exhausted. */
export function hintLabel(l) {
  return hasMore(l) ? `Hint (${l.used + 1} of ${l.hints.length})` : null;
}
