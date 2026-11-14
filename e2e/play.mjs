// UI-driven smoke test: really clicks through key flows (cut, buy, Act I->II, bid, Act IV -> ending A/B).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
const tag = (process.argv.find((a) => a.startsWith('--tag=')) || '--tag=c1').slice(6);
const PORT = 4174; const URL = `http://localhost:${PORT}/`;
mkdirSync('shots', { recursive: true });
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch { /* */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 250)); }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = []; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const fx = (n) => readFileSync(`public/fixtures/${n}.nasave`, 'utf8');
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
async function fresh(q = '?seed=7&debug=1') { const p = await ctx.newPage(); p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); }); p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL + q); return p; }
const G = (p, f) => p.evaluate(f);
const dismiss = async (p) => { if (await p.$('#rd-ok')) { await p.waitForTimeout(3200); await p.click('#rd-ok'); await p.waitForTimeout(200); } };

// 1. new game, first-run cut, directory cut
let p = await fresh(); await p.click('button.primary'); await p.waitForTimeout(500);
ok((await G(p, () => window.__nat.G.s.dn.reduce((a, b) => a + b, 0))) === 1000, 'new game has 1000 people');
await p.click('.firstrun .btn.primary'); await p.waitForTimeout(300);
ok((await G(p, () => window.__nat.G.s.dn.reduce((a, b) => a + b, 0))) === 997, 'first-run button transitions 3');
await p.click('.dir table tbody tr:first-child button'); await p.waitForTimeout(300);
const hc = await G(p, () => window.__nat.G.s.dn.reduce((a, b) => a + b, 0)); ok(hc <= 996, `directory cut works (${hc})`);
await p.click('.waveCard .btn.danger'); await p.waitForTimeout(300);
ok((await G(p, () => window.__nat.G.s.dn.reduce((a, b) => a + b, 0))) < hc, 'wave planner works');
await p.click('.floor canvas', { position: { x: 20, y: 20 } }); await p.waitForTimeout(200);
ok(!!(await p.$('.pcard')), 'clicking a dot opens the person card');
await p.reload(); await p.waitForTimeout(300); ok(!!(await p.$('text=Continue')), 'save persists across reload (Continue offered)');
await p.click('text=Continue'); await p.waitForTimeout(400); ok((await G(p, () => window.__nat.G.s.t)) >= 0, 'continue loads');
await p.close();

// 2. Act I -> II via UI
p = await fresh(); await p.goto(URL + '?seed=7&debug=1'); await G(p, async (x) => { await window.__nat.doImport(x); }, ); 
await p.evaluate(async (x) => { await window.__nat.doImport(x); window.__nat.G.paused = true; const s = window.__nat.G.s; s.cash = 1e7; s.slides = 5000; }, fx('act1-end'));
await p.waitForTimeout(500);
await p.click('.inits .init:has-text("Synergy Memo") .btn'); await p.waitForTimeout(400);
ok((await G(p, () => window.__nat.G.s.act)) === 2, 'Synergy Memo moves to Act II');
await p.screenshot({ path: `shots/${tag}-play-act2.png` });
// bid
const tiles0 = await G(p, () => window.__nat.G.s.tiles.length);
await p.evaluate(() => { const s = window.__nat.G.s; s.cash = 1e9; }); await p.waitForTimeout(300);
await p.click('.targets tbody tr:first-child .btn:not([disabled])'); await p.waitForTimeout(300);
ok((await G(p, () => window.__nat.G.s.tiles.length)) === tiles0 + 1, 'bidding adds a tile');
await p.close();

// 3. Act III -> IV -> endings
for (const badge of ['A', 'B']) {
  p = await fresh();
  await p.evaluate(async (x) => { await window.__nat.doImport(x); }, fx('act3-lastcust')); await p.waitForTimeout(400); await dismiss(p);
  await p.evaluate(() => { const g = window.__nat.G; g.speed = 256; g.s.cash = 1e15; });
  // a real player must still buy the Act III closers: click every enabled initiative button a few times
  for (let k = 0; k < 12 && (await G(p, () => window.__nat.G.s.act)) === 3; k++) { for (const b of await p.$$('.inits .init .btn:not([disabled])')) { try { await b.click({ timeout: 500 }); } catch { /* */ } } await p.waitForTimeout(500); }
  await p.waitForFunction(() => window.__nat.G.s.act === 4, null, { timeout: 120000 }).catch(() => {});
  ok((await G(p, () => window.__nat.G.s.act)) === 4, `act IV reached (badge ${badge})`);
  await p.waitForTimeout(400);
  for (let i = 0; i < 4; i++) { await p.click('.a4act .btn.primary'); if (i % 2 === 1) await p.click('.a4act .fastbtn'); await p.waitForFunction((n) => window.__nat.G.s.a4.step === n, i + 1, { timeout: 60000 }); await p.waitForTimeout(100); }
  await p.click(badge === 'A' ? '.a4act .btn.danger' : '.a4act .btn:not(.danger)');
  await p.waitForTimeout(200);
  await p.click('.a4act .btn.primary'); await p.click('.a4act .fastbtn'); await p.waitForFunction(() => window.__nat.G.s.a4.step === 6, null, { timeout: 90000 });
  await p.waitForTimeout(300); await p.screenshot({ path: `shots/${tag}-play-act4-exit-${badge}.png` });
  await p.click('.a4act .btn.primary'); await p.waitForTimeout(5500);
  ok((await G(p, () => window.__nat.G.s.ended)) === badge, `ending ${badge} reached`);
  await p.screenshot({ path: `shots/${tag}-play-ending-${badge}.png` });
  await p.close();
}
await browser.close();
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors'); console.log(fails ? `${fails} FAILURES` : 'ALL OK');
process.exit(fails || errors.length ? 1 : 0);
