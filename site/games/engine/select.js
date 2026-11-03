// Item selection for a session. Pure and deterministic given a seed.
import { shuffle } from './shuffle.js';
import { MIN_TIER, MAX_TIER } from './adapt.js';

/**
 * Next item: an unseen item at `tier` first; else unseen at the nearest other tier (easier side
 * wins ties); else, when everything is seen, the least recently seen item at `tier`
 * (never the item just shown unless it is the only one). Returns null for an empty bank.
 * @param {object[]} items  @param {{tier:number, seen:string[], seed:number|string}} o
 */
export function pickNext(items, { tier, seen, seed }) {
  if (!items.length) return null;
  const order = shuffle(items, seed);
  const seenSet = new Set(seen);
  for (let d = 0; d <= MAX_TIER - MIN_TIER; d++) {
    for (const t of d === 0 ? [tier] : [tier - d, tier + d]) {
      const hit = order.find((i) => i.tier === t && !seenSet.has(i.id));
      if (hit) return hit;
    }
  }
  const rank = (i) => seen.lastIndexOf(i.id);
  const pool = order.filter((i) => i.tier === tier);
  const from = pool.length ? pool : order;
  const last = seen[seen.length - 1];
  const cand = from.filter((i) => i.id !== last);
  return (cand.length ? cand : from).reduce((a, b) => (rank(b) < rank(a) ? b : a));
}
