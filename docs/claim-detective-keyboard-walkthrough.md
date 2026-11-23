# Claim Detective — keyboard-only walkthrough

Run against a locally served generated site (no runtime network calls apart from the
same-origin game JSON):

```sh
python3 -m http.server 8791 --bind 127.0.0.1 --directory site
PLAYWRIGHT_MODULE=/path/to/playwright/index.js \
  node tests/keyboard-walkthrough-claim-detective.cjs http://127.0.0.1:8791
```

Last run: **pass** — `claim-detective: Correct. | banner="Preview: every fictional post is awaitin" | errors=none`.
Chromium 155 headless, Playwright 1.65.1, 2026-11-22. No page errors and no failed HTTP
responses were observed.

## Path exercised

1. Tab from the lesson into the game mount and confirm the `role="note"` preview banner is
   in the accessibility tree.
2. Tab to **Curious** and press Enter; the adaptive engine presents a Tier 1 item.
3. Tab into the fictional post; every word is a focusable `button` with an
   `aria-label` of the form "Word N of M: …".
4. Move to the first claim word with ArrowRight, press Space to set the anchor, then
   Shift+ArrowRight across the remaining claim words. Press Space on the last word to
   complete the highlight. The selection is announced politely and marked with both a
   background and a literal `[claim]` suffix — not color alone.
5. Tab to the status choice buttons (`role="group"`, `aria-pressed`) and press Enter on
   the sourced classification. Do the same for the persuasion-technique group.
6. Tab to **Unsure** in the confidence fieldset and press Space, then Enter on
   **Check answer**. The aria-live verdict reads `Correct.` for the authored span,
   class and technique.
7. Enter on **Next question**, then on **Show answer**: the answer span is named in text
   (`Highlighted claim: "the biology must be settled."`), so a screen reader gets the
   exact claim without relying on the highlight color.

## Accessibility notes

- No timers, no locks, no rapid animations, and a `prefers-reduced-motion` rule in
  `claims.css`.
- Word selection is half-open at the evaluator boundary: the runner passes
  `focus + 1` so the focus word is included, matching authored `data.spans`.
- Single-word selections become `[w, w+1)`; Home/End jump to the first/last word.
- The post is fictional and every item is flagged; the banner stays until a qualified
  reviewer clears items and the game leaves preview mode.
