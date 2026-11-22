// Daily Review page entry: loads the offline manifest + published game data, builds the card
// pool, mounts the UI and wires the file/reset controls. No runtime network beyond same-origin files.
import { h, render } from '../vendor/preact/preact.mjs';
import htm from '../vendor/htm/htm.mjs';
import { browserStore } from './ui/store.js';
import { allCards } from './engine/review.js';
import { exportJSON, importJSON } from './ui/progress.js';
import { ReviewUI } from './ui/review-ui.js';
const html = htm.bind(h);
const status = (text) => { const el = document.getElementById('review-tools-status'); if (el) el.textContent = text; };
const announce = (text) => { const el = document.getElementById('review-status'); if (el) el.textContent = text; };

async function loadData() {
  const manifestResponse = await fetch(new URL('./data/manifest.json', import.meta.url), { cache: 'force-cache' });
  if (!manifestResponse.ok) throw new Error('manifest');
  const manifest = await manifestResponse.json();
  const bySlug = new Map(manifest.lessons.map((l) => [l.slug, l]));
  const gamePromises = manifest.games.map((g) => fetch(new URL(`./data/${g.game}.json`, import.meta.url), { cache: 'force-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const gameData = await Promise.all(gamePromises);
  const games = manifest.games.map((g, i) => gameData[i] ? { game: g.game, lesson: g.lesson, items: gameData[i].items || [] } : null).filter(Boolean);
  const lessons = manifest.lessons.map((l) => ({ ...bySlug.get(l.slug), slug: l.slug }));
  const cards = allCards(games, lessons).map((c) => ({ ...c, sources: (bySlug.get(c.lesson) || {}).sources || [] }));
  return cards;
}

function safeName() { return 'peppy-progress-' + new Date().toISOString().slice(0, 10) + '.json'; }

async function main() {
  const mount = document.getElementById('review-mount');
  if (!mount) return;
  let cards;
  try { cards = await loadData(); }
  catch { mount.textContent = 'The review questions could not load from this site. The lessons still work.'; return; }
  const store = browserStore();
  render(html`<${ReviewUI} cards=${cards} store=${store} />`, mount);

  document.getElementById('review-export').addEventListener('click', () => {
    const text = exportJSON(store.get());
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = safeName(); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    status('Progress exported as a JSON file.'); announce('Progress exported.');
  });

  document.getElementById('review-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const result = importJSON(await file.text());
    if (result.error) { status(result.error); announce(result.error); return; }
    store.set(result.state);
    document.dispatchEvent(new CustomEvent('peppy-review-state', { detail: { state: result.state } }));
    status('Progress imported. Your review queue has been rebuilt.'); announce('Progress imported.');
  });

  document.getElementById('review-reset').addEventListener('click', () => {
    if (!window.confirm('Reset all practice progress on this browser? This cannot be undone unless you exported a file first.')) return;
    store.reset();
    document.dispatchEvent(new CustomEvent('peppy-review-state', { detail: 'reset' }));
    status('Progress reset.'); announce('Progress reset.');
  });
}

main();
