/**
 * Peppy — the shared layered-SVG mascot component, inlineable in any game screen.
 *
 * Geometry lives in `peppy-svg.js`; paint and state rules live in `peppy.css`. This file only
 * composes them, so the same figure ships as `site/assets/peppy.svg`, as an inlined <svg>, and
 * inside a Preact tree, without a second copy of the artwork.
 *
 * State: set `state` to one of STATES. The value lands on the wrapper's `data-state`, so CSS
 * picks the pose group, eye and mouth — there is no JS animation loop and no timer.
 *
 * Bead variant: pass `beads`, head first, as `[{letter, color}]`. Each entry optionally labels one
 * sphere with an amino-acid letter and a colour token; a colour token also picks the letter ink
 * that keeps text contrast at or above 4.5:1.
 *
 *   import { Peppy, setPeppyState, STATES } from '../ui/peppy.js';
 *   <${Peppy} state="thinking" alternative=${...} />
 *   setPeppyState(frameEl, 'cheer');   // imperative switch for a game loop
 */

import { h } from '../../vendor/preact/preact.mjs';
import { useMemo, useRef } from '../../vendor/preact/hooks.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { STATES, STATE_LABELS, renderPeppySvg } from './peppy-svg.js';

const html = htm.bind(h);

export { STATES, STATE_LABELS, renderPeppySvg };

/** Stylesheet URL resolved next to this module, so no bundler or build step is required. */
export const PEPPY_CSS_URL = new URL('./peppy.css', import.meta.url).href;

let mounted = 0;

/** Inject the mascot stylesheet once per document; a no-op without a DOM (node, prerender). */
export function ensurePeppyStyles(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || !doc.head || doc.querySelector('link[data-peppy-styles]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = PEPPY_CSS_URL;
  link.setAttribute('data-peppy-styles', '');
  doc.head.appendChild(link);
}

/** Imperatively switch a mounted figure (or any ancestor of one) to `state`. */
export function setPeppyState(el, state) {
  if (el && STATES.includes(state)) el.dataset.state = state;
  return el;
}

/** Next state in review order, wrapping; lets a control cycle expressions deterministically. */
export function nextPeppyState(state) {
  const i = STATES.indexOf(state);
  return STATES[(i + 1) % STATES.length];
}

/**
 * @param {{state?:string, beads?:{letter?:string,color?:string}[], label?:string, decorative?:boolean, size?:number}} props
 *   `state` is clamped to STATES. `label` overrides the per-state accessible name.
 *   `decorative` renders the figure with aria-hidden and no role, for purely illustrative use.
 *   `size` is the rendered width in CSS pixels (aspect ratio stays fixed).
 */
export function Peppy({ state = 'idle', beads = null, label, decorative = false, size = null }) {
  ensurePeppyStyles();
  const idRef = useRef(null);
  if (!idRef.current) {
    mounted += 1;
    idRef.current = `peppy-${mounted}`;
  }
  const active = STATES.includes(state) ? state : 'idle';
  const beadKey = beads ? JSON.stringify(beads) : '';
  // Rebuild the markup only when the beads change. When the string is unchanged Preact skips the
  // subtree, so switching `state` tweens through CSS instead of replacing the DOM.
  const markup = useMemo(() => renderPeppySvg({ id: idRef.current, beads: beads || [] }), [idRef.current, beadKey]);
  const a11y = decorative
    ? { 'aria-hidden': 'true' }
    : { role: 'img', 'aria-label': label || STATE_LABELS[active] };
  const style = size ? `--peppy-size:${Number(size)}px` : null;
  return html`<span class="peppy-frame" data-state=${active} style=${style} ...${a11y}>
    <span class="peppy-visual" dangerouslySetInnerHTML=${{ __html: markup }}></span>
  </span>`;
}
