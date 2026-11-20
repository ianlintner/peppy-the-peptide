// Regression tests for the PR #4 review findings: colour tokens, wink eyes, state owner, a11y name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeColor, pickInk, contrastRatio, renderPeppySvg, STATE_LABELS } from '../peppy-svg.js';
import { setPeppyState } from '../peppy-state.js';

const css = readFileSync(new URL('../peppy.css', import.meta.url), 'utf8');

test('safeColor accepts only opaque #rgb / #rrggbb', () => {
  for (const ok of ['#fff', '#FFF', '#7cc7ea', ' #000 ']) assert.ok(safeColor(ok), ok);
  for (const bad of ['black', 'red', '#000000ff', '#0000', '#00000', '#12345', 'rgb(0,0,0)', '', null, 7]) {
    assert.equal(safeColor(bad), null, String(bad));
  }
});

test('black and alpha-hex bead colours never render black letters on black', () => {
  for (const color of ['black', '#000000ff', '#000']) {
    const svg = renderPeppySvg({ beads: [{ letter: 'A', color }] });
    const first = svg.match(/data-sphere="1"[^>]*style="([^"]*)"/)[1];
    const sphere = /--sphere:(#[0-9a-f]+)/i.exec(first);
    const ink = /--peppy-letter:(#[0-9a-f]+)/i.exec(first)[1];
    const bg = sphere ? sphere[1] : '#7cc7ea'; // refused tokens fall back to the default sphere colour
    assert.ok(contrastRatio(bg, ink) >= 4.5, `${color}: ${bg} on ${ink}`);
  }
  assert.equal(pickInk('#000'), '#ffffff');
});

test('wink keeps one open eye permanently visible', () => {
  const svg = renderPeppySvg();
  assert.match(svg, /peppy-eye--open"/);
  assert.match(svg, /peppy-eye--open-right"/);
  for (const state of ['idle', 'wink', 'thinking', 'oops', 'cheer', 'point']) {
    assert.doesNotMatch(css, new RegExp(`\\[data-state="${state}"\\] \\.peppy-eye--open \\{`), state);
  }
  assert.match(css, /data-state="wink"\] \.peppy-eye--open-right/);
  assert.match(css, /data-state="wink"\] \.peppy-eye--wink/);
});

// Minimal DOM double: just the surface setPeppyState uses.
function el(selectorsMatched, attrs = {}, parent = null) {
  const node = {
    dataset: {},
    attrs: { ...attrs },
    children: [],
    parent,
    titleNode: null,
    matches: (sel) => sel.split(',').some((s) => selectorsMatched.includes(s.trim())),
    closest(sel) {
      for (let n = this; n; n = n.parent) if (n.matches(sel)) return n;
      return null;
    },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    hasAttribute(k) { return k in this.attrs; },
    querySelector(sel) { return sel === 'title' ? this.titleNode : null; },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    },
  };
  if (parent) parent.children.push(node);
  return node;
}

test('setPeppyState on an ancestor updates the frame, not the ancestor', () => {
  const root = el(['div']);
  const frame = el(['.peppy-frame'], { role: 'img', 'aria-label': STATE_LABELS.idle }, root);
  frame.dataset.state = 'thinking';
  setPeppyState(root, 'cheer');
  assert.equal(frame.dataset.state, 'cheer');
  assert.equal(root.dataset.state, undefined);
});

test('setPeppyState from inside a frame resolves the frame', () => {
  const frame = el(['.peppy-frame'], { role: 'img', 'aria-label': STATE_LABELS.idle });
  const svg = el(['svg.peppy'], {}, frame);
  setPeppyState(svg, 'point');
  assert.equal(frame.dataset.state, 'point');
  assert.equal(svg.dataset.state, undefined);
});

test('generated aria-label follows the state; a custom label is preserved', () => {
  const frame = el(['.peppy-frame'], { role: 'img', 'aria-label': STATE_LABELS.idle });
  setPeppyState(frame, 'cheer');
  assert.equal(frame.attrs['aria-label'], STATE_LABELS.cheer);

  const custom = el(['.peppy-frame'], { role: 'img', 'aria-label': 'Mascot', 'data-peppy-custom-label': '' });
  setPeppyState(custom, 'cheer');
  assert.equal(custom.attrs['aria-label'], 'Mascot');

  const deco = el(['.peppy-frame'], { 'aria-hidden': 'true' });
  setPeppyState(deco, 'cheer');
  assert.equal(deco.attrs['aria-label'], undefined);
});

test('a standalone svg root title follows the state', () => {
  const svg = el(['svg.peppy']);
  svg.titleNode = { textContent: STATE_LABELS.idle };
  setPeppyState(svg, 'oops');
  assert.equal(svg.dataset.state, 'oops');
  assert.equal(svg.titleNode.textContent, STATE_LABELS.oops);
});

test('unknown states are ignored', () => {
  const frame = el(['.peppy-frame'], { role: 'img', 'aria-label': 'x' });
  frame.dataset.state = 'idle';
  setPeppyState(frame, 'bogus');
  assert.equal(frame.dataset.state, 'idle');
});
