/**
 * Pure evaluator for Relay Race (Lesson 3).
 *
 * The board has two lanes. The main lane is an ordered sequence of four
 * sourced steps; DPP-4 degradation belongs on a separate branch. Extra
 * "distractor" cards are plausible but unsupported claims that must stay off
 * both lanes. No DOM, storage, network or time.
 */
export const LANE = Object.freeze({ MAIN: 'main', BRANCH: 'branch', DISTRACTOR: 'distractor' });

export const OUTCOME = Object.freeze({
  CORRECT: 'correct',
  WRONG_ORDER: 'wrong-order',
  BRANCH_IN_MAIN: 'branch-in-main',
  MAIN_IN_BRANCH: 'main-in-branch',
  DISTRACTOR_ON_BOARD: 'distractor-on-board',
  MISSING_STEP: 'missing-step',
  EXTRA_STEP: 'extra-step',
  INCONSISTENT_ITEM: 'inconsistent-item',
});

export const MISCONCEPTION_TEXT = Object.freeze({
  [OUTCOME.WRONG_ORDER]: 'The steps are sourced in a specific order. The message must reach the receptor before the insulin effect.',
  [OUTCOME.BRANCH_IN_MAIN]: 'Degradation is reported as a separate branch, not a hand-off step in the main relay.',
  [OUTCOME.MAIN_IN_BRANCH]: 'That step belongs to the main sequence; only the degradation fact sits on the branch.',
  [OUTCOME.DISTRACTOR_ON_BOARD]: 'That card is not supported by the lesson; keep it out of both lanes.',
  [OUTCOME.MISSING_STEP]: 'A main-lane step is missing. Fill every position in the sourced order.',
  [OUTCOME.EXTRA_STEP]: 'An unexpected card is on the board. Remove it or return it to the tray.',
});

export function markedCorrectId(item) {
  const right = (item?.choices || []).filter((c) => c && c.correct === true);
  return right.length === 1 ? (right[0].id ?? null) : null;
}

/** The board shape the runner starts from, derived entirely from item data. */
export function initialBoard(item) {
  const d = item?.data;
  if (!d || !d.steps || !Array.isArray(d.main_order) || !Array.isArray(d.branch_ids)) return null;
  const order = d.main_order.slice();
  const branch = d.branch_ids.slice();
  const tray = Object.keys(d.steps).filter((id) => !order.includes(id) && !branch.includes(id));
  return { main: order, branch, tray };
}

export function boardFromSelection(item, selectedChoiceId) {
  if (selectedChoiceId !== 'main-branch') return initialBoard(item);
  const d = item?.data;
  return d ? { main: (d.main_answer ?? d.main_order).slice(), branch: (d.branch_answer ?? d.branch_ids).slice(), tray: [] } : null;
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/** True when the authored starting board already matches the sourced answer. */
export function startsSolved(item) {
  const board = initialBoard(item);
  if (!board) return false;
  return board.main.join('|') === item.data.main_answer.join('|')
    && board.branch.join('|') === item.data.branch_answer.join('|');
}

/**
 * Score a board against the item's sourced main order and branch assignment.
 * @param {object} item
 * @param {{main: string[], branch: string[]}} board
 * @returns {{correct: boolean, outcome: string, feedback: string, difference: number}}
 */
export function evaluateBoard(item, board) {
  const data = item?.data;
  const source = initialBoard(item);
  if (!source || !data || !Array.isArray(board?.main) || !Array.isArray(board?.branch)) {
    return { correct: false, outcome: OUTCOME.INCONSISTENT_ITEM, feedback: 'This item is not authorable.', difference: -1 };
  }
  const expected = data.main_answer ?? data.main_order;
  const expectedBranch = data.branch_answer ?? data.branch_ids;
  const step = (id) => data.steps?.[id];
  const bad = (outcome) => ({
    correct: false, outcome, feedback: MISCONCEPTION_TEXT[outcome], difference: -1,
  });

  const unexpected = board.main.concat(board.branch).filter((id) => !step(id));
  if (unexpected.length) return bad(OUTCOME.EXTRA_STEP);

  const canonical = expected.concat(expectedBranch);
  const distractor = board.main.concat(board.branch).find((id) => !canonical.includes(id));
  if (distractor) return bad(OUTCOME.DISTRACTOR_ON_BOARD);

  const branchLeak = board.main.find((id) => expectedBranch.includes(id));
  if (branchLeak) return bad(OUTCOME.BRANCH_IN_MAIN);

  const mainLeak = board.branch.find((id) => expected.includes(id));
  if (mainLeak) return bad(OUTCOME.MAIN_IN_BRANCH);

  if (board.main.length !== expected.length || board.branch.length !== expectedBranch.length) {
    return bad(OUTCOME.MISSING_STEP);
  }
  const difference = firstDifference(board.main, expected);
  if (difference !== -1) return { ...bad(OUTCOME.WRONG_ORDER), difference };
  const branchDifference = firstDifference(board.branch, expectedBranch);
  if (branchDifference !== -1) return { ...bad(OUTCOME.WRONG_ORDER), difference: branchDifference };
  return { correct: true, outcome: OUTCOME.CORRECT, feedback: '', difference: -1 };
}

/** Move a step between lanes or within the main order. Pure: returns a new board. */
export function moveStep(board, id, action, index = 0) {
  if (!board || !id || !board.main || !board.branch || !board.tray) return board;
  const next = { main: board.main.slice(), branch: board.branch.slice(), tray: board.tray.slice() };
  const all = ['main', 'branch', 'tray'];
  const from = all.find((lane) => next[lane].includes(id));
  if (!from) return board;
  next[from].splice(next[from].indexOf(id), 1);
  if (action === 'to-main') {
    next.main.splice(Math.max(0, Math.min(index, next.main.length)), 0, id);
  } else if (action === 'to-branch') {
    next.branch.push(id);
  } else if (action === 'to-tray') {
    next.tray.push(id);
  } else if (action === 'up' && from === 'main') {
    const at = Math.max(0, index - 1);
    next.main.splice(at, 0, id);
  } else if (action === 'down' && from === 'main') {
    const at = Math.min(next.main.length, index + 1);
    next.main.splice(at, 0, id);
  } else {
    next[from].push(id);
  }
  return next;
}

/** Content invariants for load time. */
export function validateItems(items) {
  if (!Array.isArray(items)) return ['items: expected an array'];
  const errors = [];
  const tiers = new Map();
  items.forEach((item, index) => {
    const where = `items[${index}]`;
    if (!item || typeof item !== 'object') { errors.push(`${where}: expected an object`); return; }
    tiers.set(item.tier, (tiers.get(item.tier) ?? 0) + 1);
    const d = item.data;
    const steps = d?.steps;
    if (!steps || typeof steps !== 'object') { errors.push(`${where}.data.steps: missing`); return; }
    if (!Array.isArray(d.main_order) || !Array.isArray(d.branch_ids)) {
      errors.push(`${where}.data: main_order and branch_ids must be arrays`);
      return;
    }
    if (d.main_order.some((id) => d.branch_ids.includes(id))) {
      errors.push(`${where}.data: lanes must be disjoint`);
    }
    for (const id of Object.keys(steps)) {
      const lane = d.main_order.includes(id) ? LANE.MAIN : d.branch_ids.includes(id) ? LANE.BRANCH : LANE.DISTRACTOR;
      if (steps[id]?.lane !== lane) errors.push(`${where}.data.steps[${id}].lane: expected ${lane}`);
    }
    if (d.mode === 'critique') {
      if (item.tier !== 3 || !d.gap) errors.push(`${where}.data: critique mode requires tier 3 and a gap`);
    } else if (item.tier !== 3 && startsSolved(item)) {
      errors.push(`${where}.data: board starts solved; learners must have a move to make`);
    }
    if (markedCorrectId(item) !== 'main-branch') errors.push(`${where}.choices: only main-branch may be correct`);
    if (item.needs_review === true && typeof item.review_note !== 'string') {
      errors.push(`${where}.review_note: required for flagged items`);
    }
  });
  for (const tier of [1, 2, 3]) {
    if ((tiers.get(tier) ?? 0) !== 6) errors.push(`tier ${tier}: need exactly 6 items`);
  }
  return errors;
}
