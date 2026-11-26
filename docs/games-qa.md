# Games QA record

Real-browser QA of every published game, the games hub and Daily Review, run 2026-11-23 against the
committed `site/` (served by `python -m http.server`) in headless Chromium via Playwright 1.65.1 with
axe-core 4.14.1 (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`). Raw results:
[qa/qa-results.json](qa/qa-results.json); screenshots of each game mount: [qa/screenshots/](qa/screenshots/).

## Result

**PASS** on all 7 pages × 2 viewports (390 px, 1280 px): course map, the four lessons (six games),
games hub, Daily Review.

| Check | Method | Result |
|---|---|---|
| Screen-reader labels / WCAG A–AA | axe-core on the full page after games mount | 0 violations, all 14 page-views |
| Keyboard-only | Tab into each mount; every enabled control reachable by Tab with a visible focus ring; Show answer → `aria-live` feedback → Next question, Enter only | 6/6 games pass at both widths |
| Keyboard walkthroughs | `tests/keyboard-walkthrough.cjs` (Three-Axis Sorter, one item per tier), `-claim-detective.cjs`, `-games-4-5.cjs` (Islet Dispatch, Relay Race) — full solve with keys only | all exit 0 |
| Reduced motion | `prefers-reduced-motion: reduce`; no running animation/transition inside any game | 0 moving elements |
| Storage disabled | `localStorage` getter throws | every game mounts and shows the "not saving progress" notice; Daily Review still runs |
| Console | console errors + uncaught page errors | 0 |
| Network | any request whose origin is not the local server | 0 (fonts are self-hosted; `check.py` also rejects network URLs in shipped CSS/JS) |
| Asset budget | game-folder JS + CSS, excluding vendor | 13.6–27.1 KB per game (< 40 KB). Shared `ui/` + `engine/` add 71 KB, loaded once and shared by all games |

## Defects found and fixed in this pass

- Daily Review and every game left the static "Loading…"/noscript fallback in the DOM after
  Preact rendered (Preact does not clear pre-existing children). Mounts are now cleared first
  (`site/games/review.js`, `site/games/ui/mount.js`).
- axe `color-contrast` (serious): white text on the `.button` red `#db4631` was 4.26:1 (< 4.5); darkened to `#b5321f` (6.1:1).
- axe `label-content-name-mismatch` (serious): Relay Race move buttons' accessible names did not
  contain their visible text ("To tray", "To branch", "To main"); names now start with it.
- Google Fonts `@import` was a third-party runtime request; fonts are now self-hosted with OFL texts.

## Items left in preview

39 items ship as flagged preview behind a "Pending clinical review" notice, awaiting a qualified
clinical reviewer: all 15 Claim Detective posts (preview-only by rule: fictional social posts), and
the six Tier-3 critique/evidence-gap items in each of Islet Dispatch, Relay Race, Two Dials and
Three-Axis Sorter. Bead Chain Builder has none. Reason and sources per item:
[game-content-review.md](game-content-review.md).

## Not covered

- Real screen readers (NVDA/VoiceOver) were not run; axe checks names/roles/states, not speech output.
- Browser QA is not in CI (needs Chromium + Playwright + axe locally); CI runs build/check/unit tests.
- Only Chromium was exercised.

## Rerun

```sh
python scripts/build.py
python -m http.server 8765 --bind 127.0.0.1 --directory site &
PLAYWRIGHT_MODULE=/path/to/playwright AXE_PATH=/path/to/axe-core/axe.min.js \
  node tests/qa-browser.cjs http://127.0.0.1:8765 docs/qa
PLAYWRIGHT_MODULE=/path/to/playwright node tests/keyboard-walkthrough.cjs http://127.0.0.1:8765
```
