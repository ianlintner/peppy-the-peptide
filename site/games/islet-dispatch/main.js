/** Entry module for Islet Dispatch, mounted by scripts/build.py into lesson 2 (plumbing: ../ui/mount.js). */
import { mountGame } from '../ui/mount.js';
import { IsletDispatchRunner } from './IsletDispatchRunner.js';
import { validateItems } from './evaluator.js';

mountGame({ slug: 'islet-dispatch', name: 'Islet Dispatch', css: 'islet-dispatch/dispatch.css', runner: IsletDispatchRunner, validateItems });
