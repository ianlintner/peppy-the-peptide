import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IsletDispatchRunner } from '../IsletDispatchRunner.js';
import { RelayRaceRunner } from '../../relay-race/RelayRaceRunner.js';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(here, '../..');

test('both runners expose the GameShell runner contract', () => {
  for (const runner of [IsletDispatchRunner, RelayRaceRunner]) {
    assert.equal(typeof runner, 'function');
    assert.equal(typeof runner.answer, 'function', 'Show answer hook');
  }
});

test('each game stays inside its JS+CSS budget and per-file line cap', () => {
  for (const game of ['islet-dispatch', 'relay-race']) {
    const dir = join(gameRoot, game);
    const files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
    const bytes = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
    assert.ok(bytes < 40 * 1024, `${game}: ${bytes} bytes`);
    for (const f of files) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n').length;
      assert.ok(lines <= 400, `${game}/${f}: ${lines} lines`);
    }
  }
});

test('runners and evaluators contain no timers, randomness, storage or direct network', () => {
  for (const game of ['islet-dispatch', 'relay-race']) {
    for (const f of ['evaluator.js', `${game === 'islet-dispatch' ? 'IsletDispatchRunner' : 'RelayRaceRunner'}.js`]) {
      const src = readFileSync(join(gameRoot, game, f), 'utf8');
      assert.ok(!/Math\.random|setTimeout|setInterval|localStorage|sessionStorage|Date\.now|fetch\(/.test(src),
        `${game}/${f}: forbidden runtime API`);
      assert.ok(!/\bdocument\.|\bwindow\./.test(src), `${game}/${f}: direct DOM access`);
    }
  }
});
