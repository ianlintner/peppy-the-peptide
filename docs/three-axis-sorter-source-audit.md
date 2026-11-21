# Three-Axis Sorter — content self-audit (Lesson 4)

Live pages fetched **2026-11-21** with `curl -L` (HTTP 200 for all three); quotes below are copied
from the fetched HTML text, not from memory. Source ids are the 1-based positions in
`content/04-hormone-and-medicine.json` → `sources`, shown on the lesson's source shelf and in each
game item's `source_ids`.

No game card contains a brand name, dose, efficacy number, product comparison, procurement detail or
treatment recommendation. The generic validator's dose/brand lint runs over every game file; the
only brand-like names below are *source author names* in this audit document, which is not shipped
to the site.

---

## Source 1 — NIDDK, “Story of discovery: how different medications for diabetes and obesity emerged from basic research on one pancreatic hormone” (Jan 27, 2021)

URL: https://www.niddk.nih.gov/news/archive/2021/story-discovery-medications-diabetes-obesity-emerged-research-pancreatic-hormone

Fetched quote A (same receptor, different proteins):
> “They went on to show that both proteins work by stimulating the same cellular receptor, and that
> exendin-4 is a potent incretin. Importantly, a small but significant difference between the GLP-1
> and exendin-4 structures protects the latter from digestion in the blood, where GLP-1 disappears
> within a few minutes, yet exendin-4 persists for about 12 hours.”

Fetched quote B (body-made hormone, where it comes from, when it is released):
> “Experiments also demonstrated that GLP-1 is produced not in the pancreas but by intestinal cells
> close to the stomach—and only when stimulated by the presence of food—helping establish that it
> is, in fact, an incretin.”

Fetched quote C (brief lifetime of the native signal):
> “Unfortunately, scientists soon discovered a problem with the idea: GLP-1 only lasts a few minutes
> in the blood stream before it is degraded by other proteins.”

Fetched quote D (manufactured ligand class):
> “Together, these medications constitute a distinct and entirely new class of medications for type 2
> diabetes called ‘GLP-1 receptor agonists.’”

### Claims used in the game, mapped to quote

| Game claim (paraphrase used in generic cards) | Source | Quote |
|---|---|---|
| The body's own signal is made by intestinal cells, not the pancreas; it appears when food is present. | 1 | B |
| The body's own signal is short-lived in the blood. | 1 | C |
| A manufactured receptor agonist can act at the same receptor as the body's signal while being a different molecule. | 1 | A |
| “Receptor agonist” names a class of manufactured medicines, not the native hormone. | 1 | D |
| A structural difference — not receptor sharing — explains why two molecules persist differently. | 1 | A |
| Knowing only that two ligands act at the same receptor does not tell you their structures or persistence. | 1 | A (the quote supplies both facts separately; the inference is the lesson's check answer, not a biological claim) |

**Not claimed:** equal effects, comparative potency in people, clinical outcomes, any treatment use.
Quote A's wording that exendin-4 is “more potent” is an animal/cell finding in the article; the game
does not carry it into any card.

---

## Source 2 — FDA, “FDA's Concerns with Unapproved GLP-1 Drugs Used for Weight Loss”

URL: https://www.fda.gov/drugs/drug-alerts-and-statements/fdas-concerns-unapproved-glp-1-drugs-used-weight-loss

Fetched quote E (unapproved versions and premarket review):
> “This can be risky for patients, as unapproved versions do not undergo FDA's review for safety,
> effectiveness and quality before they are marketed.”

Fetched quote F (compounded products and premarket review):
> “However, compounded drugs are not FDA approved. This means the agency does not review compounded
> drugs for safety, effectiveness or quality before they are marketed.”

Fetched quote G (a claim about sameness is itself a warning sign):
> “makes claims such as the compounded drug is the same as an FDA-approved drug”

### Claims used in the game

| Game claim | Source | Quote |
|---|---|---|
| “Unapproved” is a regulatory status, not a statement about receptor target or molecular identity. | 2 | E |
| A product can be described as acting at the GLP-1 receptor and still lack FDA premarket review. | 2 | E (the page describes unapproved versions of receptor-agonist drugs; receptor axis from source 1) |
| Saying two products are “the same” is a separate claim that requires evidence; FDA lists such claims as a red flag. | 2 | G |
| Marketed ≠ reviewed: unapproved versions are marketed without FDA premarket review. | 2 | E |

**Not claimed:** that any named product is safe or unsafe; that a specific compounded product matches
or differs chemically; any buying, prescribing or dosing guidance.

---

## Source 3 — FDA, “Compounding and the FDA: Questions and Answers”

URL: https://www.fda.gov/drugs/human-drug-compounding/compounding-and-fda-questions-and-answers

Fetched quote H (compounded drugs are not approved):
> “Compounded drugs are not FDA-approved. This means that FDA does not verify the safety,
> effectiveness or quality of compounded drugs before they are marketed.”

Fetched quote I (generic vs compounded are different regulatory paths):
> “No. A generic drug is approved by FDA under 505(j) of the FD&C Act and meets all of the
> requirements of that section (including establishing therapeutic equivalence to a brand name drug,
> among others), while a compounded drug is not approved by FDA.”

### Claims used in the game

| Game claim | Source | Quote |
|---|---|---|
| Being “compounded” does not by itself mean FDA-approved. | 3 | H |
| Approval is tied to a specific product and review path, not to how similar two boxes look. | 3 | I |
| A described use for a product cannot be assumed to be a reviewed/approved use without checking the product's status. | 3 | H + I |

**Not claimed:** that compounding is inherently unsafe or forbidden; any individual patient scenario;
that an approved product and a compounded product are interchangeable.

---

## Tier-3 evidence-gap rule (the “cannot determine” axis)

Tier 3 items never ask for a factual judgment the three sources cannot support. Each such item's
correct choice is “the stated evidence cannot settle this axis”, and the learner must pick what
additional evidence would be needed (for example: an explicit statement of the product's review
status, or an explicit molecular-identity comparison). The *need for that evidence* follows from
source 1 quote A (receptor sharing is one observation; structure is another) and source 3 quote H
(approval is a separate, product-level verification). Tier 3 items carry `needs_review: true` per the
card and are published behind a visible “Pending clinical review” banner by the game's
`review_mode: "flagged"` opt-in; see `content/games/SCHEMA.md`.

---

## Re-verification log (2026-11-21, second pass)

All three pages were re-fetched live (HTTP 200) and every quoted fragment above was matched
programmatically against the page text (tags stripped, whitespace collapsed). Note the FDA page uses
a typographic apostrophe (`FDA’s`), so a straight-apostrophe search misses quote E until normalised;
the wording is otherwise identical.

Keyboard-only run (`node tests/keyboard-walkthrough.cjs`, Chromium headless, Tab/Arrow/Space/Enter only;
no pointer events): one item per tier answered correctly, zero page errors, zero failed requests.
Tier buttons are scoped to the game's own `.pg-tiers` group because the lesson's depth buttons
carry the same labels.
