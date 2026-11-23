# Peppy games — interactive learning layer (plan)

Repo: ianlintner/peppy-the-peptide (main includes the MVP course, PR #1). Static site; Python build (`scripts/build.py`), `scripts/check.py`, CI = build + check + `git diff --exit-code -- site/`.

## Goal
Add small, accessible, source-bound learning games to the four lessons, featuring a vector-SVG Peppy, with Curious / College / Mechanism tiers and learner-chosen "challenge up". Each game targets ONE named misconception already present in the lessons (metaphor-limit notes, check questions).

## Decisions (defaults chosen; no open owner questions)
- Tech: NO game engine (no Phaser/Pixi/canvas). DOM + SVG + native ES modules, NO bundler/npm runtime deps. Vendor Preact + htm + hooks (standalone ESM; Preact is MIT, htm is Apache-2.0, license files kept) under `site/vendor/`. Pure logic (tier engine, scoring, scheduling) in framework-free modules tested with `node --test` (node 22+ in CI via actions/setup-node).
- Peppy: hand-built layered SVG (seven spheres, wink eye, coat, gloves, shoes as groups) with expression states idle/wink/thinking/oops/cheer/point driven by CSS + data attributes; `prefers-reduced-motion` respected. Derived from the reserved mascot: keep under the art-excluded-from-MIT notice; record hand-built provenance in ART-PROVENANCE.md and rights.html. Ian decides final licensing wording.
- Data: `content/games/<slug>.json` per game (items with `tier` 1|2|3, `misconception`, `source_ids`, per-distractor `feedback`, `hint_ladder`). `check.py` fails any item lacking tier/misconception/source or whose source id isn't in the lesson's sources.
- Levels: tiers 1/2/3 = Curious/College/Mechanism. Nothing is locked. Mastery tracked per CONCEPT (not per game). Adaptive: 3 consecutive correct -> offer step up; 2 misses -> offer easier or a worked example. High-confidence-wrong triggers a worked example before a harder item. Optional skippable Tier-3 "Boss" items mix lessons.
- Learning mechanics: predict-then-reveal, confidence tag (sure/unsure) before reveal, misconception-specific feedback, hint ladder, contrasting cases, spaced review. No timers, leaderboards, points/badges.
- Privacy: progress in localStorage only; no login, no network calls, no analytics.
- A11y: full keyboard play (click/keypress select-then-place is the base; pointer drag is progressive enhancement), no color-only meaning, ARIA live feedback, text alternatives, reduced motion, "show answer" never blocked.
- Safety: no dosing, efficacy numbers, brand/product comparisons, procurement or treatment advice. Lesson 4 games use generic cards only. Any item beyond a lesson's existing sourced claims needs a primary source and a clinical-claims review flag (`needs_review: true`) before public release.

## Games (priority order)
1. Three-Axis Sorter (L4): receptor target / molecular identity / regulatory status are independent.
2. Two Dials (L3): clearance/lifetime vs glucose-dependence; predict-observe-explain.
3. Bead Chain Builder (L1): composition != sequence; cartoon vs chemistry toggle (real one-letter-code, N->C).
4. Games hub + Daily Review (spaced Leitner retrieval across lessons).
5. Islet Dispatch (L2) + Relay Race (L3).
6. Claim Detective (L4 capstone, prebunking).

## What shipped (status at card 10)
All six games, the hub and Daily Review are built and public in `site/` (deployment still manual). Differences from the plan above:
- Reviewed-only publishing became two modes: `review_mode: "strict"` (default; flagged items dropped) and `"flagged"` (flagged items ship behind a visible "Pending clinical review" notice with a required `review_note`). Five games use `"flagged"`; Bead Chain Builder stays on the strict default and has no flagged items. 39 items (the six Tier-3 critique items in each of four games — Islet Dispatch, Relay Race, Two Dials, Three-Axis Sorter — and all 15 Claim Detective posts) remain in preview until a qualified clinical reviewer signs off [docs/game-content-review.md](docs/game-content-review.md).
- Claim Detective is preview-only by validator rule: every post is fictional and flagged, and the page shows a preview banner.
- Peppy SVG shipped as `site/games/ui/peppy-svg.js` (seven spheres, six states, <12 KB, no network refs; `check.py` enforces).
- Fonts are self-hosted (`site/fonts/`, SIL OFL texts kept), so no page makes a third-party request.
- Entry plumbing is shared in `site/games/ui/mount.js`; each game's `main.js` is one call.
- Real-browser QA (axe-core, keyboard, reduced motion, storage blocked, network) is a local script, recorded in [docs/games-qa.md](docs/games-qa.md).

Later (not on board): Molecule Explorer (3Dmol.js + verified PDB IDs, self-hosted), Cartoon vs Chemistry standalone, audio, custom domain, auto-deploy, browser QA in CI (needs a pinned Playwright/axe toolchain), lifting items out of preview after clinical sign-off.

## Release rule
Each card = one PR. Deployment stays manual (`scripts/deploy.sh production` from clean origin/main) and is NOT part of these cards.
