// Markup for one dev-gallery cell. The <svg> is the sole state owner: `state` goes to the renderer
// (root data-state + matching accessible name), never onto the wrapper.
import { renderPeppySvg } from './peppy-svg.js';

export function galleryCellHtml(state, id, opts = {}) {
  return `<figure><span class="peppy-frame" data-gallery="${id}">${renderPeppySvg({ id, state, ...opts })}</span><figcaption>${id}</figcaption></figure>`;
}
