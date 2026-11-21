#!/usr/bin/env node
/**
 * scripts/build-peppy-svg.mjs — regenerate site/assets/peppy.svg from peppy-svg.js geometry module.
 * Runs with Node 18+ (dynamic import + fs). No external deps.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load the stylesheet that the standalone SVG embeds, so it ships self-contained.
const cssFile = resolve(ROOT, 'site/games/ui/peppy.css');
const css = readFileSync(cssFile, 'utf8');

// Import geometry module (ESM)
const svgMod = await import(resolve(ROOT, 'site/games/ui/peppy-svg.js'));

// Generate the idle-state SVG with the embedded stylesheet
const markup = svgMod.renderPeppySvg({ state: 'idle', css });

const outPath = resolve(ROOT, 'site/assets/peppy.svg');
writeFileSync(outPath, markup);
console.log(`Wrote ${outPath}  (${String(markup.length).padStart(6)} B)`);
