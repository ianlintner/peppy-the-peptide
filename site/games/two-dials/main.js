/** Entry module for Two Dials, mounted by scripts/build.py into lesson 3 (plumbing: ../ui/mount.js). */
import { mountGame } from '../ui/mount.js';
import { TwoDialsRunner } from './TwoDialsRunner.js';
import { validateItems } from './evaluator.js';

mountGame({ slug: 'two-dials', name: 'Two Dials', css: 'two-dials/dials.css', runner: TwoDialsRunner, validateItems });
