import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const dir = new URL('..', import.meta.url);

test('ReviewUI and progress modules load; ReviewUI is a component', async () => {
  const ui = await import('../review-ui.js');
  const progress = await import('../progress.js');
  assert.equal(typeof ui.ReviewUI, 'function');
  assert.equal(typeof progress.recommendation, 'function');
});

test('review UI keeps the budget and stays timerless, offline and storage-free', () => {
  const files = ['review-ui.js', 'progress.js', '../engine/review.js'];
  const total = files.reduce((n, f) => n + statSync(new URL(f, dir)).size, 0);
  assert.ok(total < 25 * 1024, `review layer is ${total} bytes`);
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /setTimeout|setInterval|fetch\(|XMLHttpRequest|Math\.random|localStorage/, f);
  }
});

test('review shell markup: aria-live, confidence, sources, reduced motion', () => {
  const ui = readFileSync(new URL('review-ui.js', dir), 'utf8');
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /How sure are you before revealing/);
  assert.match(ui, /Sources for this question/);
  assert.match(ui, /Nothing due right now/);
  const css = readFileSync(new URL('../../review.css', dir), 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.sr-only/);
});
