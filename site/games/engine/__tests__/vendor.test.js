// Proves the vendored Preact + hooks + htm resolve and run under plain node (no bundler, no npm).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { h, options } from '../../../vendor/preact/preact.mjs';
import { useState } from '../../../vendor/preact/hooks.mjs';
import htm from '../../../vendor/htm/htm.mjs';

const vendor = (p) => new URL(`../../../vendor/${p}`, import.meta.url);

test('htm builds Preact vnodes', () => {
  const html = htm.bind(h);
  const vnode = html`<button class="x" aria-pressed="false">Go</button>`;
  assert.equal(vnode.type, 'button');
  assert.equal(vnode.props.class, 'x');
  assert.equal(typeof useState, 'function');
  assert.ok(options);
});

test('vendored files match the hashes pinned in ARCHITECTURE.md', () => {
  const arch = readFileSync(new URL('../../../../ARCHITECTURE.md', import.meta.url), 'utf8');
  for (const rel of ['preact/preact.mjs', 'preact/hooks.mjs', 'htm/htm.mjs']) {
    const digest = createHash('sha256').update(readFileSync(vendor(rel))).digest('hex');
    assert.ok(arch.includes('`' + digest + '`'), `${rel} hash not pinned`);
  }
});
