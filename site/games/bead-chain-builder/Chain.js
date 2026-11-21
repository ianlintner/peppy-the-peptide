/**
 * Chain display shared by every bead-chain item: the same residues drawn either as coloured cartoon
 * beads on Peppy, or as plain one-letter codes with a labelled N -> C direction.
 * Letters are always printed, so colour never carries meaning (and encodes no chemistry).
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { Peppy } from '../ui/peppy.js';
import { beadsFor } from './evaluator.js';

const html = htm.bind(h);

export const NOTES = {
  cartoon: 'Cartoon view: coloured beads on Peppy, head bead first (the N end). The cartoon leaves out side chains, bond geometry and the chemistry at the two ends of the chain. Bead colours are only for telling beads apart.',
  chemistry: 'Chemistry view: one-letter codes, read from the N end to the C end. A string of letters is a label for each residue. It still leaves out side-chain structure, bond geometry and end chemistry.',
};

export const spell = (letters) => [...letters].map((l) => l || 'empty').join(', ');

/** One bead: coloured round chip in the cartoon, plain boxed letter in the chemistry view. */
export function Bead({ letter, colors, view, state = '' }) {
  const style = view === 'cartoon' && letter ? `background:${colors[letter]}` : null;
  return html`<span class=${`bcb-bead bcb-${view}`} data-state=${state} style=${style}>${letter || '·'}</span>`;
}

/**
 * @param {{letters:(string|null)[], colors:object, view:string, label:string, peppyState?:string, size?:number, showPeppy?:boolean}} p
 * `letters` may contain nulls (empty slots in a build).
 */
export function Chain({ letters, colors, view, label, peppyState = 'idle', size = 84, showPeppy = true }) {
  const arr = [...letters];
  const strip = html`<span class="bcb-strip" aria-hidden="true">
    <span class="bcb-end">N</span><span class="bcb-arrow">→</span>
    ${arr.map((l) => html`<${Bead} letter=${l} colors=${colors} view=${view} />`)}
    <span class="bcb-arrow">→</span><span class="bcb-end">C</span>
  </span>`;
  const readable = `${label}: ${spell(arr)}, read from the N end to the C end.`;
  return html`<div class="bcb-chain" data-view=${view} role="group" aria-label=${readable}>
    ${view === 'cartoon' && showPeppy && html`<${Peppy} state=${peppyState} beads=${beadsFor(arr, colors)} size=${size} label=${`Peppy's bead chain, head first: ${spell(arr)}`} />`}
    ${view === 'chemistry' ? strip : html`<span class="bcb-caption">${strip}</span>`}
  </div>`;
}

/** Cartoon / chemistry toggle: two pressed-state buttons, text labels, never colour alone. */
export function ViewToggle({ view, onView }) {
  return html`<div class="bcb-toggle" role="group" aria-label="Chain view">
    ${[['cartoon', 'Cartoon view'], ['chemistry', 'Chemistry view (one-letter codes)']].map(([id, text]) =>
      html`<button type="button" class="pg-btn" aria-pressed=${view === id} onClick=${() => onView(id)}>${text}</button>`)}
  </div>`;
}
