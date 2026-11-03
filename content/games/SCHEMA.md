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
| `choices` | array | at least 2; each `{id, text, correct, feedback?}`; `id` slug unique in the item; `text` non-empty; `correct` boolean; **exactly one** `correct: true` |
| `choices[].feedback` | string | **required and non-blank on every distractor** (`correct: false`): says why this particular wrong answer is tempting and what it misses |
| `explanation` | string | non-empty; shown after answering |
| `hint_ladder` | array of strings | non-blank strings, ordered gentle to strong; **at least 2 for tier 1 and 2**; may be empty or absent at tier 3 |
| `source_ids` | array of integers | non-empty, unique, each in `1..N` where N = number of `sources` in the item's lesson (1-based position in that lesson's `sources` list, matching the numbered source shelf) |
| `needs_review` | boolean | **required**. `true` holds the item out of the public build (clinical-claims review pending). A game is public only if at least one item is `false` |
| `worked_example` | string | optional; if present, non-blank |
| `data` | object | optional; game-specific payload (e.g. cards to sort). The generic validator checks only that it is an object; the owning game card adds its own validation |

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

## Changing the schema

Edit this file, `scripts/games_data.py` and `tests/test_games_data.py` together; add a failing-fixture test for any new rule.
