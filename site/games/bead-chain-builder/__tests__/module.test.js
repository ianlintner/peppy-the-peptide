import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));

test('game JS+CSS stays under 40 KB and 400 lines per file', () => {
  let total = 0;
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    total += Buffer.byteLength(text);
    assert.ok(text.split('\n').length <= 400, `${f} exceeds 400 lines`);
  }
  assert.ok(total < 40 * 1024, `total ${total} bytes`);
});

test('no timers, network or randomness in game modules; reduced motion respected', () => {
  for (const f of files.filter((n) => n.endsWith('.js'))) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(text, /setTimeout|setInterval|Math\.random|XMLHttpRequest|localStorage/, f);
    if (f !== 'main.js') assert.doesNotMatch(text, /\bfetch\(/, f);
  }
  assert.match(readFileSync(new URL('bead.css', dir), 'utf8'), /prefers-reduced-motion: reduce/);
});

test('runner exposes the GameShell runner contract and the evaluator stays DOM-free', async () => {
  const text = readFileSync(new URL('evaluator.js', dir), 'utf8');
  assert.doesNotMatch(text, /document|window|import /);
  const mod = await import('../BeadRunner.js');
  assert.equal(typeof mod.BeadRunner, 'function');
  assert.equal(typeof mod.BeadRunner.answer, 'function');
  const content = JSON.parse(readFileSync(new URL('../../../../content/games/bead-chain-builder.json', import.meta.url), 'utf8'));
  const shown = mod.BeadRunner.answer(content.items[0]);
  assert.equal(shown.shownAnswer, true);
  assert.equal(shown.choiceId, 'matches');
});
