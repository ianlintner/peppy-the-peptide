// Daily Review queue selection. Pure: clock, seed and data are all passed in.
// One "item" here is a compact retrieval card derived from already-played game items
// and each lesson's own check question; no game runner is re-used.
import { isDue, INTERVAL_DAYS } from './leitner.js';

export const SESSION_MIN = 3;
export const SESSION_MAX = 5;
export const NEW_CAP = 2; // at most two unseen items per session

/** Normalise a raw item into a review card. Returns null when the data is unusable.
 *  `lesson` must be the lesson slug (string); lesson display fields live alongside it. */
export function toCard(raw, lesson, sourceCount = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const concept = typeof raw.concept === 'string' ? raw.concept.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const answer = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  if (!id || !concept || !prompt || !answer) return null;
  const ids = Array.isArray(raw.source_ids) ? raw.source_ids.filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount) : [];
  const slug = typeof lesson === 'string' ? lesson : (lesson && lesson.slug) || '';
  return {
    id,
    concept,
    lesson: slug,
    lessonNumber: (lesson && lesson.number) || '',
    lessonTitle: (lesson && lesson.title) || slug,
    game: (lesson && lesson.game) || '',
    prompt,
    answer,
    tier: Number.isInteger(raw.tier) ? raw.tier : 1,
    misconception: typeof raw.misconception === 'string' ? raw.misconception : '',
    sourceIds: ids,
    kind: 'game',
  };
}

/** Lesson check questions become review cards with a stable `check:<slug>` id. */
export function lessonCards(lessons, sourceFilter = () => true) {
  return lessons.filter((l) => l && l.slug && l.check_question && l.check_answer).map((l) => ({
    id: 'check:' + l.slug,
    concept: 'check-' + l.slug,
    lesson: l.slug,
    lessonNumber: l.number || '',
    lessonTitle: l.title || l.slug,
    game: '',
    prompt: l.check_question,
    answer: l.check_answer,
    tier: 1,
    misconception: 'Lesson self-check',
    sourceIds: (l.sources || []).map((_, i) => i + 1).filter(sourceFilter),
    kind: 'check',
  }));
}

/** All cards from published game data + lesson checks. `games` = [{game, lesson, items}], `lessons` = content rows. */
export function allCards(games, lessons) {
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));
  const out = [];
  for (const g of games || []) {
    const lesson = bySlug.get(g.lesson) || { slug: g.lesson, number: '', title: g.lesson };
    const sources = (lesson.sources || []).length;
    for (const item of g.items || []) {
      const card = toCard(item, { ...lesson, game: g.game }, sources);
      if (card) out.push(card);
    }
  }
  return out.concat(lessonCards(lessons));
}

/** Only cards whose concept has been played at least once (mastery state has an entry). */
export function completedCards(cards, state) {
  const concepts = (state && state.concepts) || {};
  return cards.filter((c) => Object.prototype.hasOwnProperty.call(concepts, c.concept));
}

const cardSort = (a, b) => {
  if (a.due !== b.due) return a.due - b.due;
  if (a.lesson !== b.lesson) return a.lesson < b.lesson ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * Choose 3-5 retrieval cards for one session.
 * Rules: due review cards first (oldest due first), at most NEW_CAP unseen cards,
 * cards already seen today/this session are excluded, and the result is interleaved
 * across lessons (round-robin by lesson, never two of the same lesson while another
 * lesson has a candidate). Deterministic given `seed`.
 * @param {object[]} pool all candidate cards (each has id, concept, lesson)
 * @param {object} state mastery state {v, concepts}
 * @param {{now:number, seed:string|number, seen?:string[], size?:number, newCap?:number}} opts
 */
export function selectQueue(pool, state, { now, seed = 'daily', seen = [], size = SESSION_MAX, newCap = NEW_CAP }) {
  const taken = new Set(seen);
  const concepts = (state && state.concepts) || {};
  const reviews = [], fresh = [];
  for (const c of pool || []) {
    if (!c || taken.has(c.id)) continue;
    const card = concepts[c.concept];
    if (card && isDue(card, now)) reviews.push({ ...c, due: card.due, box: card.box, isNew: false });
    else if (!card) fresh.push({ ...c, due: now, box: 0, isNew: true });
  }
  reviews.sort(cardSort);
  fresh.sort(cardSort);

  // Interleave by lesson within each bucket: round-robin so one lesson cannot dominate
  // the front of the queue, while preserving due ordering inside each lesson.
  const interleave = (rows) => {
    const buckets = new Map();
    for (const c of rows) {
      if (!buckets.has(c.lesson)) buckets.set(c.lesson, []);
      buckets.get(c.lesson).push(c);
    }
    const keys = [...buckets.keys()].sort();
    const out = [];
    while (out.length < rows.length) {
      let added = false;
      for (const k of keys) {
        const b = buckets.get(k);
        if (b.length) { out.push(b.shift()); added = true; }
      }
      if (!added) break;
    }
    return out;
  };

  const target = Math.min(SESSION_MAX, Math.max(SESSION_MIN, size));
  const orderedReviews = interleave(reviews);
  // Interleave the full fresh pool before capping so the cap never reintroduces
  // two cards from the same lesson when another lesson has a candidate.
  const orderedFresh = interleave(fresh);
  // Session mix: one new card after each review, up to NEW_CAP, then reviews.
  const queue = [];
  const usedConcepts = new Set();
  let ri = 0, ni = 0, newUsed = 0;
  const push = (c) => { if (!usedConcepts.has(c.concept)) { queue.push(c); usedConcepts.add(c.concept); } };
  while (queue.length < target && (ri < orderedReviews.length || (ni < orderedFresh.length && newUsed < newCap))) {
    if (ni < orderedFresh.length && newUsed < newCap && (ri >= orderedReviews.length || queue.length % 2 === 1)) {
      const c = orderedFresh[ni++];
      push(c); newUsed++;
    } else if (ri < orderedReviews.length) push(orderedReviews[ri++]);
    else { const c = orderedFresh[ni++]; push(c); newUsed++; }
  }
  // Fill remaining capacity from the interleaved fresh order (beyond the new cap)
  // so a session still reaches SESSION_MIN and lesson round-robin is preserved.
  while (queue.length < target && ni < orderedFresh.length) push(orderedFresh[ni++]);
  // Last resort: a small session whose only candidates share a concept still
  // stays unique by concept, even if that means fewer than SESSION_MIN.
  return queue;
}

/** Count of cards due now, for the hub's "N due" badge. */
export const dueCount = (cards, state, now) => {
  const concepts = (state && state.concepts) || {};
  return cards.filter((c) => concepts[c.concept] && isDue(concepts[c.concept], now)).length;
};

/** Intervals for display (days per box), re-exported for tests/UI. */
export const boxDays = [...INTERVAL_DAYS];
