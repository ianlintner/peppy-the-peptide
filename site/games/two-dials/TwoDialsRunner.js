/**
 * TwoDialsRunner — the game-specific item runner for the Two Dials lab.
 *
 * GameShell owns tier selection, hints, confidence, source shelf, progress and
 * the aria-live feedback panel. This runner owns only: two qualitative dials,
 * the prediction pick, and the reveal gauges. All scoring is delegated to the
 * pure evaluator in ./evaluator.js.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useMemo, useState } from '../../vendor/preact/hooks.mjs';
import { Peppy } from '../ui/peppy.js';
import { DIALS, OUTCOME, evaluatePrediction, revealFor } from './evaluator.js';

const html = htm.bind(h);
let seq = 0;

/** Result for GameShell's "Show answer" path: reveal without a learner claim. */
export function answer(item) {
  const expected = item?.data?.answer ?? null;
  const result = evaluatePrediction(item, expected);
  return {
    correct: false,
    choiceId: expected,
    outcome: OUTCOME.CORRECT,
    choiceText: (item?.choices || []).find((c) => c.id === expected)?.text || '',
    feedback: 'Answer shown: one readout moved, the other held steady.',
    shownAnswer: true,
    dial: item?.data?.dial ?? null,
    readout: result.readout,
    steady: result.steady,
  };
}

/** A dial is a radiogroup of word settings; arrow keys work because they are radios. */
function Dial({ dial, value, onChange, disabled }) {
  const spec = DIALS[dial];
  const gid = useMemo(() => `dial-${dial}-${++seq}`, []);
  return html`<fieldset class="td-dial" disabled=${!!disabled}>
    <legend>${spec.label}</legend>
    <div class="td-dial-settings" role="radiogroup" aria-label=${`${spec.label} setting`}>
      ${spec.settings.map((v) => html`<label class="td-setting" data-on=${value === v}>
        <input type="radio" name=${gid} value=${v} checked=${value === v} onChange=${() => onChange(v)} />
        <span>${v}</span>
      </label>`)}
    </div>
  </fieldset>`;
}

/** A gauge shows a readout with a text marker; its state never relies on colour alone. */
function Gauge({ label, state, note }) {
  return html`<div class="td-gauge" data-state=${state}>
    <p class="td-gauge-label">${label}</p>
    <p class="td-gauge-state"><span aria-hidden="true">${state === 'moved' ? '↗' : '='}</span> ${state === 'moved' ? 'Changed' : 'Held steady'}</p>
    <p class="td-gauge-note">${note}</p>
  </div>`;
}

export function TwoDialsRunner({ item, locked, revealed, onSelect }) {
  const data = item?.data || {};
  const [clearance, setClearance] = useState(data.dials?.clearance?.[0] || 'quick');
  const [glucose, setGlucose] = useState(data.dials?.glucose?.[0] || 'mid');
  const [prediction, setPrediction] = useState(null);
  const revealedState = revealed || null;
  const peek = revealedState ? revealFor(data.dial, data.setting) : null;

  const peppyState = revealedState
    ? (revealedState.correct ? 'cheer' : 'oops')
    : (prediction ? 'thinking' : 'idle');
  const peppyLabel = revealedState
    ? (revealedState.correct ? 'Peppy cheers: your prediction matched the reveal.'
      : 'Peppy looks thoughtful: compare your prediction with the two gauges.')
    : (prediction ? 'Peppy is waiting for your confidence choice.'
      : 'Peppy waits beside the two dials.');

  const pick = (id) => {
    if (locked) return;
    setPrediction(id);
    const r = evaluatePrediction(item, id);
    onSelect({
      correct: r.correct,
      outcome: r.outcome,
      choiceId: r.choiceId ?? id,
      expected: r.expected,
      feedback: r.feedback || (r.correct ? '' : 'Compare this with the reveal.'),
      dial: r.dial,
      readout: r.readout,
      steady: r.steady,
      missingEvidence: r.missingEvidence,
    });
  };

  const resetDials = () => {
    if (locked) return;
    setClearance(data.dials?.clearance?.[0] || 'quick');
    setGlucose(data.dials?.glucose?.[0] || 'mid');
  };

  return html`<div class="td-item" data-tier=${item.tier}>
    ${item.needs_review === true && html`<p class="td-review" data-review="pending">
      <strong>Pending clinical review.</strong> ${item.review_note || 'This critique item is flagged for clinical review.'}
    </p>`}

    <div class="td-stage">
      <div class="td-lab">
        <p class="td-eyebrow">Lab bench · ${`Tier ${item.tier}`}</p>
        <blockquote class="td-prompt" aria-label="Question"><p>${item.prompt}</p></blockquote>
        <div class="td-dials">
          <${Dial} dial="clearance" value=${clearance} onChange=${setClearance} disabled=${!!locked} />
          <${Dial} dial="glucose" value=${glucose} onChange=${setGlucose} disabled=${!!locked} />
        </div>
        <p class="td-hintline">Turn either dial with Tab, then arrow keys. Nothing here is timed.</p>
        <button type="button" class="td-btn" disabled=${!!locked} onClick=${resetDials}>Reset dials</button>
      </div>
      <div class="td-mascot">
        <${Peppy} state=${peppyState} label=${peppyLabel} size=${72} />
        <p class="td-say" aria-hidden="true">${peppyState === 'cheer' ? 'Yes — that matches!'
          : peppyState === 'oops' ? 'Let’s read the gauges.'
          : peppyState === 'thinking' ? 'Now say how sure you are.'
          : 'Set the dials, then predict.'}</p>
      </div>
    </div>

    <fieldset class="td-choices" disabled=${!!locked}>
      <legend>Predict which readout the reveal will show changing.</legend>
      <div class="td-choice-grid">
        ${item.choices.map((c, idx) => {
          const chosen = prediction === c.id;
          const marked = revealedState && revealedState.choiceId === c.id;
          const verdict = marked ? (revealedState.correct ? ' — correct' : ' — not this one') : '';
          return html`<label class="td-choice" data-selected=${chosen} data-marked=${!!marked}>
            <input type="radio" name=${`td-predict-${item.id}`} value=${c.id} checked=${chosen} onChange=${() => pick(c.id)} />
            <span class="td-choice-text">${c.text}${verdict}</span>
            <span class="td-choice-key">${`Option ${String.fromCharCode(65 + idx)}`}</span>
          </label>`;
        })}
      </div>
    </fieldset>

    <div class="td-reveal" aria-label="Reveal gauges">
      <p class="td-reveal-head">${peek ? 'Reveal' : 'Predict first — the gauges stay covered until you check'}</p>
      ${peek ? html`<div class="td-gauges">
        <${Gauge} label="Clearance" state=${peek.changed === 'Clearance' ? 'moved' : 'steady'}
          note=${peek.changed === 'Clearance' ? 'The clearance dial was turned.' : 'The clearance dial was left alone.'} />
        <${Gauge} label="Glucose-dependence" state=${peek.changed === 'Glucose-dependence' ? 'moved' : 'steady'}
          note=${peek.changed === 'Glucose-dependence' ? 'The glucose dial was turned.' : 'The glucose dial was left alone.'} />
      </div>` : html`<div class="td-gauges td-covered" aria-hidden="true">
        <div class="td-gauge"><p class="td-gauge-label">Clearance</p><p class="td-gauge-state">? Covered</p></div>
        <div class="td-gauge"><p class="td-gauge-label">Glucose-dependence</p><p class="td-gauge-state">? Covered</p></div>
      </div>`}
    </div>

    ${revealedState?.missingEvidence && html`<p class="td-gap">What evidence would be needed: ${revealedState.missingEvidence}</p>`}
  </div>`;
}

TwoDialsRunner.answer = answer;
