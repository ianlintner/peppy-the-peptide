/**
 * Claim Detective runner: a fictional post rendered as individually focusable
 * words. Keyboard users move with Arrow keys, mark a start with Space/Enter,
 * move to the last word and press Space/Enter again; Shift+Arrow also extends
 * the selection. Mouse users can click a word then click another. No timers.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState, useRef, useEffect } from '../../vendor/preact/hooks.mjs';
import { words, spanForWords, spansEqual, evaluatePost, answer, CLASSIFICATIONS, TECHNIQUES } from './evaluator.js';

const html = htm.bind(h);
const TECHNIQUE_LIST = Object.entries(TECHNIQUES);

function highlighted(index, span) {
  return !!span && index >= span.start && index < span.end;
}

export function ClaimDetectiveRunner({ item, locked, revealed, onSelect }) {
  const d = item.data || {};
  const tokens = words(d.post);
  const [anchor, setAnchor] = useState(null);
  const [focus, setFocus] = useState(0);
  const [selecting, setSelecting] = useState(false); // true after the first Space
  const [choiceId, setChoiceId] = useState(null);
  const [techniqueId, setTechniqueId] = useState(null);
  const wordRefs = useRef([]);
  const moveTick = useRef(0);
  // The evaluator treats its second argument as the exclusive end, so the
  // focused word's index is passed as index + 1 for highlight ranges.
  const range = (a, b) => spanForWords(a, b + 1, tokens.length);
  const span = anchor !== null ? range(anchor, focus) : null;

  const shownSpan = locked && revealed ? revealed.span : span;
  const shownChoice = locked && revealed ? revealed.choiceId : choiceId;
  const shownTechnique = locked && revealed ? revealed.technique : techniqueId;

  useEffect(() => {
    if (locked || moveTick.current === 0 || !wordRefs.current[focus]) return;
    wordRefs.current[focus].focus({ preventScroll: true });
  }, [focus]);

  const report = (s, c, t) => {
    if (s && c && t) onSelect({ ...evaluatePost(item, s, c, t), choiceId: c, span: s, technique: t });
    else onSelect(null);
  };
  const pickWord = (i) => {
    if (locked) return;
    if (!selecting) {
      setAnchor(i); setFocus(i); setSelecting(true);
      report(null, choiceId, techniqueId);
    } else {
      const s = range(anchor, i);
      setFocus(i); setSelecting(false);
      report(s, choiceId, techniqueId);
    }
  };

  const onWordKey = (event, i) => {
    if (locked) return;
    const k = event.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') {
      event.preventDefault();
      let next = i;
      if (k === 'ArrowRight') next = Math.min(tokens.length - 1, i + 1);
      if (k === 'ArrowLeft') next = Math.max(0, i - 1);
      if (k === 'Home') next = 0;
      if (k === 'End') next = tokens.length - 1;
      setFocus(next); moveTick.current += 1;
      if (selecting && anchor !== null) report(range(anchor, next), choiceId, techniqueId);
    } else if (k === ' ' || k === 'Enter') {
      event.preventDefault();
      pickWord(i);
    }
  };

  const choose = (c) => { setChoiceId(c); report(span, c, techniqueId); };
  const chooseTechnique = (t) => { setTechniqueId(t); report(span, choiceId, t); };
  const groupName = `cd-${item.id}`;

  return html`<div class="cd-card" data-item=${item.id}>
    ${d.boss === true && html`<p class="cd-boss">Optional Boss · skip freely; it does not block progress.</p>`}
    ${d.mode === 'split' && html`<p class="cd-split-note">This post is partly right. Highlight only the part that goes beyond the cited source.</p>`}
    <div class="cd-post-wrap">
      <p class="cd-label" id=${groupName + '-label'}>Fictional post — pick the exact words that make the claim</p>
      <blockquote class="cd-post" aria-labelledby=${groupName + '-label'}>
        ${tokens.map((w, i) => html`<button type=${'button'} key=${i}
          class=${'cd-word' + (highlighted(i, shownSpan) ? ' cd-word-marked' : '')}
          aria-pressed=${highlighted(i, shownSpan)}
          aria-label=${`Word ${i + 1} of ${tokens.length}: ${w}`}
          ref=${(el) => { wordRefs.current[i] = el; }}
          disabled=${locked}
          onClick=${() => pickWord(i)}
          onKeyDown=${(e) => onWordKey(e, i)}
        >${w}</button>`)}
      </blockquote>
      <p class="cd-hint" aria-live="polite">${selecting && span
        ? `Highlighting words ${span.start + 1} to ${span.end}. Press Space on the last word to finish.`
        : 'Arrow keys move between words. Press Space on the first and last word to highlight a range.'}</p>
    </div>

    <div class="cd-choices" role="group" aria-label="Status of the highlighted claim" disabled=${locked}>
      <p class="cd-label">What is the status of the highlighted claim?</p>
      ${Object.entries(CLASSIFICATIONS).map(([id, text]) => html`<button type="button" key=${id}
        class=${'cd-choice' + (shownChoice === id ? ' cd-choice-active' : '')}
        data-choice=${id}
        aria-pressed=${shownChoice === id} disabled=${locked}
        onClick=${() => choose(id)}>${text}</button>`)}
    </div>

    <div class="cd-techniques" role="group" aria-label="Technique used by the post" disabled=${locked}>
      <p class="cd-label">Name the technique the post uses</p>
      ${TECHNIQUE_LIST.map(([id, text]) => html`<button type="button" key=${id}
        class=${'cd-choice' + (shownTechnique === id ? ' cd-choice-active' : '')}
        data-technique=${id}
        aria-pressed=${shownTechnique === id} disabled=${locked}
        onClick=${() => chooseTechnique(id)}>${text}</button>`)}
    </div>

    ${revealed && revealed.span && html`<p class="cd-answer-span" aria-live="polite">
      Highlighted claim: “${tokens.slice(revealed.span.start, revealed.span.end).join(' ')}”.
    </p>`}
  </div>`;
}

ClaimDetectiveRunner.answer = answer;
ClaimDetectiveRunner.spansEqual = spansEqual;
