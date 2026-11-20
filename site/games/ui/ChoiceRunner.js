// Default item runner: single-choice radio group. This is also the reference for the runner contract.
//
// RUNNER CONTRACT (any game may supply its own component with these props):
//   props: { item, locked, revealed, onSelect }
//     item      the game item (SCHEMA.md); games may read item.data
//     locked    true after the answer is checked: runner must stop accepting changes
//     revealed  null, or {correct:boolean, choiceId?:string}: show the outcome in the runner
//     onSelect  call with {correct:boolean, choiceId?:string, feedback?:string} when the learner has
//               committed a tentative answer, or with null if it is cleared. The shell then asks
//               sure/unsure and only reveals on "Check answer". Runners must be keyboard-complete
//               and must not rely on colour alone to show state.
//   optional static: runner.answer(item) -> {correct:true, choiceId?} used by "Show answer".
import { h } from '../../vendor/preact/preact.mjs';
import htm from '../../vendor/htm/htm.mjs';
import { useState, useEffect, useRef } from '../../vendor/preact/hooks.mjs';
const html = htm.bind(h);
let runnerSeq = 0; // radio group names must be unique per mounted runner (item ids repeat across games)

export function ChoiceRunner({ item, locked, revealed, onSelect }) {
  const [picked, setPicked] = useState(null);
  const group = useRef(null);
  if (group.current === null) group.current = 'choice-' + (++runnerSeq);
  useEffect(() => { setPicked(revealed && revealed.choiceId ? revealed.choiceId : null); }, [item.id, revealed && revealed.choiceId]);
  const pick = (c) => {
    if (locked) return;
    setPicked(c.id);
    onSelect({ correct: c.correct === true, choiceId: c.id, feedback: c.feedback });
  };
  return html`<fieldset class="pg-choices" disabled=${locked}>
    <legend class="pg-prompt">${item.prompt}</legend>
    ${item.choices.map((c) => {
      const mark = revealed && picked === c.id ? (c.correct ? ' (correct)' : ' (not quite)') : revealed && c.correct ? ' (the correct answer)' : '';
      return html`<label class=${'pg-choice' + (picked === c.id ? ' is-picked' : '') + (revealed && c.correct ? ' is-correct' : '')}>
        <input type="radio" name=${group.current} value=${c.id} checked=${picked === c.id} onChange=${() => pick(c)} />
        <span>${c.text}${mark}</span>
      </label>`;
    })}
  </fieldset>`;
}
ChoiceRunner.answer = (item) => {
  const c = item.choices.find((x) => x.correct);
  return { correct: true, choiceId: c && c.id };
};
