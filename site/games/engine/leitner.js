// Leitner scheduling. Pure: `now` (ms epoch) is always passed in.
export const BOXES = 5;
export const DAY_MS = 86400000;
// Days until review for boxes 1..5. Box 1 is "due again right away" (next session).
export const INTERVAL_DAYS = [0, 1, 3, 7, 14];

export const newCard = (now) => ({ box: 1, due: now });

/** Correct moves up one box (cap 5); a miss returns to box 1. */
export function review(card, correct, now) {
  const box = correct ? Math.min(BOXES, (card ? card.box : 1) + 1) : 1;
  return { box, due: now + INTERVAL_DAYS[box - 1] * DAY_MS };
}

export const isDue = (card, now) => !card || card.due <= now;

/** Concept ids due at `now`, most overdue first; ties broken by id for determinism. */
export function dueConcepts(cards, now) {
  return Object.keys(cards)
    .filter((id) => isDue(cards[id], now))
    .sort((a, b) => cards[a].due - cards[b].due || (a < b ? -1 : 1));
}
