// Pure helpers for review progress file I/O and hub recommendation labels. No DOM/state here.
import { migrate, emptyState } from '../engine/mastery.js';

/** Serialise the current mastery state as a stable, human-readable JSON file body. */
export function exportJSON(state) {
  return JSON.stringify({ app: 'peppy-the-peptide', kind: 'mastery', ...state }, null, 2) + '\n';
}

/**
 * Parse an imported JSON file. Accepts a raw mastery state or the exported wrapper.
 * Returns {state, error}; never throws, never accepts a future version.
 */
export function importJSON(text, now = Date.now()) {
  try {
    const raw = JSON.parse(text);
    const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.app === 'peppy-the-peptide' && raw.kind === 'mastery'
      ? { v: raw.v, concepts: raw.concepts } : raw;
    const res = migrate(wrapper, now);
    if (!Object.keys(res.state.concepts).length && (!wrapper || !wrapper.concepts || !Object.keys(wrapper.concepts).length)) {
      return { state: emptyState(), error: null };
    }
    return { state: res.state, error: null };
  } catch {
    return { state: null, error: 'That file is not valid progress JSON. Nothing was changed.' };
  }
}

/** Recommendation for a game row from the local mastery state: a tier and a label. */
export function recommendation(state, concepts = [], now = Date.now()) {
  const boxes = concepts.map((c) => state && state.concepts && state.concepts[c]).filter(Boolean);
  if (!boxes.length) return { tier: 0, label: 'Not started yet' };
  const best = Math.max(0, ...boxes.map((b) => b.bestTier || 0));
  const tier = Math.min(3, Math.max(1, best));
  const names = { 1: 'Curious', 2: 'College', 3: 'Mechanism' };
  const due = boxes.some((b) => b.due <= now);
  return { tier, label: `Suggested: ${names[tier]}${due ? ' · review due' : ''}` };
}

/** Human-readable per-lesson practice progress for the course map. */
export function lessonProgress(state, concepts = []) {
  const rows = concepts.map((c) => state && state.concepts && state.concepts[c]).filter(Boolean);
  if (!rows.length) return 'No practice yet';
  const seen = rows.filter((b) => b.seen > 0).length;
  const mastered = rows.filter((b) => b.bestTier >= 2).length;
  return `${seen}/${concepts.length} concepts practised · ${mastered} at College or beyond`;
}
