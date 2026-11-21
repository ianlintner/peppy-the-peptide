/**
 * BeadRunner — item runner for the Bead Chain Builder, plugged into GameShell's `runner` prop.
 * Select-then-place (keyboard first): pick a bead from the pool with Enter/Space, then pick a slot.
 * Pointer drag-and-drop is an optional enhancement on top. Arrow keys move between the buttons of a
 * row. Scoring lives in ./evaluator.js; GameShell owns hints, confidence, sources and the live region.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useEffect, useMemo, useRef, useState } from '../../vendor/preact/hooks.mjs';
import { shuffle } from '../engine/shuffle.js';
import { Chain, Bead, NOTES, ViewToggle, spell } from './Chain.js';
import { beadColors, evaluateBuild, evaluateChoice, poolFrom, expectedChoice } from './evaluator.js';

const html = htm.bind(h);
let seq = 0;

export function answer(item) {
  return { correct: false, choiceId: expectedChoice(item), shownAnswer: true, feedback: '' };
}

const MODE_TITLES = { build: 'Build the chain', spot: 'Spot the new order', compare: 'Composition or sequence?', sorter: 'Bonus: Cartoon vs Chemistry', inference: 'What follows from the sequence?' };

function BuildBoard({ item, locked, revealed, view, colors, onSelect, say }) {
  const target = item.data.target;
  const pool = useMemo(() => poolFrom(target, shuffle([...target], item.id)), [item.id]);
  const [placed, setPlaced] = useState(() => Array(target.length).fill(null)); // slot -> pool index
  const [held, setHeld] = useState(null); // pool index picked up
  const [focusReq, setFocusReq] = useState(null);
  const root = useRef(null);
  const shown = revealed && revealed.shownAnswer;
  const slotLetters = placed.map((p, i) => (shown ? target[i] : p === null ? null : pool[p]));
  const verdict = revealed ? evaluateBuild(item, slotLetters) : null;
  const used = new Set(placed.filter((p) => p !== null));

  useEffect(() => {
    if (!focusReq || !root.current) return;
    const el = root.current.querySelector(`[data-grp="${focusReq.grp}"][data-idx="${focusReq.idx}"]`);
    if (el) el.focus();
  }, [focusReq]);

  const commit = (next) => {
    setPlaced(next);
    const letters = next.map((p) => (p === null ? null : pool[p]));
    const r = evaluateBuild(item, letters);
    onSelect(r.outcome === 'incomplete' ? null : { correct: r.correct, choiceId: r.choiceId, feedback: r.feedback, outcome: r.outcome });
  };
  const firstFree = (arr) => { const i = arr.findIndex((p) => p === null); return i < 0 ? 0 : i; };
  const pick = (i) => {
    if (locked || used.has(i)) return;
    setHeld(held === i ? null : i);
    say(held === i ? `Put bead ${pool[i]} back.` : `Picked up bead ${pool[i]}. Now choose a slot.`);
    if (held !== i) setFocusReq({ grp: 'slot', idx: firstFree(placed), n: ++seq });
  };
  const place = (slot) => {
    if (locked) return;
    if (held === null) {
      if (placed[slot] === null) { say('Pick a bead from the pool first.'); return; }
      const next = placed.slice(); const back = next[slot]; next[slot] = null; commit(next);
      say(`Returned bead ${pool[back]} from slot ${slot + 1} to the pool.`);
      setFocusReq({ grp: 'pool', idx: back, n: ++seq });
      return;
    }
    const next = placed.slice(); next[slot] = held; commit(next);
    const left = pool.findIndex((_, i) => !next.includes(i));
    say(`Placed bead ${pool[held]} in slot ${slot + 1} of ${target.length}.` + (left < 0 ? ' All slots are filled. Say how sure you are, then check your answer.' : ''));
    setHeld(null);
    setFocusReq(left < 0 ? { grp: 'slot', idx: slot, n: ++seq } : { grp: 'pool', idx: left, n: ++seq });
  };
  const clear = () => { setHeld(null); commit(Array(target.length).fill(null)); say('Chain cleared. All beads are back in the pool.'); setFocusReq({ grp: 'pool', idx: 0, n: ++seq }); };
  const arrows = (e) => { // Left/Right (and Up/Down) move between buttons of the same row
    const k = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!k) return;
    const row = [...e.currentTarget.parentElement.querySelectorAll('button:not([disabled])')];
    const at = row.indexOf(e.currentTarget);
    if (at >= 0) { e.preventDefault(); row[(at + k + row.length) % row.length].focus(); }
  };
  const mark = (i) => (!verdict ? '' : shown ? 'target bead' : verdict.wrongSlots.includes(i) ? 'not this bead' : 'correct place');

  return html`<div class="bcb-build" ref=${root}>
    <p class="bcb-label">Target order, N end first</p>
    <${Chain} letters=${[...target]} colors=${colors} view=${view} label="Target chain" size=${64} />
    <p class="bcb-label">Your chain</p>
    <${Chain} letters=${slotLetters} colors=${colors} view=${view} label="Your chain" size=${120}
      peppyState=${verdict ? (verdict.correct ? 'cheer' : 'oops') : held !== null ? 'point' : 'idle'} />
    <p class="bcb-label" id=${`bcb-slots-${item.id}`}>Slots (N end to C end)</p>
    <div class="bcb-row" role="group" aria-labelledby=${`bcb-slots-${item.id}`}>
      ${placed.map((p, i) => html`<button type="button" class="bcb-slot" data-grp="slot" data-idx=${i} data-mark=${mark(i)}
        disabled=${locked} onKeyDown=${arrows} onClick=${() => place(i)} onDragOver=${(e) => e.preventDefault()} onDrop=${(e) => { e.preventDefault(); place(i); }}
        aria-label=${`Slot ${i + 1} of ${target.length}: ${slotLetters[i] ? `holds ${slotLetters[i]}${mark(i) ? `, ${mark(i)}` : ''}. Press to return it to the pool` : 'empty. Press to place the picked-up bead here'}`}>
        <span class="bcb-slot-num">${i + 1}</span><${Bead} letter=${slotLetters[i]} colors=${colors} view=${view} />
        ${mark(i) && html`<span class="bcb-mark">${mark(i)}</span>`}
      </button>`)}
    </div>
    <p class="bcb-label" id=${`bcb-pool-${item.id}`}>Bead pool</p>
    <div class="bcb-row" role="group" aria-labelledby=${`bcb-pool-${item.id}`}>
      ${pool.map((l, i) => html`<button type="button" class="bcb-pool" data-grp="pool" data-idx=${i} aria-pressed=${held === i}
        draggable=${!locked && !used.has(i)} onDragStart=${() => pick(i)} onKeyDown=${arrows}
        disabled=${locked || used.has(i)} onClick=${() => pick(i)}
        aria-label=${used.has(i) ? `Bead ${l}, already placed` : held === i ? `Bead ${l}, picked up. Press to put it back` : `Bead ${l}. Press to pick it up`}>
        <${Bead} letter=${l} colors=${colors} view=${view} />${held === i && html`<span class="bcb-mark">picked up</span>`}
      </button>`)}
      <button type="button" class="pg-btn bcb-clear" disabled=${locked} onClick=${clear}>Clear chain</button>
    </div>
  </div>`;
}

function ChoiceBoard({ item, locked, revealed, view, colors, onSelect }) {
  const d = item.data;
  const group = useMemo(() => `bcb-${++seq}`, []);
  const [picked, setPicked] = useState(null);
  const pick = (c) => {
    if (locked) return;
    setPicked(c.id);
    const r = evaluateChoice(item, c.id);
    onSelect({ correct: r.correct, choiceId: c.id, feedback: r.feedback, outcome: r.outcome });
  };
  const chainOf = { spot: (id) => d.chains[id] };
  const shownId = revealed && picked === null ? expectedChoice(item) : picked;
  const reading = d.mode === 'sorter' || d.mode === 'inference';
  return html`<div class="bcb-choices">
    ${reading && html`<blockquote class="bcb-statement"><p>${d.statement}</p></blockquote>`}
    ${d.mode === 'compare' && html`<div class="bcb-pair">
      <div><p class="bcb-label">Chain 1 (target)</p><${Chain} letters=${[...d.target]} colors=${colors} view=${view} label="Chain 1" size=${64} /></div>
      <div><p class="bcb-label">Chain 2</p><${Chain} letters=${[...d.other]} colors=${colors} view=${view} label="Chain 2" size=${64} /></div>
    </div>`}
    ${d.mode === 'spot' && html`<div><p class="bcb-label">Target</p><${Chain} letters=${[...d.target]} colors=${colors} view=${view} label="Target chain" size=${64} /></div>`}
    ${d.mode === 'inference' && d.target && html`<div><p class="bcb-label">Sequence in question</p><${Chain} letters=${[...d.target]} colors=${colors} view=${view} label="Sequence" size=${64} showPeppy=${false} /></div>`}
    ${d.mode === 'sorter' && d.readout && (view === 'chemistry'
      ? html`<p class="bcb-readout"><strong>Chemistry readout</strong> (${d.readout.source_label}), N end to C end:
          <code class="bcb-code">N→ ${d.readout.sequence} →C</code></p>`
      : html`<p class="bcb-readout">Switch to Chemistry view to see the full ${d.readout.sequence.length}-residue readout from ${d.readout.source_label}.</p>`)}
    <fieldset class="pg-choices" disabled=${locked}>
      <legend class="pg-prompt">${item.prompt}</legend>
      ${item.choices.map((c) => {
        const verdict = revealed && shownId === c.id ? (c.correct ? ' (correct)' : ' (not quite)') : revealed && c.correct ? ' (the correct answer)' : '';
        return html`<label class=${'pg-choice' + (shownId === c.id ? ' is-picked' : '') + (revealed && c.correct ? ' is-correct' : '')}>
          <input type="radio" name=${group} value=${c.id} checked=${picked === c.id} onChange=${() => pick(c)} />
          <span>${c.text}${verdict}${chainOf[d.mode] && html`<span class="bcb-opt"><${Chain} letters=${[...chainOf[d.mode](c.id)]} colors=${colors} view=${view} label=${c.text} size=${64} /></span>`}</span>
        </label>`;
      })}
    </fieldset>
  </div>`;
}

export function BeadRunner({ item, locked, revealed, onSelect }) {
  const d = item.data;
  const [view, setView] = useState(d.view === 'chemistry' ? 'chemistry' : 'cartoon');
  const [spoken, setSpoken] = useState('');
  const colors = useMemo(() => beadColors(d.target || '', d.other || '', ...Object.values(d.chains || {})), [item.id]);
  const onView = (v) => { setView(v); setSpoken(v === 'chemistry' ? 'Chemistry view: the same chain as one-letter codes, N end to C end.' : 'Cartoon view: the same chain as coloured beads on Peppy.'); };
  return html`<div class="bcb-item" data-tier=${item.tier} data-mode=${d.mode}>
    <p class="bcb-eyebrow">${MODE_TITLES[d.mode]} · Tier ${item.tier}${d.bonus ? ' · Bonus round' : ''}</p>
    ${d.mode === 'build' && html`<p class="bcb-prompt">${item.prompt}</p>`}
    <${ViewToggle} view=${view} onView=${onView} />
    <p class="bcb-note">${NOTES[view]}</p>
    ${d.target && d.accession && html`<p class="bcb-src">Real fragment: UniProt ${d.accession} residues ${d.residues}, written ${spell(d.target)}. Source: ${d.source_label}.</p>`}
    ${d.mode === 'build'
      ? html`<${BuildBoard} item=${item} locked=${locked} revealed=${revealed} view=${view} colors=${colors} onSelect=${onSelect} say=${setSpoken} />`
      : html`<${ChoiceBoard} item=${item} locked=${locked} revealed=${revealed} view=${view} colors=${colors} onSelect=${onSelect} />`}
    <p class="bcb-say" role="status" aria-live="polite">${spoken}</p>
  </div>`;
}

BeadRunner.answer = answer;
