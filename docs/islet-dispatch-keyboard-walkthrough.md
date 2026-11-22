# Keyboard-only walkthrough — Islet Dispatch

See `docs/relay-race-keyboard-walkthrough.md` for the combined run instructions and the
Relay Race notes. Both games are exercised by
`tests/keyboard-walkthrough-games-4-5.cjs` against the built site; that script uses only
`Tab`, `Space`, and `Enter`, and asserts that the shared `aria-live` feedback region
updates with no page errors or failed requests.

Islet Dispatch result (2026-11-22, headless Chromium): Tier 1 plan radio selected with
`Space`, Unsure selected with `Space`, Check answer activated with `Enter` →
`Correct. Alpha cells release glucagon; beta cells release insulin. [1]`, errors: none.
