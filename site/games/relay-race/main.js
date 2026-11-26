/** Entry module for Relay Race, mounted by scripts/build.py into lesson 3 (plumbing: ../ui/mount.js). */
import { mountGame } from '../ui/mount.js';
import { RelayRaceRunner } from './RelayRaceRunner.js';
import { validateItems } from './evaluator.js';

mountGame({ slug: 'relay-race', name: 'Relay Race', css: 'relay-race/relay.css', runner: RelayRaceRunner, validateItems });
