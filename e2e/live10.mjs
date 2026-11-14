// First-time-player run against a URL (no debug): ~10 real minutes, screenshot every 90 s, human-ish actions.
import { chromium } from 'playwright-core';
const URL = process.argv[2] || 'https://tonimalt-af.github.io/natural-attrition/';
const vp = process.argv[3] === 'm' ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const mob = process.argv[3] === 'm';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: vp, isMobile: mob, hasTouch: mob });
const p = await ctx.newPage(); const errs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
await p.goto(URL); await p.waitForTimeout(1500);
const tag = `l4${mob ? 'm' : 'd'}`;
await p.screenshot({ path: `shots/${tag}-00-welcome.png` });
await p.click('button.primary'); await p.waitForTimeout(2000);
const t0 = Date.now(); let shot = 0, nextShot = 0;
const stat = () => p.evaluate(() => { const g = window.__G ?? null; const s = g?.s; return s ? { t: Math.round(s.t), act: s.act, H: s.dn.reduce((a, b) => a + b, 0), cash: Math.round(s.cash), M: +s.M.toFixed(2), own: Object.keys(s.own).length, inbox: s.inbox.length } : null; }).catch(() => null);
while (Date.now() - t0 < 600000) {
  const el = Date.now() - t0;
  if (el >= nextShot) { await p.screenshot({ path: `shots/${tag}-${String(shot).padStart(2, '0')}-${Math.round(el / 1000)}s.png` }); shot++; nextShot += 90000; console.log(Math.round(el / 1000), JSON.stringify(await stat()), '| ticker:', await p.$eval('.ticker .tk', (e) => e.textContent).catch(() => '-')); }
  // human-ish: first-run button, a directory cut, buy anything enabled
  try {
    if (!mob || true) {
      const fr = await p.$('.firstrun .btn.primary'); if (fr) await fr.click({ timeout: 500 });
      const dc = await p.$('.dir table tbody tr:first-child button:not([disabled])'); if (dc && Math.random() < 0.6) await dc.click({ timeout: 500 });
      const bs = await p.$$('.inits .init .btn:not([disabled])'); if (bs[0]) await bs[0].click({ timeout: 500 });
    }
  } catch { /* off-screen on mobile etc */ }
  await p.waitForTimeout(4000);
}
await p.screenshot({ path: `shots/${tag}-99-end.png` });
console.log('final', JSON.stringify(await stat()));
const texts = await p.evaluate(() => ({ log: [...document.querySelectorAll('.log li, .logv li')].slice(0, 15).map((e) => e.textContent) }));
console.log(JSON.stringify(texts));
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no console errors');
await browser.close();
