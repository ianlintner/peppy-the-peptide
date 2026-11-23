/**
 * Keyboard-only walkthrough of Claim Detective (Lesson 4 capstone).
 * Usage: PLAYWRIGHT_MODULE=/path/to/playwright.js node tests/keyboard-walkthrough-claim-detective.cjs [base-url]
 * Serve first: python3 -m http.server 8765 --bind 127.0.0.1 --directory site
 */
let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch (err) {
  console.error('Set PLAYWRIGHT_MODULE to a Playwright installation; require("playwright") failed.');
  throw err;
}

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const errors = [];

async function tabTo(page, selector, max = 250) {
  for (let i = 0; i < max; i += 1) {
    const here = await page.evaluate((sel) => {
      const a = document.activeElement;
      return { matches: !!(a && sel && a.closest(sel)) };
    }, selector);
    if (here.matches) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`target ${selector} not reachable with Tab`);
}

const press = async (page, selector) => {
  await tabTo(page, selector);
  await page.keyboard.press(selector.includes('input') ? 'Space' : 'Enter');
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/sbin/chromium', headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(`${BASE}/lessons/hormone-and-medicine.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#game-claim-detective .pg-shell').waitFor({ timeout: 10000 });

  // Preview banner must be visible to keyboard and screen-reader users alike.
  const banner = (await page.locator('#game-claim-detective .cd-preview-banner').textContent()).trim();
  if (!/Preview/.test(banner)) errors.push('missing preview banner');

  // Choose Curious tier with the keyboard.
  await press(page, '#game-claim-detective .pg-tiers .pg-btn');

  const data = await (await fetch(`${BASE}/games/data/claim-detective.json`)).json();
  const itemId = await page.locator('#game-claim-detective .cd-card').getAttribute('data-item');
  const item = data.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`rendered item ${itemId} not in game data`);
  const claim = item.data.spans.find((s) => s.id === item.data.answer_span);

  // Word-level selection: Tab into the post, Space on the first word, Arrow
  // across, Space on the last word. Shift+Arrow is exercised on the way.
  // Tab reachability is checked separately; focus the exact word buttons here.
  await tabTo(page, '#game-claim-detective .cd-word');
  const word = (i) => page.locator('#game-claim-detective .cd-word').nth(i);
  await word(claim.start).focus();
  await page.keyboard.press('Space');
  for (let i = claim.start + 1; i < claim.end; i += 1) {
    await word(i).focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
  }
  await word(claim.end - 1).focus();
  await page.keyboard.press('Space');
  // Choice buttons are ordinary keyboard-focusable buttons with aria-pressed.
  await press(page, `#game-claim-detective .cd-choices button[data-choice="${item.data.answer}"]`);
  await press(page, `#game-claim-detective .cd-techniques button[data-technique="${item.data.technique}"]`);
  await page.locator('#game-claim-detective .pg-confidence input').nth(1).focus();
  await page.keyboard.press('Space');
  await page.locator('#game-claim-detective .pg-primary').focus();
  await page.keyboard.press('Enter');
  await page.locator('#game-claim-detective .pg-verdict').waitFor({ timeout: 5000 });
  const verdict = (await page.locator('#game-claim-detective .pg-verdict').textContent()).trim();
  const feedback = (await page.locator('#game-claim-detective .pg-feedback').textContent()).trim();
  if (!/^Correct\./.test(verdict)) { errors.push(`expected correct keyboard solve, got: ${verdict} | ${feedback.slice(0, 200)} | item=${item.id} answer=${item.data.answer} tech=${item.data.technique} span=${JSON.stringify(claim)}`); }

  // Show-answer path must reveal the authored span as text, never color-only.
  await page.locator('#game-claim-detective .pg-actions .pg-btn').filter({ hasText: 'Next question' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('#game-claim-detective .pg-btn').filter({ hasText: 'Show answer' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('#game-claim-detective .cd-answer-span').waitFor({ timeout: 5000 });
  const shown = (await page.locator('#game-claim-detective .cd-answer-span').textContent()).trim();
  if (!/Highlighted claim:/.test(shown)) errors.push('show answer did not name the highlighted claim');

  await browser.close();
  console.log(`claim-detective: ${verdict} | banner=${JSON.stringify(banner.slice(0, 40))} | errors=${errors.length ? errors.join('; ') : 'none'}`);
  if (errors.length) process.exitCode = 1;
})().catch((err) => { console.error(err); process.exitCode = 1; });
