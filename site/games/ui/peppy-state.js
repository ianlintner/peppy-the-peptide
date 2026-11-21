// DOM helpers that switch a mounted Peppy figure. No Preact import, so node tests can load it.
import { STATES, STATE_LABELS } from './peppy-svg.js';

const FRAME = '.peppy-frame';
const STANDALONE = 'svg.peppy';

/**
 * The element(s) that own a figure's `data-state`: a `.peppy-frame`, or a standalone `svg.peppy`.
 * Accepts the owner itself, anything inside one, or an ancestor containing figures. Setting state on
 * an ancestor instead would stack a second `data-state` over the frame's own and show two poses.
 */
function stateOwners(el) {
  if (typeof el.closest === 'function') {
    const own = el.closest(FRAME) || el.closest(STANDALONE);
    if (own) return [own];
  }
  if (typeof el.querySelectorAll === 'function') {
    const found = [...el.querySelectorAll(`${FRAME}, ${STANDALONE}`)].filter(
      (node) => node.matches(FRAME) || !node.closest(FRAME),
    );
    if (found.length) return found;
  }
  return []; // no figure: never write state onto an unrelated element (it would outlive a later mount)
}

/** Keep the generated accessible name in step with the state; explicit custom labels are kept. */
function syncLabel(owner, state) {
  const label = STATE_LABELS[state];
  if (owner.matches?.(FRAME)) {
    if (owner.getAttribute('role') === 'img' && !owner.hasAttribute('data-peppy-custom-label')) {
      owner.setAttribute('aria-label', label);
    }
  } else if (owner.matches?.(STANDALONE)) {
    const title = owner.querySelector('title');
    if (title) title.textContent = label;
  }
}

/** Imperatively switch a mounted figure (its frame, its svg, or any ancestor of one) to `state`. */
export function setPeppyState(el, state) {
  if (!el || !STATES.includes(state)) return el;
  for (const owner of stateOwners(el)) {
    owner.dataset.state = state;
    syncLabel(owner, state);
  }
  return el;
}
