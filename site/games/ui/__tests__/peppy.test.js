// Acceptance for the Peppy SVG: exactly seven spheres, six states, < 12 KB, text contrast >= 4.5:1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATES, SPHERES, renderPeppySvg, pickInk, contrastRatio, relativeLuminance } from '../peppy-svg.js';

const asset = readFileSync(new URL('../../../assets/peppy.svg', import.meta.url), 'utf8');
const css = readFileSync(new URL('../peppy.css', import.meta.url), 'utf8');

test('the standalone asset has exactly seven spheres and six state poses', () => {
  assert.equal((asset.match(/<g class="peppy-sphere"/g) || []).length, 7);
  assert.equal(SPHERES.length, 7);
  assert.deepEqual([...STATES], ['idle', 'wink', 'thinking', 'oops', 'cheer', 'point']);
  for (const s of STATES) assert.ok(asset.includes(`<g class="peppy-pose" data-state="${s}"`), s);
});

test('the asset stays under 12 KB and has no network references', () => {
  assert.ok(Buffer.byteLength(asset) < 12 * 1024, `${Buffer.byteLength(asset)} B`);
  assert.doesNotMatch(asset, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  assert.doesNotMatch(asset, /@keyframes|<script|<image/);
});

test('every layer group exists and every state carries a title', () => {
  for (const g of ['peppy-coat', 'peppy-gloves', 'peppy-shoes', 'peppy-eye--wink']) assert.ok(asset.includes(g), g);
  assert.equal((asset.match(/<title[ >]/g) || []).length, 1 + STATES.length);
});

test('motion is CSS transitions only, and reduced motion keeps state changes', () => {
  assert.doesNotMatch(css, /@keyframes|animation:/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /transition-duration: 0ms/);
  assert.match(css, /data-state="cheer"\] \.peppy-pose\[data-state="cheer"\]/);
});

test('letter ink on every default sphere and on any bead colour is >= 4.5:1', () => {
  for (const s of SPHERES) assert.ok(contrastRatio(s.color, pickInk(s.color)) >= 4.5, s.color);
  for (const c of ['#fff', '#000', '#777', '#f80', '#08f', '#7cc7ea', '#b6a4e0']) {
    assert.ok(contrastRatio(c, pickInk(c)) >= 4.5, c);
  }
  assert.ok(relativeLuminance('#fff') > relativeLuminance('#000'));
});

test('beads add letters and colour tokens, still seven spheres, decorative-safe markup', () => {
  const svg = renderPeppySvg({ id: 'x', beads: [{ letter: 'A', color: '#e8846f' }, { letter: 'G' }] });
  assert.equal((svg.match(/<g class="peppy-sphere"/g) || []).length, 7);
  assert.match(svg, />A<\/text>/);
  assert.match(svg, /--sphere:#e8846f/);
  assert.throws(() => renderPeppySvg({ css: '</style><script>' }));
});
