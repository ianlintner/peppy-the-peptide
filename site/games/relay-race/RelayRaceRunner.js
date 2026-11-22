/**
 * RelayRaceRunner — order the main lane and place DPP-4 on its own branch.
 * Tier 3 critique items answer through the sourced choices; other items move
 * cards. Every board change is scored by the pure evaluator; GameShell owns
 * the rest.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState } from '../../vendor/preact/hooks.mjs';
import { Peppy } from '../ui/peppy.js';
import { OUTCOME, boardFromSelection, critiqueCorrectId, evaluateBoard, initialBoard, moveStep } from './evaluator.js';

const html = htm.bind(h);
const isCritique = (item) => item?.data?.mode === 'critique';

export function answer(item) {
  if (isCritique(item)) {
    const reply = (item.choices || []).find((c) => c.id === critiqueCorrectId(item));
    return {
      correct: false,
      outcome: OUTCOME.CORRECT,
      choiceId: critiqueCorrectId(item),
      feedback: reply ? `Answer shown: ${reply.text}` : 'Answer shown: check the item data.',
      expected: item.data.main_answer,
      branch: item.data.branch_answer,
      shownAnswer: true,
    };
  }
  const result = evaluateBoard(item, { main: item.data.main_answer, branch: item.data.branch_answer });
  return {
    correct: false,
    outcome: OUTCOME.CORRECT,
    choiceId: 'main-branch',
    feedback: result.correct ? 'Answer shown: the relay order and the separate degradation branch.'
      : 'Answer shown: check the item data.',
    expected: item.data.main_answer,
    branch: item.data.branch_answer,
    shownAnswer: true,
  };
}

function Lane({ title, ids, steps, lane, onMove, locked }) {
  return html`<div class="rr-lane" data-lane=${lane}>
    <h4>${title}</h4>
    <ol class="rr-track" aria-label=${title}>
      ${ids.length === 0 && html`<li class="rr-empty">${lane === 'branch' ? 'No card on the branch yet' : lane === 'tray' ? 'No cards in the tray' : 'No cards here'}</li>`}
      ${ids.map((id, idx) => html`<li class="rr-card" data-lane=${lane}>
        <span class="rr-card-text">${steps[id]?.label || id}</span>
        <span class="rr-pos" aria-hidden="true">${lane === 'main' ? `${idx + 1}` : lane === 'branch' ? 'B' : '·'}</span>
        <span class="rr-moves">
          ${lane === 'main' && html`<button type="button" class="rr-move" disabled=${!!locked || idx === 0}
            aria-label=${`Move ${steps[id]?.label || id} earlier`} onClick=${() => onMove(id, 'up', idx)}>↑ Earlier</button>
            <button type="button" class="rr-move" disabled=${!!locked || idx === ids.length - 1}
              aria-label=${`Move ${steps[id]?.label || id} later`} onClick=${() => onMove(id, 'down', idx)}>↓ Later</button>
            <button type="button" class="rr-move" disabled=${!!locked}
              aria-label=${`Move ${steps[id]?.label || id} off the main lane to the tray`}
              onClick=${() => onMove(id, 'to-tray')}>To tray</button>`}
          ${lane !== 'main' && html`<button type="button" class="rr-move rr-to-main" disabled=${!!locked}
            aria-label=${`Move ${steps[id]?.label || id} back onto the main lane`}
            onClick=${() => onMove(id, 'to-main', 0)}>To main</button>`}
          ${lane === 'branch' && html`<button type="button" class="rr-move" disabled=${!!locked}
            aria-label=${`Move ${steps[id]?.label || id} to the tray`}
            onClick=${() => onMove(id, 'to-tray')}>To tray</button>`}
          ${lane === 'main' && html`<button type="button" class="rr-move" disabled=${!!locked}
            aria-label=${`Move ${steps[id]?.label || id} to the branch`}
            onClick=${() => onMove(id, 'to-branch')}>To branch</button>`}
          ${lane === 'tray' && html`<button type="button" class="rr-move" disabled=${!!locked}
            aria-label=${`Move ${steps[id]?.label || id} to the branch`}
            onClick=${() => onMove(id, 'to-branch')}>To branch</button>`}
        </span>
      </li>`)}
    </ol>
  </div>`;
}

function CritiqueChoices({ item, locked, onSelect }) {
  const [picked, setPicked] = useState(null);
  const pick = (choice) => {
    if (locked) return;
    setPicked(choice.id);
    onSelect({
      correct: choice.correct === true,
      outcome: choice.correct === true ? OUTCOME.CORRECT : OUTCOME.WRONG_REPLY,
      choiceId: choice.id,
      feedback: choice.correct ? '' : (choice.feedback || 'Check the sourced relay and the evidence gap.'),
    });
  };
  return html`<fieldset class="rr-critique" aria-label=${item.prompt}>
    <legend>Choose the careful reply</legend>
    ${item.choices.map((choice) => html`<label class="rr-choice ${picked === choice.id ? 'is-picked' : ''}">
      <input type="radio" name=${`rr-critique-${item.id}`} value=${choice.id} checked=${picked === choice.id}
        disabled=${!!locked} onChange=${() => pick(choice)} />
      <span>${choice.text}</span>
    </label>`)}
  </fieldset>`;
}

export function RelayRaceRunner({ item, locked, revealed, onSelect }) {
  const [board, setBoard] = useState(() => initialBoard(item) || { main: [], branch: [], tray: [] });
  const steps = item?.data?.steps || {};
  const current = revealed && !isCritique(item) ? boardFromSelection(item, 'main-branch') : board;
  const result = current ? evaluateBoard(item, current) : null;
  const peppyState = revealed ? (revealed.correct ? 'cheer' : 'oops') : (result?.correct ? 'thinking' : 'idle');
  const peppyLabel = revealed
    ? (revealed.correct ? 'Peppy cheers: the relay and its branch are in place.'
      : 'Peppy looks thoughtful: check the order and the separate branch.')
    : (isCritique(item) ? 'Peppy waits for a careful reply, not a full mechanism.'
      : 'Peppy watches the relay board; DPP-4 belongs on its own branch.');

  const move = (id, action, index) => {
    if (locked) return;
    const next = moveStep(board, id, action, index);
    if (next === board) return;
    setBoard(next);
    const scored = evaluateBoard(item, next);
    onSelect({
      correct: scored.correct,
      outcome: scored.outcome,
      feedback: scored.feedback || (scored.correct ? '' : 'Keep arranging the board.'),
      difference: scored.difference,
      board: next,
    });
  };

  return html`<div class="rr-item" data-tier=${item.tier} data-mode=${isCritique(item) ? 'critique' : 'board'}>
    ${item.needs_review === true && html`<p class="rr-review" data-review="pending">
      <strong>Pending clinical review.</strong> ${item.review_note || 'This critique item is flagged for clinical review.'}
    </p>`}

    <div class="rr-stage">
      <div class="rr-board">
        <p class="rr-eyebrow">Relay board · ${`Tier ${item.tier}`}</p>
        <blockquote class="rr-prompt" aria-label="Question"><p>${item.prompt}</p></blockquote>
        ${isCritique(item) && html`<p class="rr-context">The sourced relay: meal → L cell GLP-1 → beta-cell receptor → glucose-dependent insulin effect, with DPP-4 degradation on a separate branch.</p>`}
        ${!isCritique(item) && html`<${Lane} title="Main relay (in order)" ids=${current.main} steps=${steps} lane="main" onMove=${move} locked=${!!locked} />`}
        ${!isCritique(item) && html`<${Lane} title="Separate degradation branch" ids=${current.branch} steps=${steps} lane="branch" onMove=${move} locked=${!!locked} />`}
        ${!isCritique(item) && html`<${Lane} title="Card tray" ids=${current.tray} steps=${steps} lane="tray" onMove=${move} locked=${!!locked} />`}
        ${isCritique(item) && html`<${CritiqueChoices} item=${item} locked=${!!locked} onSelect=${onSelect} />`}
        <p class="rr-hintline">${isCritique(item) ? 'Use Tab to reach a reply, then Space to select. No timers.'
          : 'Use Tab to reach a card’s buttons, then Enter or Space. “To main” returns a card to the relay. No timers.'}</p>
      </div>
      <div class="rr-mascot">
        <${Peppy} state=${peppyState} label=${peppyLabel} size=${72} />
        <p class="rr-say" aria-hidden="true">${peppyState === 'cheer' ? 'Lane by lane — nice!'
          : peppyState === 'oops' ? 'Read the order and the branch again.'
          : 'Place the cards, then say how sure you are.'}</p>
      </div>
    </div>

    ${revealed?.board && html`<p class="rr-receipt">Your final board:
      main ${revealed.board.main.join(' → ') || '(empty)'}; branch ${revealed.board.branch.join(' → ') || '(empty)'}.</p>`}
    ${revealed?.expected && html`<p class="rr-expected">Sourced order: ${revealed.expected.join(' → ')};
      branch: ${(revealed.branch || item.data.branch_answer).join(' → ')}.</p>`}
  </div>`;
}

RelayRaceRunner.answer = answer;
