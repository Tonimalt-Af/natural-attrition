// Playwright (system Chrome) visual + smoke playtest. Usage: node e2e/run.mjs [--only=name,name] [--vp=d|m] [--tag=cN]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? args.only.split(',') : null; const tag = args.tag || 'c1';
const VPS = [{ id: 'd', w: 1280, h: 800 }, { id: 'm', w: 390, h: 844, mobile: true }].filter((v) => !args.vp || v.id === args.vp);
const PORT = 4173; const URL = `http://localhost:${PORT}/`;
mkdirSync('shots', { recursive: true });

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const cleanup = () => { try { srv.kill(); } catch { /* */ } };
process.on('exit', cleanup);
for (let i = 0; i < 60; i++) { try { const r = await fetch(URL); if (r.ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 250)); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
const SCENES = [
  { name: 'welcome', fresh: true },
  { name: 'act1-start', start: true, wait: 2500 },
  { name: 'act1-early', fx: 'act1-early' }, { name: 'act1-mid', fx: 'act1-mid' }, { name: 'act1-end', fx: 'act1-end' },
  { name: 'act2-start', fx: 'act2-start' }, { name: 'act2-mid', fx: 'act2-mid' },
  { name: 'act2-redesign-modal', fx: 'act2-redesign', modal: true }, { name: 'act2-redesign', fx: 'act2-redesign', dismiss: true },
  { name: 'act2-pre-correction', fx: 'act2-pre-correction', lens: true }, { name: 'act2-correction', fx: 'act2-correction' },
  { name: 'act3-start', fx: 'act3-start' }, { name: 'act3-stall', fx: 'act3-stall' }, { name: 'act3-mid', fx: 'act3-mid' }, { name: 'act3-card', fx: 'act3-mid', selDead: true }, { name: 'act3-late', fx: 'act3-late' }, { name: 'act3-finale', fx: 'act3-finale', selFirst: true }, { name: 'act3-capital', fx: 'act3-mid', tab: 'capital' },
  { name: 'act4', fx: 'act4' }, { name: 'act4-badge', fx: 'act4-badge' }, { name: 'act4-final', fx: 'act4-final' },
];

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  for (const sc of SCENES) {
    if (only && !only.includes(sc.name)) continue;
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${vp.id}/${sc.name}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${vp.id}/${sc.name}] pageerror: ${e.message}`));
    await page.goto(URL + '?debug=0'); await page.evaluate(() => localStorage.clear()); await page.goto(URL + '?seed=7');
    await page.waitForTimeout(300);
    if (sc.start) { await page.click('button.primary'); await page.waitForTimeout(sc.wait || 1500); }
    if (sc.fx) {
      const txt = readFileSync(`public/fixtures/${sc.fx}.nasave`, 'utf8');
      await page.evaluate(async (x) => { await window.__nat.doImport(x); window.__nat.G.paused = true; }, txt);
      await page.waitForTimeout(500);
      if (sc.modal) await page.waitForTimeout(500);
      else if (!sc.dismiss && await page.$('#rd-ok')) { await page.waitForTimeout(3100); await page.click('#rd-ok'); await page.waitForTimeout(200); }
      if (sc.dismiss) { await page.waitForTimeout(3100); await page.click('#rd-ok'); await page.waitForTimeout(300); }
      if (sc.lens) { await page.evaluate(() => { window.__nat.G.lens = true; window.__nat.G.s.stats.clicks += 0; }); await page.waitForTimeout(400); }
      if (sc.selDead || sc.selFirst) { await page.evaluate((first) => { const { G, notify } = window.__nat; const s = G.s; let pick = -1; for (let i = 0; i < s.dept.length; i++) if (!(s.fl[i] & 1) && s.cutT[i] > 0 && i !== s.first) { pick = i; break; } G.sel = first ? s.first : pick; notify(); }, !!sc.selFirst); await page.waitForTimeout(300); }
      if (sc.tab) { if (vp.mobile) { await page.click('.tabbar button:nth-child(4)'); } else { await page.click('.tabs button:has-text("Capital")'); } await page.waitForTimeout(300); }
    }
    await page.screenshot({ path: `shots/${tag}-${vp.id}-${sc.name}.png`, fullPage: !!args.full });
    if (vp.mobile && sc.fx && ['act1-mid', 'act2-mid', 'act3-mid'].includes(sc.name)) {
      for (const [i, n] of [[2, 'init'], [3, 'inbox'], [4, 'capital']]) { if (i === 4 && sc.name === 'act1-mid') continue; await page.click(`.tabbar button:nth-child(${i})`); await page.waitForTimeout(250); await page.screenshot({ path: `shots/${tag}-${vp.id}-${sc.name}-${n}.png` }); }
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close(); cleanup();
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);
