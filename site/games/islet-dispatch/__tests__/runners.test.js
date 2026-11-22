import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IsletDispatchRunner } from '../IsletDispatchRunner.js';
import { RelayRaceRunner } from '../../relay-race/RelayRaceRunner.js';
import { markedCorrectId as isletCorrectId } from '../evaluator.js';
import { critiqueCorrectId } from '../../relay-race/evaluator.js';
import { shuffle } from '../../engine/shuffle.js';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(here, '../..');
const published = (name) => JSON.parse(readFileSync(join(here, '../../../../content/games', name), 'utf8'));

test('both runners expose the GameShell runner contract', () => {
  for (const runner of [IsletDispatchRunner, RelayRaceRunner]) {
    assert.equal(typeof runner, 'function');
    assert.equal(typeof runner.answer, 'function', 'Show answer hook');
  }
});

test('the correct choice is not always displayed first in either game', () => {
  const cases = [
    ['islet-dispatch.json', (item) => isletCorrectId(item)],
    ['relay-race.json', (item) => critiqueCorrectId(item)],
  ];
  for (const [file, correctId] of cases) {
    const items = published(file).items.filter((item) => item.choices?.some((c) => c.id === correctId(item)));
    assert.ok(items.length >= 6, `${file}: expected choice items`);
    const positions = items.map((item) => {
      const ordered = shuffle(item.choices, item.id);
      assert.deepEqual(ordered.slice().sort((a, b) => a.id.localeCompare(b.id)),
        item.choices.slice().sort((a, b) => a.id.localeCompare(b.id)), `${item.id}: shuffle must be a permutation`);
      return ordered.findIndex((c) => c.id === correctId(item));
    });
    assert.ok(positions.every((p) => p >= 0), `${file}: missing correct choice after shuffle`);
    assert.ok(new Set(positions).size > 1, `${file}: correct choice position never varies (${positions.join(',')})`);
    assert.ok(!positions.every((p) => p === 0), `${file}: correct choice is still always first`);
  }
});

test('runners use seeded shuffle for displayed choices', () => {
  for (const [file, runner] of [
    ['IsletDispatchRunner.js', '../IsletDispatchRunner.js'],
    ['RelayRaceRunner.js', '../../relay-race/RelayRaceRunner.js'],
  ]) {
    const src = readFileSync(join(gameRoot, runner.includes('Islet') ? 'islet-dispatch' : 'relay-race', file), 'utf8');
    assert.match(src, /import \{ shuffle \} from '\.\.\/engine\/shuffle\.js'/);
    assert.match(src, /shuffle\(item\.choices \|\| \[\], item\.id\)/);
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
