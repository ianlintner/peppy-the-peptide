import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { gradeAllowed, revealAllowed } from '../review-ui.js';
import { record, emptyState } from '../../engine/mastery.js';

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

test('review flow is confidence, then reveal, then grade; confidence is stored', () => {
  const ui = readFileSync(new URL('review-ui.js', dir), 'utf8');
  const revealAt = ui.indexOf('Show answer');
  const gradeAt = ui.indexOf('I was right');
  assert.ok(revealAt < gradeAt, 'the reveal control appears before the grade controls');
  assert.match(ui, /!revealed && html`<div class="rv-actions">[\s\S]*?setRevealed\(true\)/, 'reveal is available before grading');
  assert.match(ui, /revealed && html`<div class="rv-actions rv-grade">/, 'grade controls appear only after reveal');
  assert.match(ui, /confidence: confident \? 'sure' : 'unsure'/, 'the chosen confidence is passed into the mastery record');
});

test('graded state blocks a second record on the same card', () => {
  const card = { concept: 'c1', tier: 2 };
  const ready = { card, revealed: true, confident: true, graded: false };
  assert.equal(gradeAllowed(ready), true);
  const afterGrade = { ...ready, graded: true };
  assert.equal(gradeAllowed(afterGrade), false, 'reveal + confidence alone must not allow repeated grading');
  // Concrete Leitner effect: one grade vs the three-click bug that inflated box/seen/correct.
  const t0 = Date.UTC(2026, 10, 22);
  let state = emptyState();
  state = record(state, card.concept, { tier: card.tier, correct: true, confidence: 'sure' }, t0);
  const once = state.concepts[card.concept];
  let repeated = record(state, card.concept, { tier: card.tier, correct: false, confidence: 'sure' }, t0);
  repeated = record(repeated, card.concept, { tier: card.tier, correct: true, confidence: 'sure' }, t0);
  assert.notDeepEqual(repeated.concepts[card.concept], once, 'repeat clicks would corrupt the Leitner state');
  // The UI wiring must use the guard in grade() and disable both grade buttons after grading.
  const ui = readFileSync(new URL('review-ui.js', dir), 'utf8');
  assert.match(ui, /gradeAllowed\(\{ card, revealed, confident, graded \}\)/);
  assert.match(ui, /disabled=\$\{confident === null \|\| graded\}/);
  assert.match(ui, /\[graded, setGraded\] = useState\(false\)/);
});

test('reveal is guarded when no confidence was chosen, so the card stays gradable', () => {
  const card = { concept: 'c1', tier: 2 };
  assert.equal(revealAllowed({ card, revealed: false, confident: null, graded: false }), false);
  assert.equal(revealAllowed({ card, revealed: false, confident: false, graded: false }), true);
  assert.equal(revealAllowed({ card, revealed: true, confident: true, graded: false }), false);
  assert.equal(revealAllowed({ card, revealed: false, confident: true, graded: true }), false);
  const ui = readFileSync(new URL('review-ui.js', dir), 'utf8');
  assert.match(ui, /if \(!revealAllowed\(\{ card, revealed, confident, graded \}\)\) return; setRevealed\(true\)/, 'Show answer must check the guard');
  assert.match(ui, /aria-disabled=\$\{confident === null\}/, 'the aria-disabled hint stays on Show answer');
});

test('graded resets for every new card and fresh session', () => {
  const ui = readFileSync(new URL('review-ui.js', dir), 'utf8');
  const next = ui.slice(ui.indexOf('const next ='), ui.indexOf('const again ='));
  assert.match(next, /setGraded\(false\)/, 'next() resets graded for the following card');
  const start = ui.slice(ui.indexOf('const start ='), ui.indexOf('const grade ='));
  assert.match(start, /setGraded\(false\)/, 'start() resets graded for a new session');
});

test('shared hub/course styles are available outside review.html', () => {
  const styles = readFileSync(new URL('../../styles.css', dir), 'utf8');
  assert.match(styles, /\.sr-only\s*\{/, '.sr-only must live in the global stylesheet');
  assert.match(styles, /\.game-mastery\s*,/, 'mastery line styling must live in the global stylesheet');
  assert.match(styles, /\.course-game-progress/, 'course-map progress styling must live in the global stylesheet');
});
