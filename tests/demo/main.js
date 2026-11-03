// Mounts the shared shell on content/games/_example.json to prove the runner contract.
import { h, render } from '../../site/vendor/preact/preact.mjs';
import htm from '../../site/vendor/htm/htm.mjs';
import { GameShell } from '../../site/games/ui/GameShell.js';
import { browserStore } from '../../site/games/ui/store.js';
const html = htm.bind(h);
const game = await (await fetch('../../content/games/_example.json')).json();
const sources = [{ title: 'NHGRI Talking Glossary: Peptide', url: 'https://www.genome.gov/genetics-glossary/Peptide' }];
render(html`<${GameShell} title=${game.title} summary=${game.summary} items=${game.items} sources=${sources} store=${browserStore()} />`, document.getElementById('game-demo'));
