# Bead Chain Builder — keyboard-only walkthrough

The Bead Chain Builder (Lesson 1, `site/lessons/foundations.html#game-bead-chain-builder`) is fully playable without a pointer. Pointer drag-and-drop is an optional extra; nothing requires it, and nothing is timed.

## Build items (Tier 1)

1. Tab to the **Cartoon view / Chemistry view** buttons to change the view (Enter or Space toggles; the change is announced in a polite live region).
2. Tab to the **Bead pool** buttons. Arrow keys move between beads in a row.
3. **Enter or Space** picks up a bead (`aria-pressed`, label says "picked up"). Focus jumps to the first empty slot.
4. **Enter or Space** on a slot places the bead. Focus moves to the next unplaced bead. Pressing a filled slot with nothing picked up returns its bead to the pool.
5. When every slot is filled, choose **Sure** or **Unsure**, then **Check answer**. Feedback lands in the shell's `aria-live` region and takes focus.

Every action is announced as text ("Placed bead H in slot 1 of 7"). Beads always print their letter; after checking, each slot carries a text mark ("correct place" / "not this bead") plus a border style, never colour alone.

## Choice items (Tiers 2 and 3, including the bonus Cartoon vs Chemistry sorter)

Radio groups: Tab to the group, arrow keys to choose, then Sure/Unsure and **Check answer**.

## Run recorded 2026-11-21

Headless Chromium (Playwright), keyboard events only (Enter, Space, focus), built site served from `site/`. The Tier 1 insulin B-chain fragment `FVNQHLC` (UniProt P01308 residues 25-31) was assembled bead by bead. After each pick focus moved to a slot; after each placement focus moved to the next bead. After the seventh bead the live region read "Placed bead C in slot 7 of 7. All slots are filled…"; Sure + Check answer returned "Correct."; no console errors. Tier 2 and 3 items rendered and accepted radio answers without errors.
