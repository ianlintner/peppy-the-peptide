# Claim Detective — source audit

Game: `claim-detective` (Lesson 4, `hormone-and-medicine`). Content:
`content/games/claim-detective.json`. Audited 2026-11-22. `source_ids` are the 1-based
positions in Lesson 4's three-source shelf. All 15 posts are **fictional** and every item is
`needs_review: true`; the build publishes the game only as a flagged preview.

## Source [1] — NIDDK, *Story of discovery: how different medications for diabetes and obesity emerged from basic research on one pancreatic hormone*

URL: https://www.niddk.nih.gov/news/archive/2021/story-discovery-medications-diabetes-obesity-emerged-research-pancreatic-hormone
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/peppy-audit/niddk.html`
(HTTP 200 on 2026-11-22).

Fetched quote (verbatim):

> "experiments demonstrated that GLP-1 is produced not in the pancreas but by intestinal cells close to the stomach—and only when stimulated by the presence of food—helping establish that it is, in fact, an incretin"

Maps to: `t1-cited-source`, `t3-partly-right-origin` (supported half: "comes from gut cells
after a meal"). No duration is claimed here.

Fetched quote (verbatim):

> "They went on to show that both proteins work by stimulating the same cellular receptor, and that exendin-4 is a potent incretin. Importantly, a small but significant difference between the GLP-1 and exendin-4 structures protects the latter from digestion in the blood, where GLP-1 disappears within a few minutes, yet exendin-4 persists for about 12 hours."

Maps to: `t1-same-receptor`, `t2-receptor-equivalence`, `t3-partly-right-receptor`. The
supported half is receptor sharing; the unsupported half is molecular identity. **The 12-hour
figure and all other numeric detail are deliberately excluded from player-facing text.**

## Source [2] — FDA, *FDA's Concerns with Unapproved GLP-1 Drugs Used for Weight Loss*

URL: https://www.fda.gov/drugs/drug-alerts-and-statements/fdas-concerns-unapproved-glp-1-drugs-used-weight-loss
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/peppy-audit/fda-unapproved.html`
(HTTP 200 on 2026-11-22).

Fetched quote (verbatim):

> "unapproved versions do not undergo FDA's review for safety, effectiveness and quality before they are marketed."

Maps to: `t2-compounding-reassurance`, `t3-boss-glucose-regulatory`. No product names are
repeated in player-facing text; the safety linter rejects drug/brand names automatically.

## Source [3] — FDA, *Compounding and the FDA: Questions and Answers*

URL: https://www.fda.gov/drugs/human-drug-compounding/compounding-and-fda-questions-and-answers
Fetched copy: `~/.hermes/profiles/coder-claude/cache/scratch/peppy-audit/fda-compounding.html`
(HTTP 200 on 2026-11-22).

Fetched quote (verbatim):

> "Compounded drugs are not FDA-approved. This means that FDA does not verify the safety, effectiveness or quality of compounded drugs before they are marketed."

Maps to: `t1-out-of-scope`, `t2-compounding-reassurance`, `t3-partly-right-regulatory`,
`t3-boss-receptor-status`, `t3-boss-out-of-scope`.

Fetched quote (verbatim):

> "Practitioners in hospitals, clinics, and other health care facilities sometimes provide compounded drugs to patients when an FDA-approved drug is not medically appropriate to treat them. In these situations, compounding can serve an important patient need."

Maps to: the supported half of `t3-partly-right-regulatory`. The unsupported half ("every
compounded version must be approved") directly contradicts the first quote above.

## Claims deliberately excluded

- Doses, concentrations, efficacy statistics, adverse-event rankings and product comparisons.
- Treatment guidance or product recommendations. `out-of-scope` items point back to a clinician.
- Any suggestion that receptor sharing settles molecular identity, exposure or review status.
- Numeric half-lives, enzyme numbers and the 12-hour persistence figure from Source [1].

## Safety flags

Every item carries `needs_review: true`, a `review_note`, tier, misconception tag and
`source_ids`. `review_mode: "flagged"` publishes the items behind a visible preview banner.
`scripts/games_data.py` rejects any item that drops its flag, and the browser runner renders
the banner whenever all published items are flagged. Tier 3 split items score only the
unsupported half; Boss items are optional and skippable.

## Keyboard-only run

See `docs/claim-detective-keyboard-walkthrough.md` and
`tests/keyboard-walkthrough-claim-detective.cjs`.
