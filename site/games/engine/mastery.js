// Per-concept mastery state: versioned, serialisable, migrated on load. Pure.
import { newCard, review } from './leitner.js';

export const VERSION = 1;
export const RECENT_CAP = 10;

export const emptyState = () => ({ v: VERSION, concepts: {} });

const num = (x, d) => (Number.isFinite(x) ? x : d);

function cleanConcept(c, now) {
  const base = newCard(now);
  return {
    box: Math.min(5, Math.max(1, Math.trunc(num(c && c.box, base.box)))),
    due: num(c && c.due, base.due),
    seen: Math.max(0, Math.trunc(num(c && c.seen, 0))),
    correct: Math.max(0, Math.trunc(num(c && c.correct, 0))),
    bestTier: Math.min(3, Math.max(0, Math.trunc(num(c && c.bestTier, 0)))),
    recent: Array.isArray(c && c.recent) ? c.recent.filter((x) => x === 0 || x === 1).slice(-RECENT_CAP) : [],
  };
}

/**
 * Accept anything read from storage. Unversioned objects with a `concepts` map are v0 and are
 * upgraded; garbage or a *newer* version yields a fresh state (never throws, never crashes the UI).
 * Returns {state, migrated}.
 */
export function migrate(raw, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { state: emptyState(), migrated: false };
  const v = raw.v === undefined ? 0 : raw.v;
  if (v !== 0 && v !== VERSION) return { state: emptyState(), migrated: false };
  if (!raw.concepts || typeof raw.concepts !== 'object' || Array.isArray(raw.concepts)) {
    return { state: emptyState(), migrated: v === 0 };
  }
  const concepts = {};
  for (const id of Object.keys(raw.concepts)) concepts[id] = cleanConcept(raw.concepts[id], now);
  return { state: { v: VERSION, concepts }, migrated: v === 0 };
}

/** Record one attempt for a concept; returns a new state. `correct` must be a real correct answer (show-answer = false). */
export function record(state, concept, { tier, correct }, now) {
  const prev = cleanConcept(state.concepts[concept], now);
  const card = review(state.concepts[concept] ? prev : null, correct, now);
  const next = {
    ...prev,
    ...card,
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    bestTier: correct ? Math.max(prev.bestTier, tier) : prev.bestTier,
    recent: prev.recent.concat(correct ? 1 : 0).slice(-RECENT_CAP),
  };
  return { ...state, concepts: { ...state.concepts, [concept]: next } };
}

export const conceptOf = (state, concept) => state.concepts[concept] || null;

/** Tier to open at: the highest tier answered correctly across these concepts (floor 1, cap 3). */
export const startTier = (state, concepts) => {
  const best = Math.max(0, ...concepts.map((c) => (state.concepts[c] ? state.concepts[c].bestTier : 0)));
  return Math.min(3, Math.max(1, best));
};
