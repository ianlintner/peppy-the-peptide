// GameShell: header, tier chooser (suggestions only), progress, confidence tag, hints, sources,
// show-answer and an aria-live feedback panel around a pluggable item runner (see ChoiceRunner.js).
//   <GameShell title summary items sources store runner? seed? now? />
//   sources: [{title,url}] in lesson order; item.source_ids are 1-based positions into it.
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState, useRef, useEffect, useMemo } from '../../vendor/preact/hooks.mjs';
import { ChoiceRunner } from './ChoiceRunner.js';
import { newSession, answer, chooseTier, offerTarget, dismissOffer } from '../engine/session.js';
import { pickNext } from '../engine/select.js';
import { createLadder, nextHint, hintLabel, shownHints } from '../engine/hints.js';
import { record, startTier } from '../engine/mastery.js';
const html = htm.bind(h);

export const TIER_NAMES = { 1: 'Curious', 2: 'College', 3: 'Mechanism' };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function offerText(offer, target) {
  if (offer.kind === 'step-up') return { msg: `Three in a row at ${TIER_NAMES[offer.tier]}. Want a challenge?`, go: `Try ${TIER_NAMES[target]}` };
  if (offer.kind === 'easier') return { msg: 'Two misses in a row. An easier tier might help, or stay put and keep going.', go: `Go to ${TIER_NAMES[target]}` };
  return null;
}

export function GameShell({ title, summary, items, sources = [], store, runner: Runner = ChoiceRunner, seed = 'peppy', now = () => Date.now() }) {
  const concepts = useMemo(() => [...new Set(items.map((i) => i.concept))], [items]);
  const [session, setSession] = useState(() => newSession(startTier(store.get(), concepts)));
  const [item, setItem] = useState(() => pickNext(items, { tier: session.tier, seen: [], seed }));
  const [tentative, setTentative] = useState(null); // runner selection before reveal
  const [confident, setConfident] = useState(null); // true = sure, false = unsure
  const [revealed, setRevealed] = useState(null); // {correct, choiceId, shownAnswer}
  const [ladder, setLadder] = useState(() => createLadder(item && item.hint_ladder));
  const [showSrc, setShowSrc] = useState(false);
  const [note, setNote] = useState(''); // polite announcement for hints / tier changes
  const feedbackRef = useRef(null);
  const itemRef = useRef(null);
  const total = items.length;
  const done = new Set(session.seen).size;
  const finished = done >= total && revealed === null && session.seen.length >= total;

  useEffect(() => { if (revealed && feedbackRef.current) feedbackRef.current.focus({ preventScroll: reduced() }); }, [revealed]);

  const load = (s, seen = s.seen) => {
    const next = pickNext(items, { tier: s.tier, seen, seed: seed + ':' + seen.length });
    setItem(next); setTentative(null); setConfident(null); setRevealed(null); setShowSrc(false);
    setLadder(createLadder(next && next.hint_ladder));
  };
  // Focus the prompt group of the new item once it renders (after "Next question" unmounts the button).
  useEffect(() => { if (item && !revealed && session.seen.length && itemRef.current) itemRef.current.focus({ preventScroll: reduced() }); }, [item && item.id]);

  const finish = (result, sure) => {
    const t = now();
    store.set(record(store.get(), item.concept, { tier: item.tier, correct: result.correct }, t));
    setSession(answer(session, item, { correct: result.correct, confident: result.shownAnswer ? undefined : sure }));
    setRevealed(result);
  };
  const check = () => tentative && confident !== null && finish({ ...tentative, shownAnswer: false }, confident);
  const showAnswer = () => finish({ ...(Runner.answer ? Runner.answer(item) : { correct: true }), correct: false, shownAnswer: true }, undefined);
  const hint = () => { const l = nextHint(ladder); setLadder(l); setNote(`Hint ${l.used}: ${l.hints[l.used - 1]}`); };
  const pickTier = (t) => { const s = chooseTier(session, t); setSession(s); setNote(`Now practicing ${TIER_NAMES[s.tier]} questions.`); load(s); };
  const offer = session.offer;
  const target = offerTarget(offer);
  const ot = offerText(offer, target);
  const wrongSure = revealed && !revealed.correct && !revealed.shownAnswer && confident === true;
  const worked = revealed && !revealed.correct && (offer.kind === 'worked-example' || wrongSure);

  const restart = () => { const s = newSession(session.tier); setSession(s); load(s, []); };
  const label = hintLabel(ladder);
  const srcIds = item ? item.source_ids : [];

  return html`<div class="pg-shell" data-tier=${session.tier}>
    <header class="pg-head">
      <h3 class="pg-title">${title}</h3>
      ${summary && html`<p class="pg-summary">${summary}</p>`}
      <p class="pg-progress" role="status">Question ${Math.min(done + (revealed ? 0 : 1), total)} of ${total} · ${done} answered · ${TIER_NAMES[session.tier]} tier</p>
      ${!store.isPersistent() && html`<p class="pg-small">Progress can't be saved in this browser, so it will reset when you leave the page.</p>`}
    </header>

    <div class="pg-tiers" role="group" aria-label="Choose a tier. You can change it any time.">
      ${[1, 2, 3].map((t) => html`<button type="button" class="pg-btn" aria-pressed=${session.tier === t} onClick=${() => pickTier(t)}>${TIER_NAMES[t]}</button>`)}
    </div>

    ${ot && !revealed && html`<div class="pg-offer" role="group" aria-label="Suggestion">
      <p>${ot.msg}</p>
      ${target !== null && html`<button type="button" class="pg-btn" onClick=${() => pickTier(target)}>${ot.go}</button>`}
      <button type="button" class="pg-btn" onClick=${() => setSession(dismissOffer(session))}>Stay here</button>
    </div>`}

    ${finished ? html`<div class="pg-done" tabindex="-1" ref=${(el) => el && el.focus({ preventScroll: reduced() })}>
      <p>You have seen every question in this set. Pick any tier above, or go again.</p>
      <button type="button" class="pg-btn" onClick=${restart}>Practice again</button>
    </div>` : item && html`<div class="pg-item">
      <div class="pg-run" tabindex="-1" ref=${itemRef}>
        <${Runner} item=${item} locked=${!!revealed} revealed=${revealed} onSelect=${(r) => setTentative(r)} />
      </div>

      ${!revealed && html`<fieldset class="pg-confidence">
        <legend>How sure are you? (choose before checking)</legend>
        <label><input type="radio" name="pg-conf" checked=${confident === true} onChange=${() => setConfident(true)} /> Sure</label>
        <label><input type="radio" name="pg-conf" checked=${confident === false} onChange=${() => setConfident(false)} /> Unsure</label>
      </fieldset>`}

      <div class="pg-actions">
        ${!revealed && html`<button type="button" class="pg-btn pg-primary" aria-disabled=${!(tentative && confident !== null)} onClick=${check}>Check answer</button>`}
        ${!revealed && label && html`<button type="button" class="pg-btn" onClick=${hint}>${label}</button>`}
        ${!revealed && html`<button type="button" class="pg-btn" onClick=${showAnswer}>Show answer</button>`}
        <button type="button" class="pg-btn" aria-expanded=${showSrc} aria-controls="pg-src" onClick=${() => setShowSrc(!showSrc)}>${showSrc ? 'Hide source' : 'Show source'}</button>
      </div>
      ${!revealed && tentative === null && html`<p class="pg-small">Pick an answer, say how sure you are, then check. Or use Show answer any time.</p>`}
      ${!revealed && tentative && confident === null && html`<p class="pg-small">Choose Sure or Unsure to enable Check answer.</p>`}

      ${shownHints(ladder).length > 0 && !revealed && html`<ol class="pg-hints" aria-label="Hints so far">${shownHints(ladder).map((x) => html`<li>${x}</li>`)}</ol>`}

      <div id="pg-src" class="pg-src" hidden=${!showSrc}>
        <p>Source${srcIds.length > 1 ? 's' : ''} for this question:</p>
        <ul>${srcIds.map((n) => { const s = sources[n - 1]; return html`<li>${s ? html`<a href=${s.url} target="_blank" rel="noopener">${s.title}</a>` : `Source ${n} (see the source shelf below)`}</li>`; })}</ul>
        <p class="pg-small">Misconception practiced: ${item.misconception}</p>
      </div>
    </div>`}

    <div class="pg-feedback" role="status" aria-live="polite" aria-atomic="true" tabindex="-1" ref=${feedbackRef}>
      ${revealed && html`<div>
        <p class="pg-verdict"><strong>${revealed.shownAnswer ? 'Answer shown (counted as a miss, no problem).' : revealed.correct ? 'Correct.' : 'Not quite.'}</strong></p>
        ${!revealed.correct && !revealed.shownAnswer && tentative && tentative.feedback && html`<p>${tentative.feedback}</p>`}
        ${wrongSure && html`<p>You were sure, so here is a worked example before moving on.</p>`}
        ${worked && html`<p class="pg-worked">${item.worked_example || item.explanation}</p>`}
        ${!worked && html`<p>${item.explanation}</p>`}
        ${worked && item.worked_example && html`<p>${item.explanation}</p>`}
        ${revealed.shownAnswer && html`<p>Correct answer: ${(item.choices.find((c) => c.correct) || {}).text}</p>`}
      </div>`}
      ${!revealed && note && html`<p>${note}</p>`}
    </div>

    ${revealed && !finished && html`<div class="pg-actions"><button type="button" class="pg-btn pg-primary" onClick=${() => (done >= total ? setRevealed(null) : load(session))}>${done >= total ? 'Finish' : 'Next question'}</button></div>`}
    <p class="pg-small">Nothing here is timed or locked. Educational practice, not medical advice.</p>
  </div>`;
}
