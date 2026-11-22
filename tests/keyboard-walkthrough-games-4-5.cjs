/**
 * Keyboard-only walkthrough of Islet Dispatch (lesson 2) and Relay Race (lesson 3).
 * Usage: node tests/keyboard-walkthrough-games-4-5.cjs [base-url]
 * Serve first: python3 -m http.server 8765 --bind 127.0.0.1 --directory site
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE
  || '/home/ilintner/.local/share/mise/installs/playwright/1.65.1/node_modules/.mise/playwright@1.65.1/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const GAMES = [
  { page: 'signal-cast', slug: 'islet-dispatch', selector: '.id-choice input' },
  { page: 'endogenous-glp1', slug: 'relay-race', selector: '.rr-move:not([disabled])' },
];

async function tabTo(page, selector, max = 140) {
  for (let i = 0; i < max; i += 1) {
    const here = await page.evaluate((sel) => {
      const a = document.activeElement;
      return { cls: a?.className || '', text: (a?.textContent || '').trim().slice(0, 60), tag: a?.tagName || '',
        matches: !!(a && sel && a.closest(sel)) };
    }, selector);
    if (here.matches) return here;
    await page.keyboard.press('Tab');
  }
  throw new Error(`target ${selector} not reachable with Tab`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/sbin/chromium', headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const results = [];
  for (const { page: lesson, slug, selector } of GAMES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await page.goto(`${BASE}/lessons/${lesson}.html`, { waitUntil: 'domcontentloaded' });
    await page.locator(`#game-${slug} .pg-shell`).waitFor({ timeout: 10000 });
    // Tier 1 via keyboard.
    await tabTo(page, `#game-${slug} .pg-tiers .pg-btn`);
    await page.keyboard.press('Enter');
    await page.locator(`#game-${slug} ${selector}`).first().waitFor({ timeout: 5000 });
    // Pick a plan / move a board card with the keyboard.
    await tabTo(page, `#game-${slug} ${selector}`);
    await page.keyboard.press('Space');
    // Confidence: focus the "Unsure" radio directly and toggle with Space.
    const unsure = page.locator(`#game-${slug} .pg-confidence label`).filter({ hasText: 'Unsure' });
    await unsure.locator('input').focus();
    await page.keyboard.press('Space');
    // Check answer.
    await tabTo(page, `#game-${slug} .pg-primary`);
    await page.keyboard.press('Enter');
    await page.locator(`#game-${slug} .pg-feedback .pg-verdict`).waitFor({ timeout: 5000 });
    const verdict = (await page.locator(`#game-${slug} .pg-feedback`).textContent()).trim().slice(0, 140);
    results.push({ slug, verdict, errors });
    await page.close();
  }
  await browser.close();
  for (const r of results) console.log(`${r.slug}: ${r.verdict} | errors=${r.errors.length ? r.errors.join('; ') : 'none'}`);
  if (results.some((r) => r.errors.length)) process.exitCode = 1;
})().catch((err) => { console.error(err); process.exitCode = 1; });
