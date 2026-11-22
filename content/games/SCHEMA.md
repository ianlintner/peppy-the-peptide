# Game item schema

One file per game: `content/games/<game>.json`. Validated by `scripts/games_data.py` (run through `scripts/check.py` and `python -m unittest discover -s tests`). Every rule below is enforced there; every rule there is listed here.

Files whose name starts with `_` are **test fixtures**: validated like any other file, never built into `site/`. `_example.json` is the shared fixture for the validator and engine tests.

## Game file

| Field | Type | Rule |
|---|---|---|
| `game` | string | lowercase-hyphen slug; must equal the file name without extension (a leading `_` on the file is ignored for this check) |
| `lesson` | string | slug of an existing lesson in `content/*.json`; the game is mounted in that lesson page |
| `title` | string | non-empty; shown in the lesson mount and the hub |
| `summary` | string | non-empty; one sentence naming the misconception practiced |
| `items` | array | non-empty; item ids unique within the game |

## Item

| Field | Type | Rule |
|---|---|---|
| `id` | string | lowercase-hyphen slug, unique in the game |
| `concept` | string | lowercase-hyphen slug; mastery is tracked per concept, shared across games |
| `tier` | integer | **required**, 1, 2 or 3 = Curious / College / Mechanism (booleans, floats and strings rejected) |
| `misconception` | string | **required**, non-blank: the named misconception this item targets |
| `prompt` | string | non-empty |
| `choices` | array | at least 2; each `{id, text, correct, feedback?}`; `id` slug unique in the item; `text` non-empty; `correct` boolean; **exactly one** `correct: true`. Authoring order is not display order: runners render choices in a deterministic seeded order keyed by item id and assign display letters after shuffling, so the correct choice is not always first. Scoring is always by id. |
| `choices[].feedback` | string | **required and non-blank on every distractor** (`correct: false`): says why this particular wrong answer is tempting and what it misses |
| `explanation` | string | non-empty; shown after answering |
| `hint_ladder` | array of strings | non-blank strings, ordered gentle to strong; **at least 2 for tier 1 and 2**; may be empty or absent at tier 3 |
| `source_ids` | array of integers | non-empty, unique, each in `1..N` where N = number of `sources` in the item's lesson (1-based position in that lesson's `sources` list, matching the numbered source shelf) |
| `needs_review` | boolean | **required**. `true` holds the item out of the public build (clinical-claims review pending). A game is public only if at least one item is `false`; a game with `review_mode: "flagged"` is the explicit exception below. |
| `worked_example` | string | optional; if present, non-blank |
| `data` | object | optional; game-specific payload (e.g. cards to sort). The generic validator checks only that it is an object; the owning game card adds its own validation |

## Flagged review mode (Tier 3 opt-in)

`review_mode` is an optional game-level string. Default (`"strict"`) keeps the rule above unchanged:
`needs_review: true` items never leave the build. `"flagged"` lets such items through **only** when
every flagged item also has a non-empty `review_note` string; the build adds `review_mode` to the
published data so the game can show a visible “Pending clinical review” banner next to those items.
This exists for the Three-Axis Sorter, whose card requires all Tier 3 items to be flagged while
still letting the learner practise them. `check.py` enforces the banner contract. Games that omit
`review_mode` are unaffected.

| Field | Type | Rule |
|---|---|---|
| `review_mode` | string | optional; `"strict"` (default) or `"flagged"` only |
| `review_note` | string | required and non-blank on every `needs_review: true` item when `review_mode: "flagged"`; forbidden otherwise (stripped from nothing, so keep it out) |

## Game-specific `data`: `bead-chain-builder`

`scripts/games_data.py` (`_validate_bead_item`) validates `data` for the game `bead-chain-builder`; the browser re-checks the same rules in `site/games/bead-chain-builder/evaluator.js` (`validateItems`). The correct choice must always agree with what the data implies; a disagreement fails the build.

| `data.mode` | Required `data` | Choice ids | Correct choice |
|---|---|---|---|
| `build` | `target` | `matches`, `differs` (the learner builds in slots; the choices only satisfy the generic schema) | `matches` |
| `spot` | `target`, `chains` (`{choice id: residues}`, every choice id present) | any slugs, one per chain | the one chain that is a different ordering of the same beads as `target` (exactly one) |
| `compare` | `target`, `other` | `same-sequence`, `same-beads-new-order`, `different-beads` | the relation of `other` to `target` |
| `sorter` | `statement`, `bucket` (`cartoon`, `real` or `both`); optional `bonus: true`, optional `readout` | `cartoon`, `real`, `both` | `bucket` |
| `inference` | `statement`, `follows` (boolean); optional `target` | `follows`, `does-not-follow` | `follows` if `follows` is true, else `does-not-follow` |

Common: `view` is optional (`cartoon` default, or `chemistry` to start in the one-letter view).

**Real sequences.** `target` (and `readout.sequence`) is a one-letter string of the 20 standard residues: 3 to 7 residues for `target` (Peppy has seven spheres), up to 30 for `readout`. The block also carries `accession`, `residues` (`"start-end"`, whose length must equal the string) and `source_label`. The validator only accepts a string that is an exact slice of a segment in `VERIFIED_SEGMENTS` (UniProt P01275 and P01308, fetched 2026-11-21); add a segment there only after re-fetching the record. Variant chains in `spot` and `compare` items are practice edits of `target` and are not claimed to be real sequences.

## Safety lint

All text in a game file (except `id`, `game`, `lesson`, `concept`) is scanned. A match fails validation:

- dose-like quantities: a number followed by `mg`, `mcg`, `µg`/`μg`/`ug`, `iu`, `ml`, `unit(s)`;
- drug/brand names: a fixed list of GLP-1 brand and generic names in `scripts/games_data.py` (`BRANDS`).

The lint is deliberately blunt. Rewrite the text, or, if a legitimate case exists, narrow the pattern in `games_data.py` in a reviewed change. Content stays educational: no dosing, efficacy numbers, product comparisons or treatment guidance.

## Minimal item

```json
{
  "id": "same-beads-new-order",
  "concept": "sequence-vs-composition",
  "tier": 1,
  "misconception": "Same ingredients means the same chain",
  "prompt": "…",
  "choices": [
    {"id": "same", "text": "…", "correct": false, "feedback": "…"},
    {"id": "different", "text": "…", "correct": true}
  ],
  "explanation": "…",
  "hint_ladder": ["…", "…"],
  "source_ids": [1],
  "needs_review": false
}
```

## Game-specific `data` contracts

### `islet-dispatch` (Lesson 2)

Each item's `data` must carry:

- `state`: `"low"` or `"elevated"` — the qualitative glucose state on the scenario card;
- `cue`: short text naming the scenario cue (no numbers);
- `options`: an object mapping each choice id to `{cell, signal, target}` (all non-empty);
- `answer`: the choice id matching the sourced triple for the state — `low` →
  `Alpha cell / glucagon / liver`, `elevated` → `Beta cell / insulin / many cell types`.

`choices` must contain exactly one option per `data.options` key, with the single correct
choice equal to `data.answer`. DPP-4, concentrations and timing are out of scope. Optional
`contrast` names the other state for paired scenario cards.

### `relay-race` (Lesson 3)

Each item's `data` must carry:

- `steps`: object mapping step ids to `{label, lane}`, where `lane` is `main`, `branch` or
  `distractor`;
- `main_order`: ordered array of main-lane step ids (the sourced relay sequence);
- `branch_ids`: array of step ids on the separate degradation branch (empty is allowed for
  repair items whose branch card starts in the distractor tray);
- `answer`: always `"main-branch"`, the only permitted correct choice id;
- `main_answer` / `branch_answer`: the canonical sourced sequence and degradation branch.
  These stay constant even when `main_order` / `branch_ids` describe a scrambled starting board
  for a repair item.

`main_order` and `branch_ids` must be disjoint, each step's `lane` must match its arrays,
and every step needs a text label. They describe the **starting board**: every non-critique
item must start unsolved (`startsSolved(item)` is false in the browser evaluator), so the
learner always has a move to make before Check answer becomes available. Canonical scoring
stays in `main_answer` / `branch_answer`. Tier 3 items whose prompt is a critique set
`data.mode: "critique"`; the runner then asks the learner to choose the careful
reply from that item's own `choices` (so the choices and their misconception
feedback are actually tested) and shows the canonical board only as context.
Critique mode requires a non-empty `gap` and exactly one authored correct reply;
its reply texts must be item-specific and distinct across items. The board-rule
`main-branch` correct id applies only to non-critique items. Optional `gap`
(non-empty when present) records what extra evidence would be needed for a Tier 3 critique.
`distractor` step is a plausible but unsupported card the learner must keep off the main
lane. Optional `cue` names the item's board scenario.

### `claim-detective` (Lesson 4, preview-only capstone)

Every item is a **fictional** social-style post (no real people, brands, dosing or efficacy
numbers). The learner highlights the exact claim as a half-open word span, classifies it, and
names the persuasion technique. Each item's `data` must carry:

- `post`: the fictional post text, at most 60 whitespace-separated words so keyboard
  word-level highlighting stays addressable;
- `spans`: at least one `{id, start, end, role}` with a slug `id` and
  `0 <= start < end <= word count`; ids must be unique. `mode: "split"` posts need exactly
  two spans, one `role: "supported"` and one `role: "unsupported"`, because Tier 3 posts
  are partly right and only the unsupported half is the claim to flag;
- `answer_span`: the `id` of the span that must be highlighted;
- `mode`: `single`, `split` or `boss`. `boss` items are optional, skippable Tier 3 extras
  (`boss: true`) that mix the three-axis and regulatory-status ideas;
- `answer`: one of `supported`, `hypothesis`, `out-of-scope` — the id of the single correct
  choice;
- `technique`: one of `false-equivalence`, `appeal-to-receptor-sameness`,
  `unreviewed-product-reassurance`, `origin-over-evidence`.

`review_mode` must be `"flagged"` and **every** item must have `needs_review: true` plus a
non-empty `review_note`. The validator rejects a false `needs_review` outright, so clearing
one item silently cannot remove the visible preview banner. The browser runner also renders
the banner whenever all published items are flagged; the build's flagged-mode contract
keeps the banner text machine-checkable. Highlight scoring is exact: a wrong span, class or
technique is reported separately by the pure `evaluator.js`.

## Changing the schema

Edit this file, `scripts/games_data.py` and `tests/test_games_data.py` together; add a failing-fixture test for any new rule.
