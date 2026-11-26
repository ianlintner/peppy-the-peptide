/**
 * Keyboard-only walkthrough of the Three-Axis Sorter, one item per tier.
 * Usage: node tests/keyboard-walkthrough.cjs [base-url]
 * Default base url: http://127.0.0.1:8765 — serve the built site with:
 *   python3 -m http.server 8765 --bind 127.0.0.1 --directory site
 * Playwright comes from a local install (PLAYWRIGHT_MODULE); no repo dependency is added.
 */
// Set PLAYWRIGHT_MODULE=/path/to/playwright (and optionally CHROMIUM_PATH) when it is not resolvable.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const URL = `${BASE}/lessons/hormone-and-medicine.html#game-three-axis-sorter`;
// Correct shelf ids are read from the shipped item data, matched by the card text on screen:
// the deterministic selector may show any item from the chosen tier.
const TIERS = ['Curious', 'College', 'Mechanism'];
const ITEM_URL = `${BASE}/games/data/three-axis-sorter.json`;

const active = (page, fn) => page.evaluate(fn);

async function tabUntil(page, predicate, max = 60) {
  const trail = [];
  for (let i = 0; i < max; i++) {
    const here = await active(page, () => {
      const a = document.activeElement;
      return {
        tag: a?.tagName || '',
        text: (a?.textContent || '').trim().slice(0, 80),
        value: a?.getAttribute('value'),
        inConfidence: !!a?.closest('.pg-confidence'),
        inTiers: !!a?.closest('.pg-tiers'),
        inShelves: !!a?.closest('.sorter-shelves'),
        labelText: (a?.parentElement?.textContent || '').trim().slice(0, 80),
        cls: a?.className || '',
      };
    });
    trail.push(`${here.tag}[${here.inConfidence ? 'conf' : here.inShelves ? 'shelf' : ''}]:${here.value || here.text}`.slice(0, 70));
    if (predicate(here)) return { here, trail };
    await page.keyboard.press('Tab');
  }
  throw new Error(`keyboard target not found; trail=${trail.join(' | ')}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/sbin/chromium', headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Failed requests are reported by URL (a bare console 404 does not name the resource);
  // the browser's automatic /favicon.ico probe is ignored.
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#game-three-axis-sorter .pg-shell').waitFor({ timeout: 10000 });
  const items = await (await fetch(ITEM_URL)).json();
  const expectedByCard = new Map(items.items.map((i) => [i.data.card || i.prompt, i.data.answer]));

  const log = [];
  for (const tier of TIERS) {
    // 1. Focus the tier button by Tab and activate with Enter.
    const { trail: tierTrail } = await tabUntil(page, (h) => h.inTiers && h.tag === 'BUTTON' && h.text === tier);
    await page.keyboard.press('Enter');

    // A previously revealed item leaves a "Next question" button; dismiss by keyboard if present.
    const next = page.locator('#game-three-axis-sorter button:has-text("Next question")');
    if (await next.count()) {
      await next.focus();
      await page.keyboard.press('Enter');
    }

    // Read the card on screen, then look up its shipped correct shelf id.
    const card = (await page.locator('#game-three-axis-sorter .sorter-card p').first().innerText()).trim();
    const want = expectedByCard.get(card);
    if (!want) throw new Error(`no shipped item matches displayed card: ${card}`);

    // 2. Tab into the shelf radio group (one tab stop), then ArrowDown to the wanted shelf and
    //    confirm with Space (no pointer, no .click()). Mirrors the on-screen legend.
    const { trail: shelfTrail } = await tabUntil(page, (h) => h.inShelves && h.tag === 'INPUT');
    for (let i = 0; i < 8; i++) {
      const v = await active(page, () => document.activeElement?.getAttribute('value'));
      if (v === want) break;
      await page.keyboard.press('ArrowDown');
    }
    if ((await active(page, () => document.activeElement?.getAttribute('value'))) !== want) {
      throw new Error(`could not reach shelf ${want} with arrow keys`);
    }
    await page.keyboard.press('Space');

    // 3. Tab to the confidence group and choose "Sure" with Space.
    await tabUntil(page, (h) => h.inConfidence && h.tag === 'INPUT' && h.labelText === 'Sure');
    await page.keyboard.press('Space');

    // 4. Tab to Check answer and press Enter.
    const { trail: checkTrail } = await tabUntil(page, (h) => h.tag === 'BUTTON' && h.text === 'Check answer');
    await page.keyboard.press('Enter');
    await page.locator('#game-three-axis-sorter .pg-verdict').waitFor({ timeout: 3000 });

    const result = {
      tier,
      card: card.slice(0, 90),
      selectedShelf: want,
      verdict: (await page.locator('#game-three-axis-sorter .pg-feedback').innerText()).replace(/\s+/g, ' ').trim().slice(0, 220),
      correct: (await page.locator('#game-three-axis-sorter .pg-verdict').innerText()).includes('Correct.'),
      steps: { tabToTier: tierTrail.length, tabToShelf: shelfTrail.length, tabToCheck: checkTrail.length },
    };
    log.push(result);
  }

  console.log(JSON.stringify({ url: URL, errors, steps: log }, null, 2));
  await browser.close();
  if (errors.length || log.length !== TIERS.length || log.some((s) => !s.correct)) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
