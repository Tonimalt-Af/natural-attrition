// Dead-time analyser: plays a bot mode and reports every stretch where the player has nothing meaningful to do,
// idle resource surpluses, and purchases that barely move the bottleneck. Usage: node tools/deadtime.ts [modes] [seeds] [--md]
import { run, type Mode } from './bot.ts';
import * as S from '../src/engine/sim.ts';
import { INITS, A1, A3, TIERS } from '../src/engine/data.ts';
import type { State } from '../src/engine/state.ts';
import { writeFileSync, mkdirSync } from 'node:fs';

export interface Gap { act: number; startMin: number; secs: number; goal: string; blocker: string }
export interface Report { mode: Mode; seed: number; endMin: number; gaps: Gap[]; maxGap: Record<number, number>; surplusMin: number; peakSlides: number; useless: { what: string; atMin: number; why: string }[]; uselessN: number; totalGapSecs: number; marks: Record<string, number> }

function hasOptions(s: State, d: S.Derived, g: S.Goal | null): boolean {
  if (s.act === 4) return true; // scripted; not a purchase economy
  if (s.act === 3) {
    // Honest Act III options: the finale, an Act III initiative, or a rehire that is affordable AND keeps the Board above its intervention line. Waiting on confidence alone is not an option.
    if (S.finaleState(s) === '') return true;
    if (s.flags.finAt) return true;
    for (const id of ['alumni', 'flex', 'store', 'ir']) if (S.canBuy(s, id) === '') return true;
    for (const i of S.pool3(s)) { const o = S.offer(s, i); if (s.cash >= o.ret && s.conf - o.pen >= A3.INTERV_AT + 0.03) return true; }
    return false;
  }
  if (g && g.blocker === 'ready') return true;
  if (s.act === 1) {
    if (g && g.blocker === 'h' && s.cash > 100) return true; // cutting down to the Memo's headcount is an action
    if (S.humansAlive(s) > 300) { const cs = S.candidates(s, d, -1, false); for (const c of cs) if (c.pb <= 120 && s.cash >= S.sevOf(s, c.i)) return true; } // a quick-payback cut is available
  }
  if (s.act >= 2) {
    const room = Math.max(0, d.debtCap * 0.75 - s.debt);
    for (const tg of s.targets) { const c = S.bidCost(s, d, tg.size); if (S.canBid(s, d, tg) === '' && (c <= s.cash || (c <= room && s.flags.debtFirst))) return true; }
    if (s.U > 0) for (let i = 0; i < TIERS.length; i++) { if (i > 0 && s.rc[i - 1] < TIERS[i].unlockPrev) continue; if (S.tierCost(s, i) <= s.cash && d.rcEff > 0 && TIERS[i].yield / Math.max(d.rcEff, 1) >= 0.05) return true; }
  }
  if (g && s.own.consult && g.blocker === 'slides') { const c = S.assocCost(s); if (s.cash >= c && A1.ASSOC_SLIDES / Math.max(d.slidesRate, 1e-6) >= 0.05) return true; }
  return false;
}

export function analyze(mode: Mode, seed: number, maxMin = 240): Report {
  const gaps: Gap[] = []; const useless: Report['useless'] = []; let uselessN = 0;
  let gapStart = -1, gapAct = 1, gapGoal = '', gapBlock = ''; let lastSample = -1; let prevAssoc = 0, prevPartners = 0;
  let surplusSecs = 0, peakSlides = 0; let lastAct = 1;
  const closeGap = (t: number) => { if (gapStart >= 0) { gaps.push({ act: gapAct, startMin: gapStart / 60, secs: t - gapStart, goal: gapGoal, blocker: gapBlock }); gapStart = -1; } };
  const r = run({ seed, mode, maxMin, hook: (s) => {
    if (s.act !== lastAct) { closeGap(s.t); lastAct = s.act; }
    // useless-feeling purchases
    if (s.assoc !== prevAssoc || s.partners !== prevPartners) {
      const d = S.derive(s); const g = S.nextGoal(s, d);
      const dA = (s.assoc - prevAssoc) * A1.ASSOC_SLIDES + (s.partners - prevPartners) * A1.PARTNER_SLIDES;
      if (dA > 0) { const pct = dA / Math.max(d.slidesRate - dA, 1e-6); const why = !g ? 'no goal' : g.blocker !== 'slides' ? `bottleneck is ${g.blocker}, not Slides` : pct < 0.05 ? `+${(pct * 100).toFixed(1)}% Slides rate` : ''; if (why) { uselessN++; if (useless.length < 8) useless.push({ what: 'associate/partner', atMin: s.t / 60, why }); } }
      prevAssoc = s.assoc; prevPartners = s.partners;
    }
    if (s.t - lastSample < 1) return; lastSample = s.t;
    const d = S.derive(s); const g = S.nextGoal(s, d);
    if (!hasOptions(s, d, g)) { if (gapStart < 0) { gapStart = s.t; gapAct = s.act; gapGoal = g ? g.id : '-'; gapBlock = g ? g.blocker : 'none'; } }
    else closeGap(s.t);
    if (s.act <= 2) {
      const maxCost = Math.max(...INITS.filter((i) => i.act <= s.act && !s.own[i.id]).map((i) => S.costOf(s, i).slides), 1);
      if (s.slides > 4 * maxCost && s.slides > 800) surplusSecs += 1;
      peakSlides = Math.max(peakSlides, s.slides);
    }
  } });
  closeGap(r.s.t);
  const long = gaps.filter((g) => g.secs > 90);
  const maxGap: Record<number, number> = {}; for (const g of gaps) maxGap[g.act] = Math.max(maxGap[g.act] ?? 0, g.secs);
  return { mode, seed, endMin: r.s.t / 60, gaps: long, maxGap, surplusMin: surplusSecs / 60, peakSlides, useless, uselessN, totalGapSecs: gaps.reduce((a, g) => a + (g.secs > 90 ? g.secs : 0), 0), marks: r.marks };
}

if (process.argv[1]?.endsWith('deadtime.ts')) {
  const modes = (process.argv[2] || 'greedy,lazy,aggressive,clicky').split(',') as Mode[];
  const seeds = (process.argv[3] || '1,2,3').split(',').map(Number);
  const md: string[] = ['# Dead-time report', '', 'A gap = a stretch where nothing meaningful is purchasable (no ready initiative, affordable bid, useful integration tier/rack, or Slides-relevant associate). Only gaps > 90 s listed.', ''];
  for (const mode of modes) for (const seed of seeds) {
    const r = analyze(mode, seed);
    const mg = Object.entries(r.maxGap).map(([a, v]) => `A${a}:${(v / 60).toFixed(1)}m`).join(' ');
    console.log(`${mode.padEnd(10)} seed ${seed} end ${r.endMin.toFixed(0)}m | max gap ${mg} | gaps>90s: ${r.gaps.length} (${(r.totalGapSecs / 60).toFixed(1)}m) | Slides-surplus ${r.surplusMin.toFixed(1)}m peak ${Math.round(r.peakSlides)} | useless buys ${r.uselessN}`);
    md.push(`## ${mode} · seed ${seed} — ends ${r.endMin.toFixed(0)} min`, `max gap per act: ${mg || 'none'} · surplus Slides ${r.surplusMin.toFixed(1)} min (peak ${Math.round(r.peakSlides)}) · useless-feeling purchases ${r.uselessN}`, '');
    for (const g of r.gaps) md.push(`- Act ${g.act} @ ${g.startMin.toFixed(1)} min: ${(g.secs / 60).toFixed(1)} min nothing to do — waiting on **${g.goal}** (${g.blocker})`);
    for (const u of r.useless.slice(0, 3)) md.push(`- useless buy @ ${u.atMin.toFixed(1)} min: ${u.what} — ${u.why}`);
    md.push('');
    if (process.argv.includes('--verbose')) for (const g of r.gaps) console.log(`   act ${g.act} @${g.startMin.toFixed(1)}m  ${(g.secs / 60).toFixed(1)}m  ${g.goal} (${g.blocker})`);
  }
  if (process.argv.includes('--md')) { mkdirSync('reports', { recursive: true }); writeFileSync('reports/deadtime.md', md.join('\n')); }
}
