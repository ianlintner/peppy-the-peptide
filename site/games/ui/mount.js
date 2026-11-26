/**
 * Shared entry plumbing for every game's main.js: inject the shell + game stylesheet once,
 * fetch the same-origin item JSON that build.py wrote, re-validate it, and render GameShell
 * into each `[data-game="<slug>"]` mount. Static site: no request leaves the origin.
 */
import { h, render } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { GameShell } from './GameShell.js';
import { browserStore } from './store.js';

const html = htm.bind(h);
const root = new URL('../', import.meta.url);

/** Add each stylesheet (path relative to site/games/) once per document. */
export function ensureStyles(paths, doc = document) {
  for (const rel of ['ui/shell.css', ...paths]) {
    const href = new URL(rel, root).href;
    if ([...doc.querySelectorAll('link[data-pg-style]')].some((l) => l.href === href)) continue;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-pg-style', rel);
    doc.head.appendChild(link);
  }
}

/** Read the numbered source shelf already rendered in the lesson; ids are 1-based positions. */
export function readSources(doc = document) {
  const shelf = doc.querySelector('#sources');
  if (!shelf) return [];
  return [...shelf.querySelectorAll('a[href^="http"]')].map((a) => ({
    title: a.textContent.trim() || a.getAttribute('href'),
    url: a.getAttribute('href'),
  }));
}

/**
 * Mount one game everywhere its slug appears.
 * @param {{slug: string, name: string, css: string, runner: object,
 *   validateItems: (items: object[]) => string[], decorate?: (el: Element, data: object) => void}} game
 */
export function mountGame({ slug, name, css, runner, validateItems, decorate }) {
  ensureStyles([css]);
  for (const el of document.querySelectorAll(`[data-game="${slug}"]`)) mountOne(el);

  async function mountOne(el) {
    try {
      const response = await fetch(el.dataset.items, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const problems = validateItems(data.items);
      if (problems.length) {
        console.error(`${name} authoring problems:`, problems);
        el.textContent = 'This game needs an authoring check before it can be played.';
        return;
      }
      // The build's static title/summary/noscript are the no-JS fallback; the shell has its own.
      el.replaceChildren();
      render(html`<${GameShell}
        title=${data.title}
        summary=${data.summary}
        items=${data.items}
        sources=${data.sources || readSources()}
        store=${browserStore()}
        runner=${runner}
        seed=${slug}
      />`, el);
      if (decorate) decorate(el, data);
    } catch (err) {
      el.textContent = 'The practice game could not load. The lesson above works without it.';
      console.error(`${name} failed to load:`, err);
    }
  }
}
