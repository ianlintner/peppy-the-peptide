// Engine modules must accept the shared fixture the Python validator tests use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggest } from '../adapt.js';

const game = JSON.parse(readFileSync(new URL('../../../../content/games/_example.json', import.meta.url), 'utf8'));

test('example fixture has items across tiers 1-3 with exactly one correct choice each', () => {
  assert.deepEqual([...new Set(game.items.map((i) => i.tier))].sort(), [1, 2, 3]);
  for (const item of game.items) {
    assert.equal(item.choices.filter((c) => c.correct).length, 1, item.id);
    for (const c of item.choices.filter((c) => !c.correct)) assert.ok(c.feedback, `${item.id}/${c.id}`);
  }
});

test('adaptive engine runs over fixture tiers', () => {
  const attempts = game.items.slice(0, 1).map((i) => ({ tier: i.tier, correct: true }));
  assert.equal(suggest(attempts).kind, 'none');
});
