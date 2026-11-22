# Islet Dispatch — source audit

Game: `islet-dispatch` (Lesson 2, `signal-cast`). Content: `content/games/islet-dispatch.json`.
Audited: 2026-11-22. Only the two sources on Lesson 2's shelf are used; `source_ids` are
1-based positions in that list.

## Claims the game makes

Two qualitative dispatch plans, and no others:

- low glucose → **alpha cell → glucagon → liver**;
- elevated glucose → **beta cell → insulin → many cell types**.

All 18 items are permutations, contrasts or critiques of these pairs. No concentrations,
timings, doses, efficacy figures, brand names or treatment guidance appear.

## Source [1] — NIDDK, *How GLP-1 research led to medicines for diabetes and obesity*

URL: https://www.niddk.nih.gov/news/archive/2021/story-discovery-medications-diabetes-obesity-emerged-research-pancreatic-hormone
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/peppy-audit/niddk.html` (HTTP 200 on 2026-11-22).

Fetched quote (verbatim):
> "When blood glucose levels are too low, another type of islet cells—α (alpha) cells—release a hormone called glucagon, which signals the liver to release glucose into the blood"

Maps to: every low-state item's `data.answer` (`alpha-glucagon-liver`) and the `liver` target
in contrast items.

Fetched quote (verbatim, previously verified by the Two Dials card audit):
> "pancreatic β cells release more insulin in response to elevated glucose if they are first stimulated with part of the GLP-1 protein."

Maps to: the beta-cell/insulin half of every elevated-state item. General target wording
("many cell types") follows Lesson 2's college depth prose, which cites sources [1][2];
the game deliberately says "many cell types" and never enumerates tissues.

Fetched quote (verbatim):
> "These two critical hormones also regulate one another—rising insulin levels help inactivate lingering glucagon, and vice versa—to ensure agile transitions between periods of fasting and of caloric plenty"

Maps to: the "partners, not good vs bad" feedback and Tier 2 contrast items.

## Source [2] — Endotext (NCBI Bookshelf), *Glucagon Physiology*

URL: https://www.ncbi.nlm.nih.gov/books/NBK279127/
The page returned a reCAPTCHA interstitial on 2026-11-22 re-fetch, so this audit relies on
the Lesson 2 editorial text that cites it (low glucose as a stimulus for glucagon release,
glucagon's action on the liver, islet-cell signalling rather than a single linear switch).
The game asserts nothing beyond that editorial summary. Source [1] above independently
supports the same qualitative claims.

## Deliberately excluded

- Numeric values of any kind, including glucose concentrations and hormone half-lives.
- Drug names, doses, efficacy statistics, treatment guidance, or brand comparisons.
- Any claim that a colour, envelope or cartoon arrow encodes chemistry or timing.

## Safety flags

Tier 3 critique items carry `needs_review: true`, a `review_note` and `data.gap` naming
what evidence would be needed. `review_mode: "flagged"` shows a visible
"Pending clinical review" banner while any item is unreviewed. Validator, Python fixture
tests and node evaluator tests assert all of it.

## Keyboard-only run

See `docs/islet-dispatch-keyboard-walkthrough.md`.
