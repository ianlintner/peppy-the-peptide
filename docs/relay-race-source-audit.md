# Relay Race — source audit

Game: `relay-race` (Lesson 3, `endogenous-glp1`). Content: `content/games/relay-race.json`.
Audited: 2026-11-22. `source_ids` are 1-based positions in Lesson 3's two-source shelf.

## Claims the game makes

The main lane is always the same four sourced steps in order:

1. meal;
2. L cell releases GLP-1;
3. receptor on the beta cell;
4. glucose-dependent insulin effect.

DPP-4 degradation is a **separate branch**, never a hand-off in the main relay. Distractor
cards are plausible but unsupported claims (for example, that GLP-1 enters the cell, or
that insulin acts regardless of glucose) and must stay out of both lanes.

## Source [1] — NIDDK, *How GLP-1 research led to medicines for diabetes and obesity*

URL: https://www.niddk.nih.gov/news/archive/2021/story-discovery-medications-diabetes-obesity-emerged-research-pancreatic-hormone
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/peppy-audit/niddk.html` (HTTP 200 on 2026-11-22).

Fetched quote (verbatim):
> "experiments demonstrated that GLP-1 is produced not in the pancreas but by intestinal cells close to the stomach—and only when stimulated by the presence of food—helping establish that it is, in fact, an incretin"

Maps to: main steps `meal` → `lcell`. The game uses "L cell" as the lesson's name for the
intestinal source cell.

Fetched quote (verbatim, previously verified by the Two Dials card audit):
> "pancreatic β cells release more insulin in response to elevated glucose if they are first stimulated with part of the GLP-1 protein."

Maps to: main steps `receptor` → `insulin`, and the glucose-dependence wording.

Fetched quote (verbatim, previously verified by the Two Dials card audit):
> "GLP-1 only lasts a few minutes in the blood stream before it is degraded by other proteins."

Maps to: the `dpp4` branch. **Numeric detail deliberately excluded** — the game never
reproduces a duration.

## Source [2] — Müller et al., *Molecular Metabolism* — GLP-1 review (PMC6812410)

URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC6812410/
The page returned a reCAPTCHA interstitial on 2026-11-22 re-fetch, so this audit reuses the
verbatim quotes already fetched with HTTP 200 and recorded in
`docs/two-dials-source-audit.md` by the preceding Kanban card:

> "Among the numerous metabolic effects of GLP-1 are the glucose-dependent stimulation of insulin secretion, decrease of gastric emptying, inhibition of food intake, increase of natriuresis and diuresis, and modulation of rodent β-cell proliferation."

> "Native GLP-1 has a very short half-life, which, depending on the species, is around 1–2 min and results from two causes: (a) the action of the enzyme dipeptidylpeptidase-4 (DPP-4) and (b) renal elimination."

> "ensures that the insulinotropic action of GLP-1 is highly dependent on the ambient glucose concentration."

Maps to: `receptor` → `insulin` (glucose-dependent effect) and the separate `dpp4`
degradation branch. No half-life number or enzyme number is carried into player text.

## Deliberately excluded

- Durations, concentrations, enzyme numbers, doses, efficacy figures and brand names.
- Product comparisons or treatment guidance of any kind.
- Claims about intracellular trafficking or molecular mechanism beyond the lesson's
  qualitative relay; Tier 3 asks what evidence *would* be needed instead.

## Safety flags

Tier 3 items carry `needs_review: true`, `review_note` and `data.gap`. `review_mode: "flagged"`
surfaces the review banner. Every item stores both the scrambled starting board
(`main_order`, `branch_ids`) and the canonical sourced answer (`main_answer`,
`branch_answer`); the evaluator scores only against the canonical pair, so a repair item
can start with DPP-4 in the tray without weakening the rule.

## Keyboard-only run

See `docs/relay-race-keyboard-walkthrough.md`.
