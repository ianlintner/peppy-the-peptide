/**
 * IsletDispatchRunner — scenario card → choose a cell/signal/target dispatch.
 * GameShell owns tiers, hints, confidence and feedback; scoring is pure.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState } from '../../vendor/preact/hooks.mjs';
import { shuffle } from '../engine/shuffle.js';
import { Peppy } from '../ui/peppy.js';
import { OUTCOME, dispatchOutcome, markedCorrectId, planText } from './evaluator.js';

const html = htm.bind(h);

export function answer(item) {
  const id = markedCorrectId(item);
  const result = dispatchOutcome(item, id);
  return {
    correct: false,
    choiceId: id,
    outcome: OUTCOME.CORRECT,
    feedback: 'Answer shown: this is the sourced plan for the scenario card.',
    expected: result.expected,
    plan: planText(result.expected),
    shownAnswer: true,
  };
}

export function IsletDispatchRunner({ item, locked, revealed, onSelect }) {
  const data = item?.data || {};
  const [chosen, setChosen] = useState(null);
  const state = data.state === 'low' ? 'between meals' : 'after a meal';
  const peppyState = revealed ? (revealed.correct ? 'cheer' : 'oops') : (chosen ? 'thinking' : 'idle');
  const peppyLabel = revealed
    ? (revealed.correct ? 'Peppy cheers: that dispatch fits the card.'
      : 'Peppy looks thoughtful: compare the three slots with the sourced plan.')
    : (chosen ? 'Peppy is waiting while you say how sure you are.'
      : 'Peppy waits beside the dispatch board.');

  const orderedChoices = shuffle(item.choices || [], item.id);
  const pick = (id) => {
    if (locked) return;
    setChosen(id);
    const r = dispatchOutcome(item, id);
    onSelect({
      correct: r.correct,
      outcome: r.outcome,
      choiceId: id,
      expected: r.expected,
      plan: planText(data.options?.[id]),
      feedback: r.feedback || (r.correct ? '' : 'Compare each slot with the scenario card.'),
    });
  };

  return html`<div class="id-item" data-tier=${item.tier}>
    ${item.needs_review === true && html`<p class="id-review" data-review="pending">
      <strong>Pending clinical review.</strong> ${item.review_note || 'This critique item is flagged for clinical review.'}
    </p>`}

    <div class="id-stage">
      <div class="id-card">
        <p class="id-eyebrow">Dispatch desk · ${`Tier ${item.tier}`}</p>
        <p class="id-state"><span aria-hidden="true">${data.state === 'low' ? '↓' : '↑'}</span>
          ${data.state === 'low' ? 'Glucose state: low / between meals' : 'Glucose state: elevated / after a meal'}</p>
        <blockquote class="id-prompt" aria-label="Scenario card"><p>${item.prompt}</p></blockquote>
        <p class="id-cue">Scenario cue: ${data.cue || state}</p>
        ${data.contrast && html`<p class="id-contrast">Contrast with the ${data.contrast} state card.</p>`}
        <p class="id-hintline">Choose one plan. Arrow keys move between plans; nothing is timed.</p>
      </div>
      <div class="id-mascot">
        <${Peppy} state=${peppyState} label=${peppyLabel} size=${72} />
        <p class="id-say" aria-hidden="true">${peppyState === 'cheer' ? 'That plan fits!'
          : peppyState === 'oops' ? 'Check cell, then signal, then target.'
          : peppyState === 'thinking' ? 'Now say how sure you are.'
          : 'Read the card, then dispatch a plan.'}</p>
      </div>
    </div>

    <fieldset class="id-choices" disabled=${!!locked}>
      <legend>Which cell → signal → target plan fits this card?</legend>
      <div class="id-grid">
        ${orderedChoices.map((c, idx) => {
          const plan = data.options?.[c.id];
          const marked = revealed && revealed.choiceId === c.id;
          return html`<label class="id-choice" data-selected=${chosen === c.id} data-marked=${!!marked}>
            <input type="radio" name=${`id-plan-${item.id}`} value=${c.id} checked=${chosen === c.id}
              onChange=${() => pick(c.id)} />
            <span class="id-plan">${plan ? html`<span class="id-cell">${plan.cell}</span>
              <span class="id-arrow" aria-hidden="true">→</span>
              <span class="id-signal">${plan.signal}</span>
              <span class="id-arrow" aria-hidden="true">→</span>
              <span class="id-target">${plan.target}</span>` : c.text}</span>
            <span class="id-key">${`Plan ${String.fromCharCode(65 + idx)}`}</span>
            ${marked && html`<span class="id-verdict">${revealed.correct ? 'Correct' : 'Not this one'}</span>`}
          </label>`;
        })}
      </div>
    </fieldset>

    ${revealed?.plan && html`<p class="id-receipt">Dispatch receipt: <strong>${revealed.plan}</strong></p>`}
    ${revealed?.expected && html`<p class="id-expected">Sourced plan: ${planText(revealed.expected)}</p>`}
  </div>`;
}

IsletDispatchRunner.answer = answer;
