import { A1, A2, A3, AUTO_DEPTS, CIP_RATE, CULTURES, DAYS_PER_YEAR, DEPT3, DEPTS, G_BEAT, G_MISS, GUIDANCE, INITS, INIT_BY_ID, NDEPT, NOISE, QUARTER, STATEMENT, A4, TICK, TIERS, USD_PER_U, type Init } from './data.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER, F_TWICE, type P, type State, type Tile, type Target } from './state.ts';
import { gauss, hashGauss, next } from './rng.ts';
import { targetName } from './names.ts';

export const AI_LEVELS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0];
export interface Derived {
  q: number; Ld: number[]; R: number; pay: number; oh: number; pi: number; piRep: number; H: number; incPen: number;
  slidesRate: number; mTot: number; mRep: number; mcRep: number; mcReal: number; phi: number; E: number; kappa: number;
  dm: number; dmTarget: number; reffE: number; pay3: number; rcEff: number; ai: number; debtCap: number; humans: number;
  phiF: number; levMax: number; price: number; stockF: number; abMax: number; upkeep: number;
}
export const PRICE_CAP_MIN = 4, PRICE_CAP_MIN_2 = 3.2, PRICE_MIN_PI = 4;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const has = (s: State, id: string) => !!s.own[id];
export const aiLevel = (s: State) => { let l = 0; for (let i = 1; i <= 6; i++) if (s.own['ai' + i]) l = i; return AI_LEVELS[l]; };
export const levMax = (s: State) => A2.LEV_BASE + (s.own.lev1 ? 1 : 0) + (s.own.lev2 ? 1 : 0) + (s.own.lev3 ? 1 : 0);
export const abMax = (s: State) => (s.own.ab1 ? 1 : 0) + (s.own.ab2 ? 1 : 0) + (s.own.ab3 ? 1 : 0) + (s.own.ab4 ? 1 : 0);
export const noiseLevel = (s: State) => Math.max(s.own.telemetry ? 3 : s.own.fb360 ? 2 : s.own.stack ? 1 : 0, s.opt.second && s.act >= 2 ? 2 : 0);
export const mapped = (s: State) => !!s.own.bus || !!s.opt.gary;
export const assocCost = (s: State) => A1.ASSOC_BASE * A1.ASSOC_RATE ** s.assoc;
export const partnerCost = (s: State) => A1.PARTNER_BASE * A1.PARTNER_RATE ** s.partners;
export const tierCost = (s: State, i: number) => TIERS[i].base * TIERS[i].rate ** s.rc[i];
export const humansAlive = (s: State) => s.dn.reduce((a, b) => a + b, 0);

export function derive(s: State): Derived {
  const ai = aiLevel(s);
  // Incidents/hallucinations eat a share of *profit* (plus a sliver of revenue), so a thin early margin never turns into a death spiral.
  const incPen = (s.t < s.incUntil ? A1.INC_PEN : 0) + (s.t < s.hallUntil ? A1.HAL_PEN * 3 : 0);
  const slumpF = (s.t < s.slumpUntil ? s.slump : 1) * (s.S > 60 ? 0.9 : 1);
  const E = s.act === 1 ? humansAlive(s) : s.U + s.I;
  const phi = s.act === 1 ? 0 : E / A2.N0;
  const d = { ai, E, phi } as Partial<Derived>;
  d.levMax = levMax(s); d.abMax = abMax(s);
  d.phiF = s.F / (Math.max(s.piS, s.piBase * (s.act >= 3 ? 0.6 : 0.25), 1) * DAYS_PER_YEAR);
  d.price = A2.P0 * (Math.max(E, 1000) / 1000) ** A2.P_EXP / (1 - Math.min(phi, 0.995)) ** 0.5 * (s.opt.rolodex ? 0.95 : 1);
  const mTot0 = clamp(s.mBase + (s.act >= 2 ? 2 : 0) + 3 * ai + s.wash - s.S / 10, 4, 40) * s.mMul;
  d.mTot = mTot0;
  d.stockF = 0.3 + 0.7 * clamp(12 / mTot0 / (1 + 0.5 * A2.ADDBACK[s.addback]), 0.25, 1.3);
  if (s.act === 1) {
    const q = 0.4 + 0.6 * s.M;
    const Ld: number[] = [];
    let R = A1.R0;
    for (let k = 0; k < NDEPT; k++) {
      let A = 0;
      if (AUTO_DEPTS.includes(k)) A += ((s.own.macros ? 0.04 : 0) + (s.own.bots ? 0.08 : 0)) * s.L0[k];
      if (k === 2 && s.own.chat) A += 0.5 * s.L0[k];
      if (k === 0 && s.own.copilot) A += 0.45 * s.L0[k];
      const L = q * (s.lc[k] + s.lcx[k]) + A;
      Ld.push(L);
      if (DEPTS[k].alpha > 0) R *= (Math.max(L, 1e-6) / s.L0[k]) ** DEPTS[k].alpha;
    }
    const H = humansAlive(s);
    const hot = s.own.hotdesk ? 0.02 * H + 10 : 0;
    const oh = A1.OH_BASE + A1.OH_PER * H - hot;
    const upkeep = A1.ASSOC_UPKEEP * s.assoc;
    const pi0 = R - (s.pay + s.contrPay) - oh - upkeep;
    const pi = pi0 - Math.min(incPen, 0.9) * Math.max(pi0, 0) - (incPen > 0 ? 0.004 * R : 0);
    const slidesRate = A1.SLIDES_BASE + A1.SLIDES_MGT * q * (s.lc[7] + s.lcx[7]) + A1.ASSOC_SLIDES * s.assoc + 0.4 * s.nContr;
    const mcReal = Math.max(s.piS, 2) * DAYS_PER_YEAR * mTot0 * USD_PER_U;
    return Object.assign(d, { q, Ld, R, pay: s.pay + s.contrPay, oh, pi, piRep: pi, H, humans: H, incPen, slidesRate: slidesRate * (s.opt.tmpl ? 1.25 : 1), mRep: mTot0, mcRep: mcReal, mcReal, kappa: 0, dm: 1, dmTarget: 1, reffE: 0, pay3: 0, rcEff: 0, debtCap: 0, upkeep }) as Derived;
  }
  // Human automation share (what the player sees): integrated roles keep few humans, Colleagues shrink it.
  const kappa = Math.min(1, A2.HUM_KAPPA + A2.HUM_KAPPA_AI * ai);
  const base = A2.PI_U * s.U + (A2.PI_I + A2.PI_AI * ai) * s.I;
  // Act III: the economy stalls (nobody left to buy) and every re-engaged person brings a slice of demand back, at a contractor's price.
  const a3 = s.act >= 3;
  const pi0 = Math.max(s.pi0, 1);
  const pay3 = a3 ? s.rwRaw * A3.PAY * pi0 : 0;
  const store = a3 && s.own.store ? A3.STORE * pay3 : 0;
  const reffE = s.reffRaw;
  const dmTarget = a3 ? A3.DM0 + (1 - A3.DM0) * (1 - Math.exp(-reffE / A3.RS)) : 1;
  const dm = a3 ? clamp(s.dm, 0, 1) : 1;
  const upkeep = A1.ASSOC_UPKEEP * s.assoc + A1.PARTNER_UPKEEP * s.partners;
  const interest = s.debt * A2.INTEREST;
  const gross = base * dm + store;
  const hal = s.t < s.hallUntil ? 1 - A1.HAL_PEN : 1;
  const pi = gross * slumpF * hal - upkeep - interest - pay3;
  const a = A2.ADDBACK[s.addback];
  const piRep = pi + a * Math.max(pi, 0);
  // The Board's mood is priced into the multiple: every rehire costs a little confidence, and confidence is part of the share price.
  const mRep = a3 ? mTot0 * ((1 - A3.CONF_MC) + A3.CONF_MC * clamp(s.conf, 0, 1)) : mTot0;
  const rcEff = TIERS.reduce((a2, t, i) => a2 + t.yield * s.rc[i], 0) * s.intensity;
  const humans = Math.max(0, s.U + s.I * Math.max(0, 1 - kappa) + Math.max(s.hqExcess, -1000 * Math.max(0, 1 - kappa))) + (a3 ? s.reh * A3.COHORT * E : 0);
  return Object.assign(d, {
    q: 1, Ld: [], R: 0, pay: 0, oh: 0, pi, piRep, H: humans, incPen, kappa, dm, dmTarget, reffE, pay3,
    rcEff, debtCap: levMax(s) * Math.max(a3 ? Math.max(s.piRepS, s.piBase) : s.piRepS, 0) * DAYS_PER_YEAR, humans,
    slidesRate: ((A1.SLIDES_BASE + A1.ASSOC_SLIDES * s.assoc + A1.PARTNER_SLIDES * s.partners + (s.own.deck ? 40 * ai : 0)) * (s.opt.tmpl ? 1.25 : 1)),
    mRep, mcRep: Math.max(s.piRepS, 0) * DAYS_PER_YEAR * mRep * USD_PER_U, mcReal: Math.max(s.piS, 0) * DAYS_PER_YEAR * mTot0 * USD_PER_U,
    upkeep,
  }) as Derived;
}

// ---------- logging ----------
export function log(s: State, k: string, p?: P, tone?: string) {
  s.log.push({ t: s.t, k, p, tone }); if (s.log.length > 160) s.log.splice(0, s.log.length - 160);
}
export function mail(s: State, id: string, p?: P) {
  if (s.seen[id]) return; s.seen[id] = 1; s.inbox.push({ id, t: s.t, p, read: false }); if (s.inbox.length > 120) s.inbox.splice(0, s.inbox.length - 120);
}
export function mailAny(s: State, id: string, p?: P) { s.inbox.push({ id, t: s.t, p, read: false }); if (s.inbox.length > 120) s.inbox.splice(0, s.inbox.length - 120); }

// ---------- employees ----------
export function estC(s: State, i: number): number {
  const sg = NOISE[noiseLevel(s)];
  return s.c[i] * Math.exp(sg * hashGauss(s.seed, i) * 0.8);
}
export function sevOf(s: State, i: number) { return A1.SEV * s.w[i]; }
export function netValue(s: State, d: Derived, i: number, truth: boolean) {
  const k = s.dept[i]; const a = DEPTS[k].alpha;
  const c = truth ? s.c[i] : estC(s, i);
  const mr = a > 0 ? (a * d.R * c * d.q) / Math.max(d.Ld[k], 1e-6) : 0;
  return s.w[i] - mr;
}
export function isHuman(s: State, i: number) { return (s.fl[i] & (F_ALIVE | F_CONTR)) === F_ALIVE; }
export function canCut(s: State, i: number): string {
  if (!isHuman(s, i)) return 'dead';
  if (s.fl[i] & F_BADGE && s.act < 4) return 'badge';
  if (s.act !== 1) return 'act';
  const cost = sevOf(s, i) * (s.fl[i] & F_KEEPER && mapped(s) ? 5 : 1);
  if (s.cash < cost) return 'cash';
  return '';
}
function kill(s: State, i: number) {
  const k = s.dept[i];
  s.fl[i] &= ~F_ALIVE; s.dn[k]--; s.lc[k] -= s.c[i]; s.pay -= s.w[i];
}
function keeperLoss(s: State, i: number, voluntary: boolean) {
  if (!(s.fl[i] & F_KEEPER)) return;
  s.fl[i] &= ~F_KEEPER; s.ghosts.push(i);
  if (mapped(s) && !voluntary) { log(s, 'handover', { n: i }); return; }
  s.incUntil = s.t + A1.INC_DUR; s.incidents++; s.stats.incidents++;
  log(s, 'incident', { n: i }, 'bad'); mail(s, 'a1_incident', { n: i });
  if (s.own.consult) log(s, 'rehire_offer', { n: i });
}
/** Exit bookkeeping: who went, when, and in which wave (a Planner wave, or a run of single cuts a few seconds apart). */
function noteExit(s: State, i: number, wave: number) { s.cutT[i] = Math.max(s.t, 0.01); s.cutW[i] = wave; }
function openWave(s: State): number { s.waves.push(0); return s.waves.length; }
export function cut(s: State, i: number, hold?: { id: number }): string {
  const e = canCut(s, i); if (e) return e;
  const keeper = !!(s.fl[i] & F_KEEPER);
  s.cash -= sevOf(s, i) * (keeper && mapped(s) ? 5 : 1);
  kill(s, i);
  let wid = hold ? hold.id : (s.waves.length && s.t - s.lastCutT <= 8 ? s.waves.length : 0);
  if (!wid) { wid = openWave(s); if (hold) hold.id = wid; }
  s.waves[wid - 1]++; s.lastCutT = s.t; noteExit(s, i, wid);
  const recent = s.cutTimes.filter((x) => s.t - x < A1.SHOCK_WIN).length; s.cutTimes = s.cutTimes.filter((x) => s.t - x < A1.SHOCK_WIN); s.cutTimes.push(s.t);
  s.M = Math.max(0, s.M - A1.SHOCK * (1 + recent / A1.SHOCK_K));
  s.X += 1; s.cuts++; s.stats.cuts++;
  keeperLoss(s, i, false);
  if (s.cuts === 1 || s.cuts === 2 || s.cuts % 40 === 0) log(s, 'cut', { n: i }, 'cut');
  return '';
}
export function rehire(s: State, i: number): string {
  if (!s.own.consult) return 'locked';
  const p = s.ghosts.indexOf(i); if (p < 0) return 'none';
  const cost = A1.REHIRE_RETAINER * s.w[i]; if (s.cash < cost) return 'cash';
  s.cash -= cost; s.ghosts.splice(p, 1);
  s.fl[i] |= F_ALIVE | F_CONTR; s.nContr++; s.contrPay += 3 * s.w[i]; s.lcx[s.dept[i]] += 1.5 * s.c[i];
  s.incUntil = 0; log(s, 'rehired', { n: i }, 'good'); mail(s, 'a1_boomerang', { n: i });
  return '';
}
export function candidates(s: State, d: Derived, dept = -1, truth = false) {
  const out: { i: number; net: number; pb: number }[] = [];
  for (let i = 0; i < s.dept.length; i++) {
    if (!isHuman(s, i) || (s.fl[i] & F_BADGE)) continue;
    if (dept >= 0 && s.dept[i] !== dept) continue;
    const net = netValue(s, d, i, truth);
    out.push({ i, net, pb: sevOf(s, i) / Math.max(net, 1e-9) });
  }
  return out;
}
export function wave(s: State, dept: number, n: number, maxPayback = 600): number {
  const d = derive(s);
  const cs = candidates(s, d, dept, false).filter((x) => x.net > 0.02 && x.pb < maxPayback && !((s.fl[x.i] & F_KEEPER) && mapped(s))).sort((a, b) => a.pb - b.pb);
  let done = 0; const hold = { id: 0 };
  for (const c of cs) { if (done >= n) break; if (cut(s, c.i, hold) === '') done++; else break; }
  if (done) log(s, 'wave', { n: done }, 'cut');
  return done;
}
export function pizza(s: State): string {
  if (s.t - s.pizzaAt < A1.PIZZA_CD) return 'cd'; if (s.cash < A1.PIZZA_COST || s.act !== 1) return 'cash';
  s.cash -= A1.PIZZA_COST; s.M = Math.min(1, s.M + A1.PIZZA_GAIN); s.pizzaAt = s.t; log(s, 'pizza'); return '';
}
function attrition(s: State, dt: number, M: number) {
  const H = humansAlive(s);
  let lam = A1.ATTR * H * dt * (M < 0.5 ? 4 : 1);
  let k = 0;
  while (lam > 0) { const r = next(s); if (r < Math.min(lam, 1)) k++; lam -= 1; if (k > 6) break; }
  for (let n = 0; n < k; n++) {
    let tot = 0;
    for (let i = 0; i < s.dept.length; i++) if (isHuman(s, i) && !(s.fl[i] & F_BADGE)) tot += s.c[i] ** 1.5;
    let r = next(s) * tot, pick = -1;
    for (let i = 0; i < s.dept.length; i++) if (isHuman(s, i) && !(s.fl[i] & F_BADGE)) { r -= s.c[i] ** 1.5; if (r <= 0) { pick = i; break; } }
    if (pick >= 0) {
      kill(s, pick); noteExit(s, pick, 0);
      if (s.fl[pick] & F_KEEPER) keeperLoss(s, pick, true);
      s.flags.attr = (s.flags.attr || 0) + 1;
      if (s.flags.attr <= 3 || s.flags.attr % 25 === 0) log(s, 'attr', { n: pick });
    }
  }
}
function cip(s: State, d: Derived, dt: number) {
  let rate = 0; for (const k in CIP_RATE) if (s.own[k]) rate = Math.max(rate, CIP_RATE[k]);
  if (!rate) return;
  s.cipAcc += rate * dt;
  while (s.cipAcc >= 1) {
    s.cipAcc -= 1;
    if (s.M <= 0.6 || s.X >= 60) { s.cipAcc = Math.min(s.cipAcc, 1); break; }
    const dd = derive(s);
    let best = -1, bestPb = 600;
    for (let i = 0; i < s.dept.length; i++) {
      if (!isHuman(s, i) || (s.fl[i] & F_BADGE) || ((s.fl[i] & F_KEEPER) && mapped(s))) continue;
      const net = netValue(s, dd, i, true);
      if (net <= 0.05) continue;
      const pb = sevOf(s, i) / net;
      if (pb < bestPb) { bestPb = pb; best = i; }
    }
    if (best >= 0 && s.cash > sevOf(s, best)) cut(s, best); else break;
  }
}

// ---------- initiatives ----------
export function visible(s: State, it: Init): boolean {
  if (it.act > s.act && s.act < 4) return false;
  if (it.act < s.act && !s.own[it.id]) return it.act === 1 && s.act >= 2 ? false : s.act >= 3 ? false : true;
  if (it.req) return !!s.own[it.req] || !!s.own[it.id];
  const E = s.U + s.I;
  switch (it.gate) {
    case 'cuts10': return s.cuts >= 10;
    case 'mc50m': return derive(s).mcReal >= 5e7 || !!s.own.earn;
    case 'lowMorale': return !!s.flags.lowM;
    case 'lawsuitWarn': return !!s.flags.lawW;
    case 'min8': return s.t >= 480;
    case 'h520': return s.act === 1 && humansAlive(s) <= A1.END_H + 60;
    case 'a2': return s.act >= 2;
    case 'assoc8': return s.assoc >= 8;
    case 'stmt': return s.act >= 2 && (s.S >= 30 || E >= 50000);
    case 'e150k': return s.act >= 2 && E >= 150000;
    case 'e40k': return s.act >= 2 && E >= 40000;
    case 'e8m': return s.act >= 2 && E >= 8e6;
    case 'a3': return s.act >= 3;
  }
  return true;
}
export function costOf(s: State, it: Init) {
  const pity = s.t - s.lastBuyT > 600 ? 0.8 : 1;
  const cash0 = it.cashMin ? it.cashMin * 60 * Math.max(s.act >= 2 ? Math.max(s.piBase, s.piS) : s.piS, 1) : it.cash;
  // "Value-based pricing": nothing ever costs more than a few minutes of what you are actually earning, so a fast player never sits out a flat price.
  const piRef = s.act >= 2 ? Math.max(s.piS, s.piBase * 0.5) : s.piS;
  const cash = it.cashMin || piRef < PRICE_MIN_PI ? cash0 : Math.min(cash0, Math.max((s.act >= 2 ? PRICE_CAP_MIN_2 : PRICE_CAP_MIN) * 60 * piRef, 0));
  // Price quote: while you save up, a quoted price never rises with your income (it would chase you). Re-quoted after your next purchase.
  let locked = cash;
  if (!it.cashMin) { if (!s.pl || (s.act >= 2 && s.pl.__t !== s.lastBuyT)) s.pl = { __t: s.lastBuyT }; const pl = s.pl; locked = Math.min(pl[it.id] ?? Infinity, cash); if (!s.own[it.id] && visible(s, it)) pl[it.id] = locked; }
  return { slides: Math.ceil(it.slides * pity), cash: locked * pity };
}
export function canBuy(s: State, id: string): string {
  const it = INIT_BY_ID[id]; if (!it) return 'unknown'; if (s.own[id]) return 'owned';
  if (!visible(s, it)) return 'locked';
  if (id === 'memo' && humansAlive(s) > A1.END_H) return 'h';
  const c = costOf(s, it);
  if (s.slides < c.slides) return 'slides'; if (s.cash < c.cash) return 'cash';
  return '';
}
export function buy(s: State, id: string): string {
  const e = canBuy(s, id); if (e) return e;
  const it = INIT_BY_ID[id]; const c = costOf(s, it);
  s.slides -= c.slides; s.cash -= c.cash; s.own[id] = 1; s.lastBuyT = s.t;
  log(s, 'buy_' + id, undefined, 'good');
  if (id === 'memo') startAct2(s);
  if (id === 'earn') mail(s, 'a1_earn');
  if (id === 'copilot') mail(s, 'a1_copilot');
  if (id === 'ab1') { s.addback = 1; mail(s, 'a2_ab1'); }
  if (id === 'statement') mail(s, 'a2_stmt');
  if (id === 'ab2' && s.addback >= 1) s.addback = 2;
  return '';
}
export function assocCap(s: State) { return s.act === 1 ? A1.ASSOC_CAP : A1.ASSOC_CAP_2; }
export function buyGen(s: State, kind: string, idx = 0): string {
  if (kind === 'assoc') { if (!s.own.consult) return 'locked'; if (s.assoc >= assocCap(s)) return 'cap'; const c = assocCost(s); if (s.cash < c) return 'cash'; s.cash -= c; s.assoc++; s.lastBuyT = s.t; return ''; }
  if (kind === 'partner') { if (!s.own.partners) return 'locked'; const c = partnerCost(s); if (s.cash < c) return 'cash'; s.cash -= c; s.partners++; s.lastBuyT = s.t; return ''; }
  if (kind === 'rc') {
    if (s.act < 2) return 'locked';
    if (idx > 0 && s.rc[idx - 1] < TIERS[idx].unlockPrev) return 'locked';
    const c = tierCost(s, idx); if (s.cash < c) return 'cash'; s.cash -= c; s.rc[idx]++; s.lastBuyT = s.t;
    if (idx === 1 && s.rc[1] === 1) { s.flags.redesign = s.t; mail(s, 'a2_redesign'); }
    return '';
  }
  return 'unknown';
}

// ---------- Act transitions ----------
function genTarget(s: State): Target {
  const E = Math.max(s.U + s.I, 1000);
  const r = next(s), r2 = next(s), r3 = next(s), r4 = next(s);
  // ~1 in 3 targets is a "tuck-in": small, cheap, always in reach, so a fast economy never stares at a list of purchases it cannot make.
  const tuck = next(s) < 0.34;
  const size = tuck ? Math.max(40, Math.round(E * (0.0004 + r2 * 0.0016) + 20)) : Math.max(40, Math.round(E * (0.004 + r ** 2 * 0.3) + 60 * r2 * 5));
  return { id: s.nextTarget++, name: targetName(r3, r4), size, cult: Math.floor(next(s) * CULTURES.length) };
}
function startAct2(s: State) {
  s.act = 2; s.actT[0] = s.t;
  const H = humansAlive(s);
  s.I = 1000; s.U = 0;
  const kappa = A2.HUM_KAPPA + A2.HUM_KAPPA_AI * aiLevel(s);
  // Signed: an HQ already leaner than the integrated average stays lean (no phantom rehiring at the zoom-out).
  s.hqExcess = H - 1000 * (1 - kappa);
  s.tiles = [{ name: 'Nullwater HQ', size: 1000, left: 0, cult: 2 }];
  s.targets = []; for (let k = 0; k < 5; k++) s.targets.push(genTarget(s));
  s.piRepS = s.piS;
  mail(s, 'a2_start'); log(s, 'act2', undefined, 'good'); log(s, 'zoom');
}
/** The first person who was ever cut and is still out: the one who comes back last, as Head of Efficiency. */
export function pickFirst(s: State): number {
  let best = -1;
  for (let pass = 0; pass < 2 && best < 0; pass++) {
    for (let i = 0; i < s.dept.length; i++) {
      if ((s.fl[i] & (F_ALIVE | F_BADGE)) || s.cutT[i] <= 0 || (pass === 0 && s.cutW[i] <= 0)) continue;
      if (best < 0 || s.cutT[i] < s.cutT[best]) best = i;
    }
  }
  if (best < 0) for (let i = 0; i < s.dept.length; i++) if (!(s.fl[i] & (F_ALIVE | F_BADGE))) { best = i; break; }
  return best;
}
function startAct3(s: State) {
  s.act = 3; s.actT[1] = s.t;
  s.pi0 = Math.max(s.piS, s.piBase, 1); s.dm = 1; s.conf = 1; s.reh = 0; s.rstack = []; s.reffRaw = 0; s.rwRaw = 0;
  s.first = pickFirst(s);
  s.cash = Math.max(s.cash, A3.GRANT * s.pi0); // the Board's contingency facility: enough to start, not enough to finish
  mail(s, 'a3_start'); log(s, 'act3', undefined, 'good');
}
function startAct4(s: State) {
  s.act = 4; s.actT[2] = s.t; s.a4 = { step: 0, prog: 0, running: false, tone: [], badge: '', nps: 7, sun: 0, fast: 0, c: 0, v: 0 };
  mail(s, 'a4_start', { n: s.first, me: s.name }); log(s, 'act4', { n: s.first }, 'good');
}

// ---------- Act II+ actions ----------
export function day1Frac(s: State) { return clamp(A2.DAY1_BASE + A2.DAY1_INT * s.intensity, 0.3, 0.55); }
export function bidCost(s: State, d: Derived, size: number) { return size * d.price * d.stockF; }
/** Pure check (no side effects): why a bid on this target cannot go through right now ('' = it can). */
export function canBid(s: State, d: Derived, tg: Target): '' | 'act' | 'cap' | 'cash' {
  if (s.act !== 2) return 'act';
  if (s.U + s.I + tg.size > A2.N0 * 0.995) return 'cap';
  const cost = bidCost(s, d, tg.size); const room = Math.max(0, d.debtCap - s.debt);
  if (s.cash + room * 0.9 < cost) return 'cash';
  return '';
}
export function bid(s: State, targetId: number): string {
  if (s.act !== 2) return 'act';
  const ti = s.targets.findIndex((t) => t.id === targetId); if (ti < 0) return 'none';
  const d = derive(s); const tg = s.targets[ti];
  const why = canBid(s, d, tg);
  if (why) return why;
  const cost = bidCost(s, d, tg.size);
  const room = Math.max(0, d.debtCap - s.debt);
  let fromCash = Math.min(cost, Math.max(0, s.cash));
  if (s.flags.debtFirst) fromCash = Math.max(0, cost - room);
  fromCash = Math.min(fromCash, Math.max(0, s.cash));
  s.cash -= fromCash; s.debt += cost - fromCash;
  // Day-1 synergy: an immediate cut of a slice of the acquired headcount (bigger with integration intensity), the rest follows in waves.
  const day1 = Math.round(tg.size * day1Frac(s));
  s.U += tg.size - day1; s.I += day1;
  s.tiles.push({ name: tg.name, size: tg.size, left: tg.size - day1, cult: tg.cult });
  const cm = CULTURES[tg.cult]?.mul ?? 1;
  s.S = Math.min(100, s.S + A2.DAY1_SCANDAL * cm * s.intensity * s.intensity * Math.min(2, Math.sqrt(day1 / (0.01 * d.E + 50))));
  s.flags.lastDay1 = day1;
  mergeTiles(s);
  s.targets.splice(ti, 1, genTarget(s));
  s.lastBuyT = s.t;
  log(s, 'bid', { name: tg.name, n: tg.size });
  if (day1 > 0) log(s, 'day1', { name: tg.name, n: day1, pct: Math.round(100 * day1 / tg.size) }, 'cut');
  return '';
}
export function applyWave(s: State, say: boolean) {
  let amt = s.flags.waveAcc ?? 0; s.flags.waveAcc = 0;
  const live = s.tiles.filter((x) => x.left > 0.5); if (!live.length) return;
  const before = live.map((x) => x.left);
  for (let pass = 0; pass < 4 && amt > 1e-6; pass++) {
    const open = live.filter((x) => x.left > 0); if (!open.length) break;
    const wsum = open.reduce((a, x) => a + Math.sqrt(x.left), 0);
    let used = 0;
    for (const x of open) { const sh = Math.min(x.left, amt * Math.sqrt(x.left) / wsum); x.left -= sh; used += sh; }
    amt -= used;
  }
  for (const x of live) if (x.left < 0.5) x.left = 0;
  if (!say) return;
  let bi = 0, bd = 0; live.forEach((x, i) => { const dd = before[i] - x.left; if (dd > bd) { bd = dd; bi = i; } });
  const tl = live[bi]; const n = live.filter((x, i) => before[i] - x.left > 0.5).length;
  if (bd >= 1 && tl) { s.flags.waveN = (s.flags.waveN ?? 0) + 1; log(s, 'iwave', { name: tl.name, n: Math.round(bd), pct: Math.round(100 * bd / Math.max(tl.size, 1)), k: n, v: (s.flags.waveN + (tl.size | 0)) % 6 }, 'cut'); }
}
function mergeTiles(s: State) {
  while (s.tiles.length > 64) {
    const a = s.tiles[0], b = s.tiles[1];
    s.tiles.splice(0, 2, { name: 'Earlier holdings', size: a.size + b.size, left: a.left + b.left, cult: b.cult });
  }
}
export function repay(s: State, amt = Infinity) { const p = Math.min(s.debt, s.cash, amt); s.cash -= p; s.debt -= p; return p; }
export function setAddback(s: State, lvl: number) { s.addback = clamp(Math.round(lvl), 0, abMax(s)); }
export function setIntensity(s: State, k: number) { s.intensity = clamp(k, 0.5, 2); }
export function aiwash(s: State): string {
  if (!s.own.aiwash) return 'locked'; if (s.t - s.washAt < 60) return 'cd'; s.wash = Math.min(3, s.wash + 0.5); s.washAt = s.t; log(s, 'aiwash'); return '';
}
export function moodNow(s: State) { return Math.floor(hashGauss(s.seed, Math.floor(s.t / 90) + 5000) * 1000) & 3; }
export function statement(s: State, cards: number[]): number {
  if (!s.own.statement || s.slides < STATEMENT.cost) return -1;
  s.slides -= STATEMENT.cost; const mood = moodNow(s);
  let score = cards.filter((c) => c === mood).length + (s.opt.boiler ? 1 : 0); score = Math.min(3, score);
  s.S = Math.max(0, s.S - STATEMENT.scoreS[score]); s.stats.statements++; log(s, 'stmt', { n: score }, score >= 2 ? 'good' : ''); return score;
}
export function auditChoice(s: State, ch: 'lunch' | 'restate' | 'switch' | 'ignore') {
  if (!s.pendAudit) return;
  const piY = Math.max(s.piS, 1);
  if (ch === 'lunch') { s.cash -= 5 * 60 * piY; s.immuneUntil = s.t + 600; s.S = Math.min(100, s.S + 3); }
  if (ch === 'restate') { s.F *= 0.5; s.mMul *= 0.85; }
  if (ch === 'switch') { s.cash -= 20 * 60 * piY; s.immuneUntil = s.t + 1800; s.S = Math.min(100, s.S + 10); }
  if (ch === 'ignore') s.ignoreUntil = s.t + 300;
  s.pendAudit = 0; s.stats.audits++; log(s, 'audit_' + ch);
}
export function a4Run(s: State): string {
  if (s.act !== 4) return 'act'; const st = s.a4;
  if (st.running) return 'busy'; if (st.step === 4) return 'choose'; if (st.step >= 6) return 'done';
  st.running = true; st.prog = 0; return '';
}
export function a4Tone(s: State, tone: number) { s.a4.tone[s.a4.step] = tone; }
/** Answering a review is what starts it: Agree / Question / Resign (tone is remembered for the exit interview). */
export function a4Pick(s: State, tone: number): string { if (s.act !== 4 || s.a4.running || s.a4.step > 3) return 'busy'; a4Tone(s, tone); return a4Run(s); }
/** Fast-track: skip the rest of a running review. The Initiative notes your impatience. */
export function a4Fast(s: State): string { const st = s.a4; if (s.act !== 4 || !st.running) return 'idle'; st.prog = st.step === 5 ? A4.SUNSET : A4.ANALYSIS; st.fast = (st.fast ?? 0) + 1; log(s, 'a4_fast'); return ''; }
export function a4Stance(s: State): 'agree' | 'question' | 'resign' | 'mixed' | 'none' {
  const c = [0, 0, 0]; for (const x of s.a4.tone) if (x >= 0 && x <= 2) c[x]++; const n = c[0] + c[1] + c[2]; if (!n) return 'none';
  const m = Math.max(...c); if (c.filter((x) => x === m).length > 1) return 'mixed'; return (['agree', 'question', 'resign'] as const)[c.indexOf(m)];
}
/** How cruel Act I was, 0..1 (the reviewer reads the file). Waves of 10+ count double against you, as do incidents, lawsuits and the Board re-cutting its own rehires. */
export function cruelty(s: State): { c: number; parts: Record<string, number> } {
  const cuts = Math.max(1, s.stats.cuts); let big = 0; for (const w of s.waves) if (w >= 10) big += w;
  const parts = {
    cuts: 0.32 * Math.min(1, s.stats.cuts / 700), waves: 0.22 * Math.min(1, big / cuts), incidents: 0.16 * Math.min(1, s.stats.incidents / 5),
    lawsuits: 0.1 * Math.min(1, s.stats.lawsuits / 2), interv: 0.1 * Math.min(1, s.interv / 3), scandal: 0.1 * Math.min(1, s.S / 100),
  };
  return { c: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}
/** Verdict bands: 0 retained, 1 eliminated (appeal possible), 2 eliminated (appeal denied). */
export const VERDICT = { KEEP: 0.3, DENY: 0.62 };
export function a4Verdict(s: State) {
  const { c } = cruelty(s); const st = a4Stance(s);
  const adj = st === 'agree' ? -0.04 : st === 'question' ? 0.03 : 0; const cc = clamp(c + adj, 0, 1);
  s.a4.c = cc; s.a4.v = cc < VERDICT.KEEP ? 0 : cc < VERDICT.DENY ? 1 : 2;
}
export function a4Badge(s: State, ch: 'A' | 'B') { if (s.act === 4 && s.a4.step === 4) { if (ch === 'B' && s.a4.v === 2) return; s.a4.badge = ch; s.a4.step = 5; s.a4.prog = 0; s.a4.running = false; log(s, 'badge_' + ch); } }
export function a4Submit(s: State, nps: number) { if (s.act === 4 && s.a4.step === 6) { s.a4.nps = nps; s.ended = s.a4.badge === 'B' ? 'B' : 'A'; log(s, 'ended'); } }

// ---------- stepping ----------
function histPush(s: State, d: Derived) {
  if (s.t - s.histAt < 10) return; s.histAt = s.t;
  s.peakH = Math.max(s.peakH, d.humans);
  s.hist.push([Math.round(s.t), Math.log10(Math.max(d.mcRep, 1e5)), d.humans / Math.max(s.peakH, 1), Math.log10(Math.max(d.mcReal, 1e5))]);
  if (s.hist.length > 700) { const h: number[][] = []; for (let i = 0; i < s.hist.length; i += 2) h.push(s.hist[i]); s.hist = h; }
}
function quarter(s: State, d: Derived) {
  if (!s.own.earn) return;
  if (s.t - s.q.startT < QUARTER) return;
  const g = s.guidance;
  const actual = s.act === 1 ? s.piS : s.piRepS;
  const beat = actual >= s.q.street * (1 + GUIDANCE[g]);
  if (beat) { s.mBase = Math.min(24, s.mBase + G_BEAT[g]); s.beats++; s.stats.beats++; } else { s.mBase = Math.max(6, s.mBase - G_MISS[g]); s.misses++; s.stats.misses++; }
  s.lastQ = { beat: beat ? 1 : 0, g, at: s.t };
  log(s, beat ? 'q_beat' : 'q_miss', { q: s.q.n + 1, n: g }, beat ? 'good' : 'bad');
  if (beat) mail(s, 'a1_beat'); else mail(s, 'a1_miss');
  const startPi = actual;
  s.q = { n: s.q.n + 1, startT: s.t, street: startPi * 1.05, startPi, prevPi: s.q.startPi, g: s.q.startPi > 0 ? startPi / s.q.startPi - 1 : 0 };
  mailAny(s, 'review', { q: s.q.n, cuts: s.stats.cuts, tabs: Math.round(s.stats.hiddenSec / 60), min: Math.round(s.t / 60) });
}
export function trendPct(s: State) { return s.q.startPi > 0 ? (s.act === 1 ? s.piS : s.piRepS) / s.q.startPi - 1 : 0; }
export function setGuidance(s: State, g: number) { s.guidance = clamp(g, 0, 3); }

function advisor(s: State, d: Derived) {
  if (s.t - s.lastBuyT < 300 || s.t - s.advAt < 300) return;
  s.advAt = s.t;
  let key = 'cash';
  if (s.act === 1) key = s.M < 0.65 ? 'morale' : s.X > 60 ? 'exposure' : s.slides < 50 ? 'slides' : 'info';
  else if (s.act === 2) key = d.debtCap - s.debt > 0 ? 'bid' : 'leverage';
  else key = 'demand';
  mailAny(s, 'advisor_' + key);
}

export function step(s: State, dt = TICK, off = false) {
  if (s.ended) return;
  s.t += dt;
  s.rev++;
  const d = derive(s);
  if (s.act === 4) { stepAct4(s, dt); return; }
  // economy
  const eff = off ? 0.5 : 1;
  s.cash += d.pi * dt * eff; s.slides += d.slidesRate * dt * eff;
  s.piS += (d.pi - s.piS) * (1 - Math.exp(-dt / 60));
  s.piRepS += (d.piRep - s.piRepS) * (1 - Math.exp(-dt / 60));
  if (s.act >= 2) s.piBase = Math.max(s.piBase, s.piS);
  s.peakH = Math.max(s.peakH, d.humans);
  s.mMul += (1 - s.mMul) * (dt / 600);
  s.mBase += ((10 - s.mBase) * 0.002 * dt);
  s.wash *= Math.exp(-dt / 300);
  if (s.act === 1) stepAct1(s, d, dt, off); else stepAct2(s, d, dt, off);
  if (off) s.q.startT += dt; else { quarter(s, d); advisor(s, d); mails(s, d); }
  histPush(s, d);
  // bridge loan
  if (s.cash < 5 && d.pi <= 0) { s.bridge += dt; if (s.bridge > 60) { s.bridge = 0; s.cash += s.act === 1 ? 600 : Math.max(1e4, 600 * Math.abs(d.pi)); mail(s, 'bridge'); } } else s.bridge = 0;
  if (s.cash < 0) s.cash = 0;
}
export function stepN(s: State, n: number, dt = TICK) { for (let i = 0; i < n && !s.ended; i++) step(s, dt); }

function stepAct1(s: State, d: Derived, dt: number, off: boolean) {
  const rho = A1.RHO0 + A1.RHO_HR * s.lc[4] + (s.own.wellness ? 0.001 : 0) + (s.own.recog ? 0.0008 : 0);
  const cap = A1.MCAP - (s.own.telemetry ? 0.05 : 0);
  s.M = Math.min(cap, s.M + rho * dt);
  if (s.M < 0.6) s.flags.lowM = 1;
  s.X = Math.max(0, s.X - (A1.EXP_DECAY + A1.EXP_LEG * (s.lc[5] + s.lcx[5]) + (s.own.legalhold ? 0.2 : 0)) * dt);
  if (s.X >= 70) s.flags.lawW = 1;
  if (!off && s.X >= 100) { s.cash *= 1 - A1.LAWSUIT_LOSS; s.X = 40; s.lawsuits++; s.stats.lawsuits++; log(s, 'lawsuit', undefined, 'bad'); mail(s, 'a1_lawsuit'); }
  attrition(s, dt, s.M);
  if (off) return;
  cip(s, d, dt);
  if (s.own.copilot && s.t > s.hallUntil) { const p = 1 - Math.exp(-dt / 600); if (next(s) < p) { s.hallUntil = s.t + A1.HAL_DUR; log(s, 'halluc', undefined, 'bad'); } }
  // scope creep
  if (s.assoc >= 8 && !s.own.procure && s.t >= s.creepAt) {
    s.creepAt = s.t + 90;
    if (next(s) < 0.25) { const c = assocCost(s) * 2; if (s.cash > c * 2) { s.cash -= c; s.assoc++; log(s, 'creep', undefined, 'bad'); mail(s, 'a1_creep'); if (s.assoc >= 25) s.flags.recursion = 1; } else mail(s, 'a1_creep_inv'); }
  }
  void d;
}

function stepAct2(s: State, d: Derived, dt: number, off: boolean) {
  // integration
  const mv = s.act >= 3 ? 0 : Math.min(s.U, (d.rcEff / A2.KAPPA) * dt * (off ? 0.5 : 1)); // integration stops when the stall starts
  if (mv > 0) {
    s.U -= mv; s.I += mv;
    let cult = 1; let big = 0; for (const t of s.tiles) if (t.left > big) { big = t.left; cult = CULTURES[t.cult]?.mul ?? 1; }
    s.flags.waveAcc = (s.flags.waveAcc ?? 0) + mv;
    const rate = mv / dt;
    const gain = 0.03 * cult * s.intensity * s.intensity * Math.min(4, Math.sqrt(rate / (0.0025 * d.E + 20))) * (s.opt.deny ? 0.8 : 1);
    s.S = Math.min(100, s.S + gain * dt);
  }
  // Integration waves: the integrated headcount is applied to every pending block in parallel, in steps, not one block at a time.
  if ((s.flags.waveAcc ?? 0) > 0 && (s.t >= (s.flags.waveAt ?? 0) + A2.WAVE_T || s.U < 1)) { applyWave(s, !off); s.flags.waveAt = s.t; }
  s.S = Math.max(0, s.S - A2.SCANDAL_DECAY * dt);
  if (s.hqExcess > 0) s.hqExcess *= Math.exp(-dt / 120);
  if (off) return;
  // hallucinations
  const ai = d.ai;
  if (ai > 0 && s.t > s.hallUntil) {
    const h = A2.HAL * ai * ai * (s.own.guard1 ? 0.5 : 1) * (s.own.guard2 ? 0.5 : 1) * s.intensity;
    if (next(s) < 1 - Math.exp(-h * dt)) { s.hallUntil = s.t + A1.HAL_DUR; s.S = Math.min(100, s.S + 5); log(s, 'halluc', undefined, 'bad'); mail(s, 'a2_halluc'); }
  }
  // fiction
  const a = A2.ADDBACK[s.addback];
  if (a > 0) s.F += a * Math.max(d.pi, 0) * dt * (s.opt.clean ? 0.75 : 1);
  s.stats.maxFiction = Math.max(s.stats.maxFiction, d.phiF);
  const hz = A2.AUDIT_H * Math.max(0, d.phiF - A2.AUDIT_FROM) * (s.t < s.immuneUntil ? 0 : 1) * (s.t < s.ignoreUntil ? 3 : 1);
  if (s.act < 3 && hz > 0 && next(s) < 1 - Math.exp(-hz * dt)) reckoning(s, d); // Act III has its own punishment: the stall
  // audits
  const next_ = A2.AUDIT_FIRST * 10 ** s.auditMark;
  if (!s.pendAudit && d.mcRep >= next_ && s.auditMark < 4) { s.auditMark++; s.pendAudit = s.t + 120; mailAny(s, 'a2_audit'); }
  if (s.pendAudit && s.t > s.pendAudit) auditChoice(s, 'ignore');
  // debt: covenant
  if (s.debt > d.debtCap * 1.05) {
    const pay = Math.min(s.debt - d.debtCap, Math.max(0, d.pi) * 0.5 * dt + Math.max(0, s.cash) * 0.01 * dt);
    s.debt -= pay; s.cash -= Math.min(pay, s.cash);
    if (!s.flags.cov) { s.flags.cov = 1; mail(s, 'a2_covenant'); }
    if (s.act < 3 && s.debt > d.debtCap * 1.5 && s.cash < 60 * Math.abs(d.pi) + 1) {
      const sell = 0.1 * (s.U + s.I); const fromU = Math.min(s.U, sell); s.U -= fromU; s.I -= sell - fromU; s.debt = Math.max(0, s.debt - sell * d.price * 0.5); log(s, 'firesale', undefined, 'bad');
    }
  }
  // correction
  const E = d.E;
  if (s.act === 2) {
    if (E >= 10e6) mail(s, 'a2_warn10'); if (E >= 14e6) mail(s, 'a2_warn14'); if (E >= 17e6) mail(s, 'a2_warn17');
    if (s.corr === 0 && E >= A2.CORR_E) {
      const lam = s.debt / Math.max(s.piS * DAYS_PER_YEAR, 1);
      let x = 0.2 + 0.3 * Math.min(1, lam / 3) + 0.3 * Math.min(1, d.phiF);
      if (s.own.rainy) x *= 0.7;
      s.mMul *= 1 - x; s.slump = 0.8; s.slumpUntil = s.t + 180; s.corr = 1; s.flags.corrAt = s.t; s.flags.corrX = Math.round(x * 100);
      log(s, 'correction', { n: Math.round(x * 100) }, 'bad'); mail(s, 'a2_correction', { x: Math.round(x * 100) });
    }
    if (s.corr === 1 && s.t > s.flags.corrAt + 180) s.corr = 2;
    if (s.corr === 2 && E >= A2.SYSTEMIC_E) startAct3(s);
  }
  if (s.act === 3) stepAct3(s, d, dt);
}
function reckoning(s: State, d: Derived) {
  const x = Math.min(0.85, 0.35 * d.phiF);
  s.mMul *= 1 - x; s.reckonings++; s.stats.reckonings++; s.slump = 0.5; s.slumpUntil = s.t + 300; s.S = 70; s.F *= 0.3;
  const call = 0.3 * s.debt;
  if (s.cash >= call) { s.cash -= call; s.debt -= call; } else { const sell = 0.15 * (s.U + s.I); const fu = Math.min(s.U, sell); s.U -= fu; s.I -= sell - fu; s.debt *= 0.7; }
  s.immuneUntil = s.t + 300;
  log(s, 'reckoning', { n: Math.round(x * 100) }, 'bad'); mail(s, 'a2_reckoning');
}
function stepAct3(s: State, d: Derived, dt: number) {
  // Demand follows the rehires, with a lag (and falls faster than it climbs).
  const tgt = d.dmTarget; const tau = tgt > s.dm ? A3.TAU_UP : A3.TAU_DN;
  s.dm += (tgt - s.dm) * (1 - Math.exp(-dt / tau));
  // The Board forgives, slowly.
  s.conf = Math.min(1, s.conf + (1 - s.conf) * (dt / (s.own.ir ? A3.TAU_CONF_IR : A3.TAU_CONF)));
  if (s.conf < A3.INTERV_AT && s.rstack.length && !s.flags.finAt) intervene(s);
  if (s.dm < 0.7 && s.t > s.actT[1] + 12) mail(s, 'a3_stall');
  if (s.dm < 0.5 || s.t > s.actT[1] + 90) s.flags.stall = 1; // the stall has happened (or has had its 90 seconds): the finale can no longer be skipped by rehiring fast
  if (s.reh >= 1) mail(s, 'a3_first');
  if (s.reh >= 10) mail(s, 'a3_m1');
  if (s.flags.stall && s.dm >= 0.5) mail(s, 'a3_m2');
  if (s.flags.stall && s.dm >= 0.65) mail(s, 'a3_m3');
  if (s.flags.stall && s.dm >= A3.DM_FIN - 0.001) mail(s, 'a3_ready');
  if (s.flags.finAt && s.t >= s.flags.finAt + A3.FIN_WAIT) startAct4(s);
}
// ---------- Act III: The Rehire ----------
export const grudgeOf = (s: State, i: number) => { const w = s.cutW[i]; return w > 0 ? clamp((s.waves[w - 1] ?? 1) / A3.GRUDGE_N, 0, 1) : 0; };
export interface Offer { i: number; ret: number; pay: number; eff: number; pen: number; grudge: number; value: number }
/** What bringing one person back costs and does: retainer (cash), contractor bill (per second), demand, and the Board's reaction. */
export function offer(s: State, i: number): Offer {
  const k = s.dept[i]; const pi0 = Math.max(s.pi0, 1); const g = grudgeOf(s, i);
  const ret = A3.RET0 * pi0 * A3.RET_G ** s.reh * (0.6 + 0.4 * s.w[i]) * (1 + A3.GRUDGE * g);
  const pay = s.w[i] * A3.PAY * pi0;
  const eff = DEPT3[k].dm * (0.7 + 0.3 * s.c[i]);
  const pen = A3.PEN * DEPT3[k].bp * (s.own.flex ? A3.FLEX : 1);
  const value = eff / (ret / (A3.RET0 * pi0) + pen * 30);
  return { i, ret, pay, eff, pen, grudge: g, value };
}
export function canReengage(s: State, i: number): '' | 'act' | 'here' | 'badge' | 'first' | 'cash' | 'done' {
  if (s.act !== 3) return 'act'; if (s.flags.finAt) return 'done';
  if (s.fl[i] & F_BADGE) return 'badge'; if (s.fl[i] & F_ALIVE) return 'here'; if (i === s.first) return 'first';
  if (s.cutT[i] <= 0) return 'here';
  if (s.cash < offer(s, i).ret) return 'cash';
  return '';
}
/** Everyone who can be brought back (not the first, not #1000, not anyone still on the floor). */
export function pool3(s: State): number[] { const out: number[] = []; for (let i = 0; i < s.dept.length; i++) if (!(s.fl[i] & (F_ALIVE | F_BADGE)) && i !== s.first && s.cutT[i] > 0) out.push(i); return out; }
function recalc3(s: State) {
  let e = 0, w = 0; for (const i of s.rstack) { e += DEPT3[s.dept[i]].dm * (0.7 + 0.3 * s.c[i]); w += s.w[i]; } s.reffRaw = e; s.rwRaw = w;
}
export function reengage(s: State, i: number): string {
  const why = canReengage(s, i); if (why) return why;
  const o = offer(s, i);
  s.cash -= o.ret; s.fl[i] |= F_ALIVE | F_CONTR; s.dn[s.dept[i]]++;
  s.reh++; s.rstack.push(i); recalc3(s); s.conf = Math.max(0, s.conf - o.pen); s.lastBuyT = s.t;
  if (s.reh <= 3 || s.reh % 10 === 0) log(s, 'reeng', { n: i, k: s.reh }, 'good');
  return '';
}
/** "Re-engagement Wave": the n best-value people you can afford, stopping before the Board loses patience (so it is never silent: the reason comes back). */
export function reengageBest(s: State, n: number): { done: number; why: '' | 'locked' | 'cash' | 'board' | 'none' } {
  if (!s.own.alumni) return { done: 0, why: 'locked' };
  const list = pool3(s).map((i) => offer(s, i)).sort((a, b) => b.value - a.value);
  let done = 0, why: '' | 'cash' | 'board' | 'none' = list.length ? '' : 'none';
  for (const o of list) {
    if (done >= n) break;
    const cur = offer(s, o.i);
    if (s.cash < cur.ret) { why = 'cash'; break; }
    if (s.conf - cur.pen < A3.SAFE) { why = 'board'; break; }
    if (reengage(s, o.i) === '') done++;
  }
  if (done) log(s, 'reeng_wave', { n: done }, 'good');
  return { done, why };
}
/** The Board "right-sizes" the most recent rehires (they go out a second time) and takes the multiple back up. */
function intervene(s: State) {
  const k = Math.min(A3.INTERV_N, s.rstack.length); const gone = s.rstack.splice(s.rstack.length - k, k);
  const wid = openWave(s);
  for (const i of gone) { s.fl[i] &= ~(F_ALIVE | F_CONTR); s.fl[i] |= F_TWICE; s.dn[s.dept[i]]--; s.cutT[i] = s.t; s.cutW[i] = wid; s.waves[wid - 1]++; }
  s.reh -= k; recalc3(s); s.conf = A3.INTERV_TO; s.interv++; s.flags.recut = (s.flags.recut ?? 0) + k;
  log(s, 'interv', { n: gone[gone.length - 1], k, v: s.interv }, 'bad'); mailAny(s, 'a3_interv', { n: gone[gone.length - 1], k });
}
/** Extra demand (as a share of full demand) that this person would add once the lag has played out. */
export function dmGain(s: State, eff: number, d: Derived) { return A3.DM0 + (1 - A3.DM0) * (1 - Math.exp(-(d.reffE + eff) / A3.RS)) - d.dmTarget; }
/** Seconds until Board confidence has recovered enough to take `pen` without falling below `line`. */
export function confWait(s: State, pen: number, line = A3.INTERV_AT + 0.05): number {
  const need = line + pen; if (s.conf >= need) return 0; if (need >= 1) return Infinity;
  const tau = s.own.ir ? A3.TAU_CONF_IR : A3.TAU_CONF; return tau * Math.log((1 - s.conf) / (1 - need));
}
/** The Act III goal card: which mandate you are on, and what is actually holding you back right now. */
export interface Goal3 { mandate: 1 | 2 | 3 | 4; have: number; need: number; limit: '' | 'cash' | 'board' | 'finale' | 'done'; eta: number; ret: number; pen: number }
export function goal3(s: State, d: Derived): Goal3 {
  const mandate = s.reh < 10 && !s.flags.stall ? 1 : s.dm < 0.5 ? 2 : s.dm < A3.DM_FIN - 0.001 ? 3 : 4;
  const have = mandate === 1 ? s.reh : s.dm; const need = mandate === 1 ? 10 : mandate === 2 ? 0.5 : A3.DM_FIN;
  if (s.flags.finAt) return { mandate: 4, have, need, limit: 'done', eta: Math.max(0, s.flags.finAt + A3.FIN_WAIT - s.t), ret: 0, pen: 0 };
  if (mandate === 4) { const c = finaleCost(s); return s.cash >= c ? { mandate, have, need, limit: 'finale', eta: 0, ret: c, pen: 0 } : { mandate, have, need, limit: 'cash', eta: d.pi > 0 ? (c - s.cash) / d.pi : Infinity, ret: c, pen: 0 }; }
  let best: Offer | null = null; for (const i of pool3(s)) { const o = offer(s, i); if (!best || o.value > best.value) best = o; }
  if (!best) return { mandate, have, need, limit: '', eta: 0, ret: 0, pen: 0 };
  if (s.cash < best.ret) return { mandate, have, need, limit: 'cash', eta: d.pi > 0 ? (best.ret - s.cash) / d.pi : Infinity, ret: best.ret, pen: best.pen };
  const w = confWait(s, best.pen); if (w > 0) return { mandate, have, need, limit: 'board', eta: w, ret: best.ret, pen: best.pen };
  return { mandate, have, need, limit: '', eta: 0, ret: best.ret, pen: best.pen };
}
export const finaleCost = (s: State) => A3.FIN_RET * Math.max(s.pi0, 1);
export function finaleState(s: State): '' | 'act' | 'dm' | 'cash' | 'done' {
  if (s.act !== 3) return 'act'; if (s.flags.finAt) return 'done';
  if (!s.flags.stall || s.dm < A3.DM_FIN - 0.001) return 'dm'; if (s.cash < finaleCost(s)) return 'cash'; return '';
}
export function offerHead(s: State): string {
  const why = finaleState(s); if (why) return why;
  const i = s.first; s.cash -= finaleCost(s); s.fl[i] |= F_ALIVE | F_CONTR; s.dn[s.dept[i]]++; s.flags.finAt = s.t;
  log(s, 'hoe', { n: i }, 'good'); mailAny(s, 'a3_hoe', { n: i });
  return '';
}
function stepAct4(s: State, dt: number) {
  const st = s.a4;
  if (st.running) {
    st.prog += dt;
    const need = st.step === 5 ? A4.SUNSET : A4.ANALYSIS;
    if (st.prog >= need) {
      st.running = false; st.prog = 0;
      if (st.step === 5) { st.step = 6; } else st.step++;
      if (st.step === 4) a4Verdict(s);
      log(s, 'a4_step' + (st.step - 1));
      mailAny(s, 'a4_r' + (st.step - 1), { n: s.first, me: s.name });
    }
  }
}

function mails(s: State, d: Derived) {
  if (s.act === 1) {
    mail(s, 'a1_welcome');
    if (s.cuts >= 1) mail(s, 'a1_first_cut');
    if (s.M < 0.7) mail(s, 'a1_morale');
    if (s.X >= 70) mail(s, 'a1_lawwarn');
    if (d.humans <= 800) mail(s, 'a1_800');
    if (d.humans <= 600) mail(s, 'a1_600');
    if (s.t > 120 && s.slides >= 4 && !s.own.stack) mail(s, 'a1_hollis_slides');
    if (d.humans <= A1.END_H + 40) mail(s, 'a1_ready');
  } else if (s.act === 2) {
    if (s.I + s.U > 5000) mail(s, 'a2_5k');
    if (s.S >= 40) mail(s, 'a2_scandal40');
    if (s.S >= 80) mail(s, 'a2_scandal80');
  }
}

export function summary(s: State) {
  const d = derive(s);
  return { t: s.t, act: s.act, H: d.humans, cash: s.cash, pi: d.pi, mc: d.mcRep, M: s.M, X: s.X, S: s.S, E: d.E, phi: d.phi, dm: d.dm, conf: s.conf, reh: s.reh };
}
export { gauss };

// ---------- "Next goal": what is actually blocking, and for how long ----------
export interface Goal { id: string; blocker: 'slides' | 'cash' | 'h' | 'ready'; eta: number; need: number; have: number }
export function nextGoal(s: State, d: Derived): Goal | null {
  let best: Goal | null = null;
  for (const it of INITS) {
    if (s.own[it.id] || it.act > s.act || !visible(s, it)) continue;
    const c = costOf(s, it);
    const eS = c.slides > s.slides ? (c.slides - s.slides) / Math.max(d.slidesRate, 1e-6) : 0;
    const eC = c.cash > s.cash ? (d.pi > 1e-6 ? (c.cash - s.cash) / d.pi : Infinity) : 0;
    let g: Goal;
    if (it.id === 'memo' && humansAlive(s) > A1.END_H) g = { id: it.id, blocker: 'h', eta: Math.max(eS, eC, 30), need: A1.END_H, have: humansAlive(s) };
    else if (eS === 0 && eC === 0) g = { id: it.id, blocker: 'ready', eta: 0, need: 0, have: 0 };
    else if (eS >= eC) g = { id: it.id, blocker: 'slides', eta: eS, need: c.slides, have: s.slides };
    else g = { id: it.id, blocker: 'cash', eta: eC, need: c.cash, have: s.cash };
    if (!best || g.eta < best.eta || (g.eta === best.eta && g.blocker === 'ready' && best.blocker !== 'ready')) best = g;
  }
  return best;
}

// ---------- Strategic Deck: the sink for surplus Slides ----------
export const DECK = { CD: 15, VAL: 0.25, CAP_S: 90, MIN: 100 };
function deckKeep(s: State): number {
  let keep = 0;
  for (const it of INITS) if (!s.own[it.id] && it.act <= s.act && visible(s, it)) keep = Math.max(keep, costOf(s, it).slides);
  return keep;
}
/** What presenting the deck would do right now: slides spent and cash raised ("a Slide is worth 1/4 s of profit per Slide/s of income"). */
export function deckInfo(s: State, d: Derived) {
  const keep = deckKeep(s);
  const piRef = Math.max(s.act >= 2 ? Math.max(s.piS, s.piBase * 0.5) : s.piS, 1);
  const v = (DECK.VAL * piRef) / Math.max(d.slidesRate, 0.5);
  const surplus = Math.max(0, s.slides - keep);
  const gain = Math.min(surplus * v, DECK.CAP_S * piRef);
  const spend = v > 0 ? gain / v : 0;
  const cd = Math.max(0, DECK.CD - (s.t - (s.flags.deckAt ?? -1e9)));
  return { keep, surplus, spend, gain, cd, ok: s.own.stack && surplus >= DECK.MIN && cd <= 0 && s.act >= 1 && s.act <= 3, unlocked: !!s.own.stack };
}
export function presentDeck(s: State): string {
  const d = derive(s); const i = deckInfo(s, d);
  if (!i.unlocked) return 'locked'; if (i.cd > 0) return 'cd'; if (i.surplus < DECK.MIN) return 'none';
  s.slides -= i.spend; s.cash += i.gain; s.flags.deckAt = s.t; s.flags.deckN = (s.flags.deckN ?? 0) + 1;
  log(s, 'deck', { n: Math.round(i.spend), c: Math.round(i.gain * USD_PER_U) }, 'good');
  return '';
}

/** People actually on a tile (roles ≠ humans once the AI has done its quiet work). */
export function tileHumans(s: State, kappa: number, i: number): number {
  const tl = s.tiles[i]; if (!tl) return 0;
  return Math.max(0, tl.left + (tl.size - tl.left) * Math.max(0, 1 - kappa) + (i === 0 ? Math.max(s.hqExcess, -1000 * Math.max(0, 1 - kappa)) : 0));
}
