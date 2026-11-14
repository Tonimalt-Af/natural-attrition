// Accessibility + Stable UI playtest: axe-core on several scenes (default and Stable UI), reduced-motion auto-stable, keyboard reachability.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const tag = (process.argv.find((a) => a.startsWith('--tag=')) || '--tag=a').slice(6);
const PORT = 4175; const URL = `http://localhost:${PORT}/`;
mkdirSync('shots', { recursive: true });
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch { /* */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 250)); }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = []; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const fx = (n) => readFileSync(`public/fixtures/${n}.nasave`, 'utf8');
async function open(ctx, name, stable) {
  const p = await ctx.newPage();
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); }); p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL + '?seed=7');
  await p.evaluate(async (x) => { await window.__nat.doImport(x); window.__nat.G.paused = true; }, fx(name)); await p.waitForTimeout(500);
  if (await p.$('#rd-ok')) { await p.waitForTimeout(3200); await p.click('#rd-ok'); await p.waitForTimeout(200); }
  if (stable) { await p.evaluate(() => { const g = window.__nat.G; g.opts.stable = true; document.documentElement.dataset.stable = '1'; }); await p.waitForTimeout(1200); }
  return p;
}
async function axe(p, label) {
  await p.evaluate(axeSrc);
  const r = await p.evaluate(async () => { const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }); return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0].target.join(' ') + ' :: ' + (v.nodes[0].any[0]?.message || v.nodes[0].failureSummary || '').slice(0, 120) })); });
  for (const v of r) console.log('  axe', label, v.impact, v.id, 'x' + v.n, v.ex);
  return r;
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let totalSerious = 0;
for (const [name, stable] of [['act1-mid', false], ['act2-mid', false], ['act2-mid', true], ['act3-mid', false], ['act4', false]]) {
  const p = await open(ctx, name, stable);
  const r = await axe(p, `${name}${stable ? '/stable' : ''}`);
  totalSerious += r.filter((v) => ['serious', 'critical'].includes(v.impact)).length;
  if (stable) await p.screenshot({ path: `shots/${tag}-stable-${name}.png` });
  await p.close();
}
ok(totalSerious === 0, `no serious/critical axe violations (${totalSerious})`);
// keyboard: Tab reaches buttons, focus ring visible
{
  const p = await open(ctx, 'act1-mid', false);
  await p.click('body', { position: { x: 2, y: 2 } });
  const seen = new Set();
  for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => { const e = document.activeElement; if (!e) return ''; if (!e.dataset.tid) e.dataset.tid = String(Math.random()); return e.dataset.tid; })); }
  ok(seen.size >= 15, `Tab traverses distinct controls (${seen.size})`);
  const outline = await p.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.boxShadow; });
  ok(!/^none 0px none$/.test(outline.trim()), 'focused control has a visible indicator: ' + outline);
  await p.keyboard.press('Space'); await p.waitForTimeout(100);
  await p.close();
}
// prefers-reduced-motion => Stable UI on first run
{
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p = await c2.newPage(); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL + '?seed=7'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.documentElement.dataset.stable === '1'), 'reduced-motion auto-enables Stable UI');
  await c2.close();
}
await browser.close();
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors'); console.log(fails ? `${fails} FAILURES` : 'ALL OK');
process.exit(fails || errors.length ? 1 : 0);
