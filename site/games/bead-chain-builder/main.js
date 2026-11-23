/**
 * Entry module for the Bead Chain Builder, mounted by scripts/build.py into lesson 1 (plumbing: ../ui/mount.js).
 *
 * Keyboard-only run (see docs/bead-chain-builder-keyboard-walkthrough.md): Tab to a bead, Enter or
 * Space picks it up, Tab/arrow keys to a slot, Enter or Space places it; focus advances itself.
 * Pointer drag-and-drop is an optional extra, never required.
 */
import { mountGame } from '../ui/mount.js';
import { BeadRunner } from './BeadRunner.js';
import { validateItems } from './evaluator.js';

mountGame({ slug: 'bead-chain-builder', name: 'Bead Chain Builder', css: 'bead-chain-builder/bead.css', runner: BeadRunner, validateItems });
