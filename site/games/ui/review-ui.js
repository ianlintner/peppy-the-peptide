// Daily Review card runner. Pure state transitions live in engine/review.js + engine/mastery.js.
// This component only owns DOM state; it never calls storage directly (store adapter does).
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState, useRef, useEffect } from '../../vendor/preact/hooks.mjs';
import { selectQueue, SESSION_MAX } from '../engine/review.js';
import { record } from '../engine/mastery.js';
const html = htm.bind(h);

const SOURCE_NAMES = { 1: 'Curious', 2: 'College', 3: 'Mechanism' };

/** Pure guard: one question may be recorded once per card. Used by grade() and its tests. */
export const gradeAllowed = ({ card, revealed, confident, graded }) =>
  !!card && revealed === true && confident !== null && graded !== true;

/** Pure guard: revealing without a confidence traps the learner on an ungradable card. */
export const revealAllowed = ({ card, revealed, confident, graded }) =>
  !!card && revealed !== true && confident !== null && graded !== true;

/** Empty state: nothing due yet. */
function Empty({ hasHistory }) {
  return html`<div class="rv-empty">
    <h2>Nothing due right now.</h2>
    <p>${hasHistory
      ? 'You are all caught up. Come back after your next practice session, or play a game to add more questions to the mix.'
      : 'Play a game first: this review draws from the concepts you have practised and each lesson’s own check question.'}</p>
    <p><a class="button" href="index.html">Browse the games →</a></p>
  </div>`;
}

/** One retrieval card: prompt, confidence before reveal, answer, source links and next action. */
export function ReviewUI({ cards, store, now = () => Date.now(), seed = 'daily' }) {
  const [state, setState] = useState(() => store.get());
  const [queue, setQueue] = useState(() => selectQueue(cards, store.get(), { now: now(), seed }));
  const [index, setIndex] = useState(0);
  const [confident, setConfident] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false); // one Leitner record per card
  const [note, setNote] = useState('');
  const [refresh, setRefresh] = useState(0); // new session after "again" or new import
  const group = useRef('rv-confidence');
  const feedback = useRef(null);
  const card = queue[index];
  const done = index >= queue.length;

  useEffect(() => { if (revealed && feedback.current) feedback.current.focus({ preventScroll: true }); }, [revealed]);

  const start = (s = store.get()) => {
    setQueue(selectQueue(cards, s, { now: now(), seed, seen: [] }));
    setIndex(0); setConfident(null); setRevealed(false); setGraded(false); setNote('');
  };

  const grade = (correct) => {
    if (!gradeAllowed({ card, revealed, confident, graded })) return;
    const t = now();
    const next = record(store.get(), card.concept, {
      tier: card.tier,
      correct,
      confidence: confident ? 'sure' : 'unsure',
    }, t);
    store.set(next); setState(next); setGraded(true);
    setNote(`${confident ? 'Sure' : 'Unsure'} · ${correct ? 'Marked correct. Scheduled for a later review.' : 'Marked as a miss. This one will come back soon.'}`);
  };

  const next = () => {
    if (index + 1 < queue.length) {
      setIndex(index + 1); setConfident(null); setRevealed(false); setGraded(false); setNote('');
    } else {
      setIndex(queue.length); setRevealed(false); setGraded(false); setNote('Session complete.');
    }
  };

  const again = () => { start(); setRefresh((n) => n + 1); };
  const importState = (next) => { start(next); setRefresh((n) => n + 1); };

  // Expose a tiny imperative hook for the page's import/reset buttons via a custom event.
  useEffect(() => {
    const handler = (e) => {
      if (e.detail === 'reset') { importState(store.get()); }
      else if (e.detail && e.detail.state) { importState(e.detail.state); }
    };
    document.addEventListener('peppy-review-state', handler);
    return () => document.removeEventListener('peppy-review-state', handler);
  }, [cards]);

  if (!queue.length) return html`<${Empty} hasHistory=${Object.keys(state.concepts || {}).length > 0} />`;

  return html`<div class="rv-session" data-review-session>
    ${!store.isPersistent() && html`<p class="rv-notice">This browser is not saving progress. Today’s answers last only until you leave the page.</p>`}
    <p class="rv-counter" role="status">Question ${Math.min(index + 1, queue.length)} of ${queue.length} · ${done ? 'complete' : 'no timer'}</p>
    ${done ? html`<div class="rv-done">
      <h2>Session complete.</h2>
      <p>${queue.length} question${queue.length === 1 ? '' : 's'} revisited. Nothing here is scored or timed.</p>
      <button type="button" class="rv-btn" onClick=${again}>Draw another set</button>
    </div>` : html`<article class="rv-card" key=${index}>
      <header class="rv-card-head">
        <p class="rv-lesson">Lesson ${card.lessonNumber} · ${card.lessonTitle}${card.kind === 'check' ? ' · lesson check' : ''}</p>
        <p class="rv-tier">${SOURCE_NAMES[card.tier] || 'Curious'} level</p>
      </header>
      <h2 class="rv-prompt" tabindex="-1">${card.prompt}</h2>
      ${card.misconception && html`<p class="rv-small">Misconception practiced: ${card.misconception}</p>`}
      ${!revealed && html`<fieldset class="rv-confidence">
        <legend>How sure are you before revealing?</legend>
        <label><input type="radio" name=${group.current} checked=${confident === true} onChange=${() => setConfident(true)} /> Sure</label>
        <label><input type="radio" name=${group.current} checked=${confident === false} onChange=${() => setConfident(false)} /> Unsure</label>
      </fieldset>`}
      ${!revealed && html`<div class="rv-actions">
        <button type="button" class="rv-btn rv-primary" aria-disabled=${confident === null} onClick=${() => { if (!revealAllowed({ card, revealed, confident, graded })) return; setRevealed(true); setNote('Answer shown. Now mark how you did; the schedule changes only when you grade.'); }}>Show answer</button>
      </div>`}
      ${!revealed && confident === null && html`<p class="rv-small">Choose Sure or Unsure, then reveal the answer.</p>`}
      ${revealed && html`<div class="rv-actions rv-grade">
        <button type="button" class="rv-btn rv-primary" disabled=${confident === null || graded} onClick=${() => grade(true)}>I was right</button>
        <button type="button" class="rv-btn rv-primary" disabled=${confident === null || graded} onClick=${() => grade(false)}>I missed it</button>
        <button type="button" class="rv-btn" onClick=${next}>${index + 1 < queue.length ? 'Next question' : 'Finish session'}</button>
      </div>`}
      <div class="rv-feedback" role="status" aria-live="polite" aria-atomic="true" tabindex="-1" ref=${feedback}>
        ${revealed && html`<div>
          <h3>Answer</h3><p>${card.answer}</p>
          ${note && html`<p class="rv-small">${note}</p>`}
        </div>`}
      </div>
      ${card.sourceIds && card.sourceIds.length > 0 && html`<details class="rv-sources">
        <summary>Sources for this question</summary>
        <ul>${card.sourceIds.map((n) => { const s = (card.sources || [])[n - 1]; return html`<li>${s ? html`<a href=${s.url} target="_blank" rel="noopener">${s.title}</a>` : `Source ${n} in the lesson shelf`}</li>`; })}</ul>
      </details>`}
    </article>`}
  </div>`;
}
