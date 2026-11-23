/**
 * Entry module for Claim Detective, mounted by scripts/build.py into lesson 4.
 * Static site: the only request is the same-origin game JSON already on disk.
 */
import { h, render } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { GameShell } from '../ui/GameShell.js';
import { browserStore } from '../ui/store.js';
import { ClaimDetectiveRunner } from './ClaimDetectiveRunner.js';
import { validateItems } from './evaluator.js';

const html = htm.bind(h);
const root = new URL('../', import.meta.url);
const STYLES = [
  { url: new URL('ui/shell.css', root).href, attr: 'data-pg-styles' },
  { url: new URL('claim-detective/claims.css', root).href, attr: 'data-cd-styles' },
];

/** Inject shared + game styles once; no bundler, no network beyond same-origin files. */
function ensureStyles(doc = document) {
  for (const { url, attr } of STYLES) {
    if (doc.querySelector(`link[${attr}]`)) continue;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute(attr, '');
    doc.head.appendChild(link);
  }
}
ensureStyles();

/** Read the numbered source shelf already in the lesson; ids are 1-based positions. */
function readSources() {
  const shelf = document.querySelector('#sources');
  if (!shelf) return [];
  return [...shelf.querySelectorAll('a[href^="http"]')].map((a) => ({
    title: a.textContent.trim() || a.getAttribute('href'),
    url: a.getAttribute('href'),
  }));
}

async function mount(el) {
  try {
    const response = await fetch(el.dataset.items, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const problems = validateItems(data.items);
    if (problems.length) {
      console.error('Claim Detective authoring problems:', problems);
      el.textContent = 'This game needs an authoring check before it can be played.';
      return;
    }
    const preview = data.review_mode === 'flagged'
      && data.items.every((i) => i.needs_review === true);
    if (preview) {
      const banner = document.createElement('p');
      banner.className = 'cd-preview-banner';
      banner.setAttribute('role', 'note');
      banner.textContent = 'Preview: every fictional post is awaiting clinical and regulatory review. '
        + 'Nothing here is medical advice.';
      el.appendChild(banner);
    }
    render(html`<${GameShell}
      title=${data.title}
      summary=${data.summary}
      items=${data.items}
      sources=${data.sources || readSources()}
      store=${browserStore()}
      runner=${ClaimDetectiveRunner}
      seed=${'claim-detective'}
    />`, el);
  } catch (err) {
    el.textContent = 'The practice game could not load. The lesson above works without it.';
    console.error('Claim Detective failed to load:', err);
  }
}

for (const el of document.querySelectorAll('[data-game="claim-detective"]')) mount(el);
