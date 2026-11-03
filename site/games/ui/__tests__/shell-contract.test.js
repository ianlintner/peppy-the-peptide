import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));

test('GameShell and ChoiceRunner modules load and expose the runner contract', async () => {
  const shell = await import('../GameShell.js');
  const runner = await import('../ChoiceRunner.js');
  assert.equal(typeof shell.GameShell, 'function');
  assert.deepEqual(shell.TIER_NAMES, { 1: 'Curious', 2: 'College', 3: 'Mechanism' });
  assert.equal(typeof runner.ChoiceRunner, 'function');
  const item = { choices: [{ id: 'a', correct: false }, { id: 'b', correct: true }] };
  assert.deepEqual(runner.ChoiceRunner.answer(item), { correct: true, choiceId: 'b' });
});

test('shell JS+CSS stays under the 25 KB budget (unminified, excluding vendor)', () => {
  const files = ['GameShell.js', 'ChoiceRunner.js', 'store.js', 'shell.css'];
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 25 * 1024, `shell is ${total} bytes`);
});

test('shell has no timers, no network, no direct storage or randomness', () => {
  for (const f of ['GameShell.js', 'ChoiceRunner.js']) {
    const src = readFileSync(dir + f, 'utf8');
    assert.doesNotMatch(src, /setTimeout|setInterval|fetch\(|XMLHttpRequest|Math\.random|localStorage/, f);
  }
  assert.match(readFileSync(dir + 'shell.css', 'utf8'), /prefers-reduced-motion:reduce/);
});
