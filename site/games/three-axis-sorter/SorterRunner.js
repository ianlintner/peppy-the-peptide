/**
 * SorterRunner — the game-specific item runner for the Three-Axis Sorter.
 *
 * GameShell owns the hint ladder, confidence tag, source shelf, aria-live feedback and
 * tier/progress controls. This module only owns the card-to-shelf interaction: a generic
 * description card, fourradio-decided shelves, the "is this settled?" rule, and Peppy's
 * reaction. All scoring goes through the pure evaluator in ./evaluator.js.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useMemo, useState } from '../../vendor/preact/hooks.mjs';
import { Peppy } from '../ui/peppy.js';
import { AXES, CANNOT_DETERMINE, evaluateSort } from './evaluator.js';

const html = htm.bind(h);
const SHELVES = [
  { id: 'same-receptor', short: 'Receptor', title: AXES.receptor, hint: 'Where the signal binds' },
  { id: 'same-molecule', short: 'Molecule', title: AXES.molecule, hint: 'What the molecule is' },
  { id: 'reviewed-approved', short: 'Review', title: AXES.regulatory, hint: 'A reviewed use for a product' },
  { id: CANNOT_DETERMINE, short: 'Evidence gap', title: 'The stated evidence cannot settle this axis', hint: 'Name what is missing' },
];

let seq = 0;

/** Return the static answer result for GameShell's "Show answer" path. */
export function answer(item) {
  const r = evaluateSort(item, item?.data?.answer);
  return { correct: false, choiceId: item?.data?.answer ?? null, feedback: r.feedback, shownAnswer: true };
}

export function SorterRunner({ item, locked, revealed, onSelect }) {
  const [chosen, setChosen] = useState(null);
  const groupId = useMemo(() => `sorter-${++seq}`, []);
  const evalResult = useMemo(() => evaluateSort(item, chosen), [item.id, chosen]);
  const mark = revealed || (chosen && locked ? evalResult : null);
  const peppyState = mark
    ? (mark.correct ? 'cheer' : 'oops')
    : (chosen ? 'thinking' : 'idle');
  const peppyLabel = mark
    ? (mark.correct ? 'Peppy cheers: that shelf fits the card.'
      : 'Peppy looks concerned: that shelf does not fit the card.')
    : (chosen ? 'Peppy is thinking about your shelf choice.'
      : 'Peppy waits beside the shelves.');

  const pick = (id) => {
    if (locked) return;
    setChosen(id);
    const r = evaluateSort(item, id);
    onSelect({
      correct: r.correct,
      outcome: r.outcome,
      choiceId: r.choiceId,
      expected: r.expected,
      axis: r.axis,
      feedback: r.feedback,
      missingEvidence: r.missingEvidence,
    });
  };

  return html`<div class="sorter-item" data-tier=${item.tier}>
    ${item.needs_review === true && html`<p class="sorter-review" data-review="pending">
      <strong>Pending clinical review.</strong> ${item.review_note || 'This evidence-gap item is flagged for clinical review.'}
    </p>`}

    <div class="sorter-stage">
      <div class="sorter-card-wrap">
        <p class="sorter-eyebrow">Description card · ${`Tier ${item.tier}`}</p>
        <blockquote class="sorter-card" aria-label="Card to sort">
          <p>${item.data.card || item.prompt}</p>
        </blockquote>
        <p class="sorter-question">Which statement does this card actually support?</p>
      </div>
      <div class="sorter-mascot">
        <${Peppy} state=${peppyState} label=${peppyLabel} size=${72} />
        <p class="sorter-say" aria-hidden="true">${peppyState === 'cheer' ? 'Yes — that shelf fits!'
          : peppyState === 'oops' ? 'Let’s check the other shelves.'
          : peppyState === 'thinking' ? 'Hmm… which axis is settled?'
          : 'Sort the card onto a shelf.'}</p>
      </div>
    </div>

    <fieldset class="sorter-shelves" disabled=${!!locked}>
      <legend>Choose one shelf. Use Tab to reach the shelves, then arrow keys to move between them.</legend>
      <div class="sorter-grid">
        ${item.choices.map((c) => {
          const shelf = c.id.includes('receptor') ? SHELVES[0]
            : c.id.includes('molecule') ? SHELVES[1]
            : c.id === CANNOT_DETERMINE || c.id === 'cannot-determine-alt' ? SHELVES[3]
            : SHELVES[2];
          const isChosen = chosen === c.id;
          const isMarked = mark && mark.choiceId === c.id;
          const status = isMarked ? (mark.correct ? ' — correct' : ' — not this shelf') : '';
          return html`<label class="sorter-shelf" data-selected=${isChosen} data-marked=${!!isMarked}>
            <input type="radio" name=${groupId} value=${c.id} checked=${isChosen} onChange=${() => pick(c.id)} />
            <span class="sorter-shelf-name">${c.text}${status}</span>
            <span class="sorter-shelf-hint">${shelf.hint}</span>
          </label>`;
        })}
      </div>
    </fieldset>

    ${chosen && !locked && html`<p class="sorter-pending">Selected: <strong>${(item.choices.find((c) => c.id === chosen) || {}).text}</strong>. Choose how sure you are, then check.</p>`}
    ${mark && mark.missingEvidence && html`<p class="sorter-gap">Missing evidence: ${mark.missingEvidence}</p>`}
  </div>`;
}

SorterRunner.answer = answer;
