/**
 * RelayRaceRunner — order the main lane and place DPP-4 on its own branch.
 * Every board change is scored by the pure evaluator; GameShell owns the rest.
 */
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState } from '../../vendor/preact/hooks.mjs';
import { Peppy } from '../ui/peppy.js';
import { OUTCOME, boardFromSelection, evaluateBoard, initialBoard, moveStep } from './evaluator.js';

const html = htm.bind(h);

export function answer(item) {
  const result = evaluateBoard(item, { main: item.data.main_answer, branch: item.data.branch_answer });
  return {
    correct: false,
    outcome: OUTCOME.CORRECT,
    choiceId: 'main-branch',
    feedback: 'Answer shown: the relay order and the separate degradation branch.',
    expected: item.data.main_answer,
    branch: item.data.branch_answer,
    shownAnswer: true,
    ...(result.outcome === OUTCOME.CORRECT ? {} : {}),
  };
}

function Lane({ title, ids, steps, lane, onMove, locked }) {
  return html`<div class="rr-lane" data-lane=${lane}>
    <h4>${title}</h4>
    <ol class="rr-track" aria-label=${title}>
      ${ids.length === 0 && html`<li class="rr-empty">${lane === 'branch' ? 'No card on the branch yet' : 'No cards here'}</li>`}
      ${ids.map((id, idx) => html`<li class="rr-card" data-lane=${lane}>
        <span class="rr-card-text">${steps[id]?.label || id}</span>
        <span class="rr-pos" aria-hidden="true">${lane === 'main' ? `${idx + 1}` : 'B'}</span>
        <span class="rr-moves">
          ${lane === 'main' && html`<button type="button" class="rr-move" disabled=${!!locked || idx === 0}
            aria-label=${`Move ${steps[id]?.label || id} earlier`} onClick=${() => onMove(id, 'up', idx)}>↑ Earlier</button>
            <button type="button" class="rr-move" disabled=${!!locked || idx === ids.length - 1}
              aria-label=${`Move ${steps[id]?.label || id} later`} onClick=${() => onMove(id, 'down', idx)}>↓ Later</button>`}
          <button type="button" class="rr-move" disabled=${!!locked}
            aria-label=${`Move ${steps[id]?.label || id} to ${lane === 'branch' ? 'the tray' : 'the branch'}`}
            onClick=${() => onMove(id, lane === 'branch' ? 'to-tray' : 'to-branch')}>
            ${lane === 'branch' ? 'To tray' : 'To branch'}</button>
        </span>
      </li>`)}
    </ol>
  </div>`;
}

export function RelayRaceRunner({ item, locked, revealed, onSelect }) {
  const [board, setBoard] = useState(() => initialBoard(item) || { main: [], branch: [], tray: [] });
  const steps = item?.data?.steps || {};
  const current = revealed ? boardFromSelection(item, 'main-branch') : board;
  const result = current ? evaluateBoard(item, current) : null;
  const peppyState = revealed ? (revealed.correct ? 'cheer' : 'oops') : (result?.correct ? 'thinking' : 'idle');
  const peppyLabel = revealed
    ? (revealed.correct ? 'Peppy cheers: the relay and its branch are in place.'
      : 'Peppy looks thoughtful: check the order and the separate branch.')
    : 'Peppy watches the relay board; DPP-4 belongs on its own branch.';

  const move = (id, action, index) => {
    if (locked) return;
    const next = moveStep(board, id, action, index);
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

  return html`<div class="rr-item" data-tier=${item.tier}>
    ${item.needs_review === true && html`<p class="rr-review" data-review="pending">
      <strong>Pending clinical review.</strong> ${item.review_note || 'This critique item is flagged for clinical review.'}
    </p>`}

    <div class="rr-stage">
      <div class="rr-board">
        <p class="rr-eyebrow">Relay board · ${`Tier ${item.tier}`}</p>
        <blockquote class="rr-prompt" aria-label="Question"><p>${item.prompt}</p></blockquote>
        <${Lane} title="Main relay (in order)" ids=${current.main} steps=${steps} lane="main" onMove=${move} locked=${!!locked} />
        <${Lane} title="Separate degradation branch" ids=${current.branch} steps=${steps} lane="branch" onMove=${move} locked=${!!locked} />
        <${Lane} title="Card tray" ids=${current.tray} steps=${steps} lane="tray" onMove=${move} locked=${!!locked} />
        <p class="rr-hintline">Use Tab to reach a card's buttons, then Enter or Space. No timers.</p>
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
