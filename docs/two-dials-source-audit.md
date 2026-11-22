# Two Dials — source audit

Game: `two-dials` (Lesson 3, `endogenous-glp1`). Content: `content/games/two-dials.json`.
Audited: 2026-11-21. Fetched sources are the same two on Lesson 3's source shelf.

## What the game claims, and where it comes from

The game makes exactly one conceptual claim: **signal clearance and glucose-dependent
insulin effect are two separate observations**, so turning one lab dial moves its own
readout while the other holds steady. Tier 1–2 items train that separation; Tier 3
items critique statements that assert an unsupported causal link between the two.

### Source [1] — NIDDK, *How GLP-1 research led to medicines for diabetes and obesity*
URL: https://www.niddk.nih.gov/news/archive/2021/story-discovery-medications-diabetes-obesity-emerged-research-pancreatic-hormone
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/two-dials/niddk.html` (HTTP 200).

Fetched quote (verbatim):
> "pancreatic β cells release more insulin in response to elevated glucose if they are first stimulated with part of the GLP-1 protein."

Maps to: the glucose-dependence readout in Tier 1 (`t1-glucose-dial`, `t1-two-readouts`) and
the "glucose-dependence is a separate observation" phrasing.

Fetched quote (verbatim):
> "GLP-1 only lasts a few minutes in the blood stream before it is degraded by other proteins."

Maps to: the clearance dial's existence in Tier 1 (`t1-clearance-dial`, `t1-hold-steady`).
**Numeric detail deliberately excluded.** The game says "quick / slow" only; it never
reproduces a duration. Lesson 3 itself keeps this qualitative.

### Source [2] — Müller et al., *Molecular Metabolism* — GLP-1 review (PMC6812410)
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC6812410/
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/two-dials/muller.html` (HTTP 200).

Fetched quote (verbatim):
> "Among the numerous metabolic effects of GLP-1 are the glucose-dependent stimulation of insulin secretion, decrease of gastric emptying, inhibition of food intake, increase of natriuresis and diuresis, and modulation of rodent β-cell proliferation."

Maps to: the glucose-dependence readout (`t1-glucose-dial`, `t2-combined-quick-high`,
`t2-best-explanation-glucose`) and the separation from clearance.

Fetched quote (verbatim):
> "Native GLP-1 has a very short half-life, which, depending on the species, is around 1–2 min and results from two causes: (a) the action of the enzyme dipeptidylpeptidase-4 (DPP-4) and (b) renal elimination."

Maps to: the existence of a distinct clearance process in `t1-clearance-dial`,
`t2-swap-dials`. **Numeric detail deliberately excluded.** The game never reproduces
a duration, enzyme number or measurement unit; it only names the qualitative dial
"signal clearance: quick / slow".

Fetched quote (verbatim):
> "ensures that the insulinotropic action of GLP-1 is highly dependent on the ambient glucose concentration."

Maps to: the glucose dial's readout. Again, the game uses words (`low / mid / high`)
and carries no concentration values.

## Deliberately excluded from game text

- All duration, half-life and concentration numbers, and any units.
- DPP-4 as a named mechanism claim in player-facing items — the sources name it, but
  the game does not assert that it is the cause of glucose-dependence. Tier 3 asks
  what evidence *would* be needed, which is an epistemic skill, not a mechanism claim.
- Any product, brand, dosing, efficacy comparison or treatment guidance.
- Any deeper molecular "why". Tier 3 item `t3-critique-deeper-why` explicitly says
  the lesson's sources report the dependence but not a full molecular cause, and that
  a deeper why requires its own fetched, quoted and reviewed source (`needs_review: true`).

## Safety flags applied

All six Tier 3 critique items carry `needs_review: true`, a `review_note`, and a
`data.missing_evidence` string naming what observation would be required to support
the claim being critiqued. `review_mode: "flagged"` keeps them playable behind a
visible "Pending clinical review" banner. Validator and node tests assert all of this.

## Keyboard-only run

The game is keyboard-complete by construction and verified by static review:

- Each dial is a radiogroup of native `<input type="radio">`; Tab reaches a dial and
  arrow keys move between its settings. Focus is visible via `:focus-within` outline.
- Predictions are native radios in a `<fieldset>`; same Tab/arrow behaviour.
- GameShell's Check / Hint / Show answer / Source / Next controls are native buttons;
  `aria-disabled` marks unavailable actions, and focus moves to the aria-live feedback
  panel on reveal and to the prompt group on the next question.
- No timers, no countdowns, no drag-and-drop, no hover-only affordance.
- Gauges carry text ("Changed" / "Held steady") plus an arrow or equals glyph, so
  meaning is never colour-only. Covered gauges are `aria-hidden` placeholders.
- `prefers-reduced-motion` disables all transitions and animations in `dials.css`.
- The lesson page has a `<noscript>` fallback; the lesson's self-check works without JS.

## Acceptance evidence

```
python3 scripts/build.py                      → Built 4 lesson(s) and 2 public game(s)
python3 scripts/check.py                      → PASS: 7 pages, 4 lessons, 2 public games
node --test "site/games/**/__tests__/*.test.js" → pass 9, fail 0
python -m unittest discover -s tests          → pass
```
