// Session reducer: ties adapt.js suggestions to a running session. Pure.
// A session never locks a tier: `offer` is a suggestion the learner may take or ignore.
import { suggest, MIN_TIER, MAX_TIER } from './adapt.js';

export const newSession = (tier = MIN_TIER) => ({ tier: clampTier(tier), attempts: [], seen: [], offer: { kind: 'none', tier } });

export const clampTier = (t) => Math.min(MAX_TIER, Math.max(MIN_TIER, Math.trunc(Number(t)) || MIN_TIER));

/** Record an answer on `item`. `confident` is true (sure), false (unsure) or undefined (not tagged / show-answer). */
export function answer(s, item, { correct, confident }) {
  const attempts = s.attempts.concat({ tier: item.tier, correct, confident });
  return { ...s, attempts, seen: s.seen.concat(item.id), offer: suggest(attempts) };
}

/** Learner explicitly picks a tier (chooser or accepting an offer). Clears the offer and the streak. */
export function chooseTier(s, tier) {
  return { ...s, tier: clampTier(tier), attempts: [], offer: { kind: 'none', tier: clampTier(tier) } };
}

/** Tier a pending offer points to, or null (worked-example keeps the tier). */
export function offerTarget(offer) {
  if (offer.kind === 'step-up') return Math.min(MAX_TIER, offer.tier + 1);
  if (offer.kind === 'easier') return Math.max(MIN_TIER, offer.tier - 1);
  return null;
}

/** Dismiss the offer without changing tier; attempts are kept so the next miss/hit re-evaluates. */
export const dismissOffer = (s) => ({ ...s, offer: { kind: 'none', tier: s.tier } });

export const progress = (s, total) => ({ done: new Set(s.seen).size, total });
