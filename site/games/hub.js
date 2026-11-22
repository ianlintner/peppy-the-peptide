// Games hub progress labels and course-map practice summary. Loaded on /games/index.html
// and on the course map; reads the same localStorage mastery state as the games themselves.
import { browserStore } from './ui/store.js';
import { recommendation, lessonProgress } from './ui/progress.js';

async function manifest() {
  try {
    const r = await fetch(new URL('./data/manifest.json', import.meta.url), { cache: 'force-cache' });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function main() {
  const data = await manifest();
  if (!data) return;
  const store = browserStore();
  const state = store.get();

  // Hub: recommended tier + continue state per game, from local mastery alone.
  for (const el of document.querySelectorAll('[data-mastery]')) {
    const g = data.games.find((x) => x.game === el.dataset.mastery);
    if (!g) continue;
    const rec = recommendation(state, g.concepts);
    el.textContent = rec.label + (g.concepts.some((c) => state.concepts[c]) ? ' · continue anytime' : '');
  }

  // Course map: one line of practice progress per lesson.
  for (const el of document.querySelectorAll('[data-game-progress]')) {
    const concepts = data.games.filter((g) => g.lesson === el.dataset.gameProgress).flatMap((g) => g.concepts);
    if (!concepts.length) { el.textContent = 'No game for this lesson yet'; continue; }
    el.textContent = lessonProgress(state, [...new Set(concepts)]);
  }

  if (!store.isPersistent()) {
    const status = document.getElementById('hub-status');
    if (status) status.textContent = 'Progress cannot be saved in this browser; it will reset when you leave.';
  }
}

main();
