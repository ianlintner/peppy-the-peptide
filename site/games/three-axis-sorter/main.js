/** Entry module for the Three-Axis Sorter, mounted by scripts/build.py into lesson 4 (plumbing: ../ui/mount.js). */
import { mountGame } from '../ui/mount.js';
import { SorterRunner } from './SorterRunner.js';
import { validateItems } from './evaluator.js';

mountGame({ slug: 'three-axis-sorter', name: 'Three-Axis Sorter', css: 'three-axis-sorter/sorter.css', runner: SorterRunner, validateItems });
