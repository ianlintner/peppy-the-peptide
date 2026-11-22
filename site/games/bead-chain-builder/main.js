/**
 * Entry module for the Bead Chain Builder, mounted by scripts/build.py into lesson 1.
 * Static site: the only network request is the same-origin game JSON already on disk.
 *
 * Keyboard-only run (see docs/bead-chain-builder-keyboard-walkthrough.md): Tab to a bead, Enter or
 * Space picks it up, Tab/arrow keys to a slot, Enter or Space places it; focus advances itself.
 * Pointer drag-and-drop is an optional extra, never required.
 */
import { h, render } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { GameShell } from '../ui/GameShell.js';
import { browserStore } from '../ui/store.js';
import { BeadRunner } from './BeadRunner.js';
import { validateItems } from './evaluator.js';

const html = htm.bind(h);
const root = new URL('../', import.meta.url);
const STYLES = [
  { url: new URL('ui/shell.css', root).href, attr: 'data-pg-styles' },
  { url: new URL('bead-chain-builder/bead.css', root).href, attr: 'data-bcb-styles' },
];

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

/** Read the numbered source shelf already rendered in the lesson; ids are 1-based positions. */
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
      console.error('Bead Chain Builder authoring problems:', problems);
      el.textContent = 'This game needs an authoring check before it can be played.';
      return;
    }
    render(html`<${GameShell}
      title=${data.title}
      summary=${data.summary}
      items=${data.items}
      sources=${data.sources || readSources()}
      store=${browserStore()}
      runner=${BeadRunner}
      seed=${'bead-chain-builder'}
    />`, el);
  } catch (err) {
    el.textContent = 'The practice game could not load. The lesson above works without it.';
    console.error('Bead Chain Builder failed to load:', err);
  }
}

for (const el of document.querySelectorAll('[data-game="bead-chain-builder"]')) mount(el);
