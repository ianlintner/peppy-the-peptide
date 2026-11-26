/**
 * Keyboard-only walkthrough of Islet Dispatch (lesson 2) and Relay Race (lesson 3).
 * Usage: PLAYWRIGHT_MODULE=/path/to/playwright.js node tests/keyboard-walkthrough-games-4-5.cjs [base-url]
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

async function tabTo(page, selector, max = 200) {
  for (let i = 0; i < max; i += 1) {
    const here = await page.evaluate((sel) => {
      const a = document.activeElement;
      return { matches: !!(a && sel && a.closest(sel)) };
    }, selector);
    if (here.matches) return here;
    await page.keyboard.press('Tab');
  }
  throw new Error(`target ${selector} not reachable with Tab`);
}

const press = async (page, selector) => {
  await tabTo(page, selector);
  await page.keyboard.press(selector.includes('input') ? 'Space' : 'Enter');
};

/** Native radio groups expose one Tab stop; move inside the group with Arrow keys. */
async function pressRadio(page, group, value) {
  await tabTo(page, `${group} input`);
  const values = await page.evaluate((sel) => Array.from(document.querySelectorAll(`${sel} input`)).map((n) => n.value), group);
  const target = values.indexOf(value);
  assertIndex(target, values, value);
  const focused = await page.evaluate((sel) => document.activeElement.value, group);
  let from = values.indexOf(focused);
  assertIndex(from, values, focused);
  while (from !== target) {
    const forward = (target - from + values.length) % values.length <= (from - target + values.length) % values.length;
    await page.keyboard.press(forward ? 'ArrowRight' : 'ArrowLeft');
    const current = await page.evaluate((sel) => document.activeElement.value, group);
    from = values.indexOf(current);
    assertIndex(from, values, current);
  }
  await page.keyboard.press('Space');
}

function assertIndex(index, values, value) {
  if (index < 0) throw new Error(`radio value ${value} not in group [${values.join(',')}]`);
}

/** Identify the shown item by its rendered prompt and return the sourced item. */
async function shownItem(page, slug, data) {
  const prompt = (await page.locator(`#game-${slug} blockquote`).first().textContent()).trim();
  const item = data.items.find((i) => i.prompt.trim() === prompt);
  if (!item) throw new Error(`no item matches prompt: ${prompt}`);
  return item;
}

async function solveDispatch(page, slug) {
  const data = await (await fetch(`${BASE}/games/data/${slug}.json`)).json();
  const item = await shownItem(page, slug, data);
  const right = item.choices.find((c) => c.correct === true);
  await pressRadio(page, `#game-${slug} .id-choices`, right.id);
}

async function readBoard(page, slug, item) {
  const lanes = await page.evaluate((s) => {
    const read = (lane) => Array.from(document.querySelectorAll(
      `#game-${s} .rr-lane[data-lane="${lane}"] .rr-card .rr-card-text`)).map((n) => n.textContent.trim());
    return { main: read('main'), branch: read('branch'), tray: read('tray') };
  }, slug);
  const labels = new Map(Object.entries(item.data.steps).map(([id, step]) => [step.label, id]));
  const decode = (list) => list.map((label) => {
    const id = labels.get(label);
    if (!id) throw new Error(`unmapped card label: ${label}`);
    return id;
  });
  return { main: decode(lanes.main), branch: decode(lanes.branch), tray: decode(lanes.tray) };
}

const aria = (label) => `[aria-label="${label.replace(/"/g, '\\"')}"]`;

async function solveRelay(page, slug) {
  const data = await (await fetch(`${BASE}/games/data/${slug}.json`)).json();
  const item = await shownItem(page, slug, data);
  if (item.data.mode === 'critique') {
    const right = item.choices.find((c) => c.correct === true);
    await pressRadio(page, `#game-${slug} .rr-critique`, right.id);
    return;
  }
  const step = (id) => item.data.steps[id].label;
  const move = async (id, action, extra = '') => {
    const label = action === 'up' ? `${step(id)} earlier`
      : action === 'to-tray' ? `${step(id)} to tray, off the main lane`
        : action === 'to-branch' ? `${step(id)} to branch`
          : `${step(id)} to main lane`;
    await press(page, `#game-${slug} ${aria(`Move ${label}`)}${extra}`);
  };

  // Remove unwanted cards from the main lane and the branch.
  let board = await readBoard(page, slug, item);
  for (const id of board.main.slice()) {
    if (!item.data.main_answer.includes(id)) { await move(id, 'to-tray'); board = await readBoard(page, slug, item); }
  }
  for (const id of board.branch.slice()) {
    if (id !== item.data.branch_answer[0]) { await move(id, 'to-main'); board = await readBoard(page, slug, item); }
  }
  // Bring each missing main card back (To main inserts at the start), then bubble it into place.
  for (let target = 0; target < item.data.main_answer.length; target += 1) {
    const wanted = item.data.main_answer[target];
    board = await readBoard(page, slug, item);
    if (!board.main.includes(wanted)) { await move(wanted, 'to-main'); board = await readBoard(page, slug, item); }
    let at = board.main.indexOf(wanted);
    while (at > target) {
      await move(wanted, 'up');
      board = await readBoard(page, slug, item);
      at = board.main.indexOf(wanted);
    }
    if (at !== target) throw new Error(`could not place ${wanted} at ${target}: ${board.main.join(',')}`);
  }
  // Place the degradation branch card.
  board = await readBoard(page, slug, item);
  for (const id of item.data.branch_answer) {
    if (!board.branch.includes(id)) await move(id, 'to-branch');
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/sbin/chromium', headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const games = [
    { page: 'signal-cast', slug: 'islet-dispatch', selector: '.id-choice input', solve: solveDispatch },
    { page: 'endogenous-glp1', slug: 'relay-race', selector: '.rr-move:not([disabled])', solve: solveRelay },
  ];
  const results = [];
  for (const { page: lesson, slug, selector, solve } of games) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await page.goto(`${BASE}/lessons/${lesson}.html`, { waitUntil: 'domcontentloaded' });
    await page.locator(`#game-${slug} .pg-shell`).waitFor({ timeout: 10000 });
    await press(page, `#game-${slug} .pg-tiers .pg-btn`);
    await page.locator(`#game-${slug} ${selector}`).first().waitFor({ timeout: 5000 });

    if (slug === 'relay-race') {
      const toMain = page.locator(`#game-${slug} .rr-to-main`).first();
      if (await toMain.count() !== 1) errors.push('no keyboard-reachable To main button');
      else {
        await tabTo(page, `#game-${slug} .rr-to-main`);
        const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
        if (focused !== 'To main') errors.push(`To main not focusable (focused ${focused})`);
      }
    }

    await solve(page, slug);
    const unsure = page.locator(`#game-${slug} .pg-confidence label`).filter({ hasText: 'Unsure' });
    await unsure.locator('input').focus();
    await page.keyboard.press('Space');
    await press(page, `#game-${slug} .pg-primary`);
    await page.locator(`#game-${slug} .pg-feedback .pg-verdict`).waitFor({ timeout: 5000 });
    const verdict = (await page.locator(`#game-${slug} .pg-verdict`).textContent()).trim();
    if (!/^Correct\./.test(verdict)) errors.push(`expected correct keyboard solve, got: ${verdict}`);
    results.push({ slug, verdict, errors });
    await page.close();
  }
  await browser.close();
  for (const r of results) console.log(`${r.slug}: ${r.verdict} | errors=${r.errors.length ? r.errors.join('; ') : 'none'}`);
  if (results.some((r) => r.errors.length)) process.exitCode = 1;
})().catch((err) => { console.error(err); process.exitCode = 1; });
