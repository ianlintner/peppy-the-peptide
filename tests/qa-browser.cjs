/**
 * Real-browser QA pass for every published game, the games hub and Daily Review.
 * Dev-only: needs a local Playwright and axe-core; neither is a repo dependency.
 *
 * Usage:
 *   python3 -m http.server 8765 --bind 127.0.0.1 --directory site
 *   PLAYWRIGHT_MODULE=/path/to/playwright AXE_PATH=/path/to/axe-core/axe.min.js \
 *     node tests/qa-browser.cjs [base-url] [out-dir]
 *
 * Per page and viewport (390px, 1280px) it records: console errors, page errors, any request
 * leaving the local origin, axe-core violations (WCAG 2.x A/AA tags), a screenshot of each game
 * mount, a reduced-motion check (no running animation/transition inside games), a storage-blocked
 * run (localStorage getter throws) and a keyboard-only pass per game: Tab into the mount, every
 * enabled control reachable by Tab, then Show answer -> feedback announced -> Next question with
 * Enter only. Writes <out-dir>/qa-results.json and <out-dir>/screenshots/*.png. Exit 1 on failure.
 */
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch (err) {
  console.error('Set PLAYWRIGHT_MODULE to a Playwright installation; require("playwright") failed.');
  throw err;
}
const AXE = process.env.AXE_PATH;
if (!AXE || !fs.existsSync(AXE)) throw new Error('Set AXE_PATH to axe-core/axe.min.js');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const OUT = process.argv[3] || 'docs/qa';
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = new URL(BASE).origin;
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const PAGES = [
  { name: 'course-map', path: '/index.html' },
  { name: 'foundations', path: '/lessons/foundations.html' },
  { name: 'signal-cast', path: '/lessons/signal-cast.html' },
  { name: 'endogenous-glp1', path: '/lessons/endogenous-glp1.html' },
  { name: 'hormone-and-medicine', path: '/lessons/hormone-and-medicine.html' },
  { name: 'games-hub', path: '/games/index.html', shot: '#games-hub' },
  { name: 'daily-review', path: '/games/review.html', shot: '#review' },
];

const BLOCK_STORAGE = `(() => {
  const deny = () => { throw new DOMException('blocked by QA', 'SecurityError'); };
  Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { get: deny, configurable: true });
})();`;

async function openPage(browser, viewport, url, opts = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: opts.reducedMotion || 'no-preference' });
  if (opts.blockStorage) await context.addInitScript(BLOCK_STORAGE);
  const page = await context.newPage();
  const log = { consoleErrors: [], pageErrors: [], external: [], failed: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e)));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== ORIGIN) log.external.push(u);
  });
  page.on('requestfailed', (r) => log.failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { context, page, log };
}

async function mounts(page) {
  return page.$$eval('.game-mount', (els) => els.map((e) => e.id));
}

async function waitShells(page, ids) {
  for (const id of ids) await page.locator(`#${id} .pg-shell`).waitFor({ timeout: 10000 });
}

/** Daily Review has rendered once its "Loading" placeholder is replaced (a fresh browser may get an empty-queue message). */
async function reviewReady(page) {
  await page.waitForFunction(() => {
    const m = document.getElementById('review-mount');
    return m && !m.textContent.includes('Loading your review queue');
  }, null, { timeout: 10000 });
}

async function runAxe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
  }, AXE_TAGS);
}

/** Elements inside games that would still animate under prefers-reduced-motion: reduce. */
async function movingUnderReduce(page) {
  return page.evaluate(() => {
    const secs = (v) => Math.max(...v.split(',').map((s) => parseFloat(s) * (s.trim().endsWith('ms') ? 0.001 : 1) || 0));
    const out = [];
    for (const el of document.querySelectorAll('.game-mount *, #review *, #games-hub *')) {
      const cs = getComputedStyle(el);
      const anim = cs.animationName !== 'none' && secs(cs.animationDuration) > 0.01;
      const trans = secs(cs.transitionDuration) > 0.01;
      if (anim || trans) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    }
    return out;
  });
}

async function focusables(page, id) {
  return page.evaluate((mid) => {
    const sel = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.getElementById(mid).querySelectorAll(sel))
      .filter((e) => !e.disabled && e.offsetParent !== null && !e.closest('[hidden]'))
      .map((e) => (e.type === 'radio' ? `radio:${e.name}` : `${e.tagName}:${e.textContent.trim().slice(0, 30)}:${e.getAttribute('aria-label') || ''}`));
  }, id);
}

async function activeInfo(page, id) {
  return page.evaluate((mid) => {
    const a = document.activeElement;
    if (!a || !a.closest(`#${mid}`)) return null;
    const label = a.type === 'radio' ? `radio:${a.name}` : `${a.tagName}:${a.textContent.trim().slice(0, 30)}:${a.getAttribute('aria-label') || ''}`;
    const cs = getComputedStyle(a);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
    return { label, text: a.textContent.trim(), ring };
  }, id);
}

/** Keyboard-only pass for one mount. Only Tab/Shift+Tab/Enter are pressed. */
async function keyboardPass(page, id) {
  const res = { mount: id, reachedAll: false, missing: [], noFocusRing: [], showAnswer: false, announced: false, next: false };
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.locator('body').focus();
  let tabs = 0;
  while (!(await activeInfo(page, id)) && tabs < 400) { await page.keyboard.press('Tab'); tabs += 1; }
  if (!(await activeInfo(page, id))) { res.error = 'mount not reachable with Tab'; return res; }
  const expected = new Set(await focusables(page, id));
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const a = await activeInfo(page, id);
    if (!a) break;
    seen.add(a.label);
    if (!a.ring) res.noFocusRing.push(a.label);
    await page.keyboard.press('Tab');
  }
  res.missing = [...expected].filter((x) => !seen.has(x));
  res.reachedAll = res.missing.length === 0;
  res.noFocusRing = [...new Set(res.noFocusRing)];
  // Walk back into the mount and use Show answer, then Next question, by keyboard.
  const tabUntil = async (text) => {
    for (let i = 0; i < 200; i += 1) {
      const a = await activeInfo(page, id);
      if (a && a.text === text) return true;
      await page.keyboard.press('Shift+Tab');
    }
    return false;
  };
  if (await tabUntil('Show answer')) {
    await page.keyboard.press('Enter');
    res.showAnswer = true;
    const fb = page.locator(`#${id} .pg-feedback`);
    await page.waitForTimeout(150);
    const fbText = (await fb.innerText()).trim();
    res.announced = fbText.length > 0 && (await fb.getAttribute('aria-live')) === 'polite';
    // A new item is live when the progress line changed and the answer controls are back.
    const prompt = async () => page.evaluate((mid) => {
      const m = document.getElementById(mid);
      const fresh = [...m.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Show answer');
      return `${m.querySelector('.pg-progress')?.textContent}|${fresh}`;
    }, id);
    const before = await prompt();
    for (let i = 0; i < 60; i += 1) {
      const a = await activeInfo(page, id);
      if (a && a.text === 'Next question') break;
      await page.keyboard.press('Tab');
    }
    const a = await activeInfo(page, id);
    if (a && a.text === 'Next question') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      res.next = (await prompt()) !== before || (await page.locator(`#${id} .pg-done`).count()) > 0;
    }
  }
  return res;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = { base: BASE, date: new Date().toISOString().slice(0, 10), axeTags: AXE_TAGS,
    axeVersion: null, pages: [], failures: [] };
  const fail = (msg) => results.failures.push(msg);
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const url = BASE + p.path;
      const entry = { page: p.name, width: vp.width };
      // 1. Default run: errors, network, axe, screenshots, keyboard.
      const { context, page, log } = await openPage(browser, vp, url);
      const ids = await mounts(page);
      await waitShells(page, ids);
      if (p.name === 'daily-review') await reviewReady(page);
      entry.games = ids;
      entry.axe = await runAxe(page);
      if (!results.axeVersion) results.axeVersion = await page.evaluate(() => window.axe.version);
      for (const id of ids) {
        const file = `${id.replace(/^game-/, '')}-${vp.width}.png`;
        await page.locator(`#${id}`).screenshot({ path: path.join(SHOTS, file) });
      }
      if (p.shot) await page.locator(p.shot).screenshot({ path: path.join(SHOTS, `${p.name}-${vp.width}.png`) });
      entry.keyboard = [];
      for (const id of ids) entry.keyboard.push(await keyboardPass(page, id));
      entry.log = log;
      await context.close();
      // 2. Reduced motion.
      const rm = await openPage(browser, vp, url, { reducedMotion: 'reduce' });
      await waitShells(rm.page, ids);
      entry.reducedMotionMoving = await movingUnderReduce(rm.page);
      entry.reducedMotionErrors = rm.log.pageErrors.concat(rm.log.consoleErrors);
      await rm.context.close();
      // 3. Storage blocked: page must still mount and play, and say progress is not saved.
      const sb = await openPage(browser, vp, url, { blockStorage: true });
      await waitShells(sb.page, ids);
      entry.storageBlocked = {
        errors: sb.log.pageErrors.concat(sb.log.consoleErrors),
        mounted: ids.length,
        notice: ids.length ? await sb.page.locator('.pg-shell >> text=Progress can\'t be saved').count() : null,
      };
      if (p.name === 'daily-review') {
        entry.storageBlocked.reviewRendered = await reviewReady(sb.page).then(() => true, () => false);
        entry.storageBlocked.reviewText = (await sb.page.locator('#review-mount').innerText()).slice(0, 160);
      }
      await sb.context.close();

      const tag = `${p.name}@${vp.width}`;
      if (log.consoleErrors.length || log.pageErrors.length) fail(`${tag}: console/page errors`);
      if (log.external.length) fail(`${tag}: external requests ${log.external.join(', ')}`);
      if (log.failed.length) fail(`${tag}: failed requests ${log.failed.join(', ')}`);
      if (entry.axe.length) fail(`${tag}: axe violations ${entry.axe.map((v) => v.id).join(', ')}`);
      if (entry.reducedMotionMoving.length) fail(`${tag}: motion under reduce: ${entry.reducedMotionMoving.slice(0, 3).join(', ')}`);
      if (entry.reducedMotionErrors.length) fail(`${tag}: errors under reduced motion`);
      if (entry.storageBlocked.errors.length) fail(`${tag}: errors with storage blocked`);
      if (ids.length && entry.storageBlocked.notice !== ids.length) fail(`${tag}: storage-blocked notice missing`);
      if (entry.storageBlocked.reviewRendered === false) fail(`${tag}: review did not render with storage blocked`);
      for (const k of entry.keyboard) {
        if (k.error || !k.reachedAll || !k.showAnswer || !k.announced || !k.next || k.noFocusRing.length) {
          fail(`${tag}: keyboard ${k.mount} ${JSON.stringify({ error: k.error, missing: k.missing, ring: k.noFocusRing, show: k.showAnswer, announced: k.announced, next: k.next })}`);
        }
      }
      results.pages.push(entry);
      console.log(`${tag}: games=${ids.length} axe=${entry.axe.length} external=${log.external.length} errors=${log.consoleErrors.length + log.pageErrors.length}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'qa-results.json'), JSON.stringify(results, null, 1) + '\n');
  console.log(results.failures.length ? `FAIL (${results.failures.length})\n${results.failures.join('\n')}` : 'PASS: all QA checks');
  process.exit(results.failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
