# Keyboard-only walkthrough — Islet Dispatch (L2) and Relay Race (L3)

Run against the built site (no dev server in CI):

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory site
PLAYWRIGHT_MODULE=/path/to/playwright.js node tests/keyboard-walkthrough-games-4-5.cjs
```

The script drives headless Chromium with keyboard events only: `Tab` to reach each
control, `Space`/`Enter` to activate it. No mouse clicks or scripted DOM mutations.

## Islet Dispatch — `lessons/signal-cast.html#game-islet-dispatch`

1. `Tab` to a tier button (Curious / College / Mechanism) and press `Enter`. The
   `aria-live` progress line announces the new tier.
2. `Tab` to a dispatch plan radio; use arrow keys to move between plans, then
   `Space` to choose one. The selected plan gets a thicker border and a
   "Plan A/B/…" label — not a colour-only indicator.
3. `Tab` to Sure or Unsure and press `Space`. Check answer enables only after
   both a plan and a confidence choice exist (`aria-disabled="false"`).
4. `Tab` to Check answer and press `Enter`. Feedback appears in the shared
   `role="status"` / `aria-live="polite"` panel with a text verdict.
5. Optional: `Tab` to Hint, Show answer, or Show source. Source links open in a
   new tab with `rel="noopener"`.

Verified on 2026-11-22 with headless Chromium: Tier 1 plan selection → Unsure →
Check answer produced `Correct. Alpha cells release glucagon; beta cells release insulin. [1]`
with zero page errors and zero failed requests.

## Relay Race — `lessons/endogenous-glp1.html#game-relay-race`

1. `Tab` to a tier button and press `Enter`.
2. The board has three lists: main relay, separate degradation branch, card tray.
   `Tab` to a card's `↑ Earlier` / `↓ Later` / `To branch` / `To tray` button and
   press `Space`; `To main` returns a branch or tray card to the relay. Disabled
   buttons carry `disabled` and are skipped by Tab. Every board item now starts
   unsolved, so there is always a meaningful move before Check answer is enabled.
3. Tier 3 critique items instead show the sourced relay as context and ask the
   learner to choose a careful reply with the arrow keys and `Space`; the authored
   choices and their misconception feedback are now actually exercised.
   Choice display order in both games is seeded by item id, so the sourced
   correct answer is not always the first ("Plan A") option.
4. Lane and position are written into each card (`1`, `2`, `…` on the main lane,
   `B` on the branch) and into each list's accessible name, so no meaning rests
   on the branch's border style alone.
5. Choose Sure or Unsure with `Space`, then `Tab` to Check answer and press
   `Enter`. A wrong layout gets a specific text explanation in the live region
   (wrong order, branch in main, main in branch, or unsupported card).

Verified on 2026-11-22 with headless Chromium: the walkthrough now reads the
published item data, drives `Tab`/`Space`/`Enter` to reach a sourced correct solve
for both games, and asserts `Correct.` in the live region with zero page errors
and zero failed requests.

## General accessibility notes

- No timers anywhere; no action becomes unavailable due to elapsed time.
- All feedback is text and announced politely; Peppy's speech bubble is
  `aria-hidden` because the same information is in the live region.
- `prefers-reduced-motion` disables transitions in both game stylesheets.
- The shared shell provides keyboard tier switching, hint ladder, confidence
  radios, source toggle, and a focus-managed completion screen.
