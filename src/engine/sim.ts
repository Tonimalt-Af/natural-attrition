import { A1, A2, A3, AUTO_DEPTS, CIP_RATE, CULTURES, DAYS_PER_YEAR, DEPTS, G_BEAT, G_MISS, GUIDANCE, INITS, INIT_BY_ID, NDEPT, NOISE, QUARTER, RACKS, STATEMENT, A4, TICK, TIERS, USD_PER_U, type Init } from './data.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER, type P, type State, type Tile, type Target } from './state.ts';
import { gauss, hashGauss, next } from './rng.ts';
import { targetName } from './names.ts';

export const AI_LEVELS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0];
export interface Derived {
  q: number; Ld: number[]; R: number; pay: number; oh: number; pi: number; piRep: number; H: number; incPen: number;
  slidesRate: number; mTot: number; mRep: number; mcRep: number; mcReal: number; phi: number; E: number; kappa: number;
  leak: number; dm: number; lambdaC: number; rcEff: number; ai: number; debtCap: number; humans: number; rackYield: number;
  credit: number; retain: number; creditShare: number; synthShare: number; phiF: number; lights: number; levMax: number; price: number; stockF: number;
  abMax: number; hdRatio: number; upkeep: number;
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
export const rackCost = (s: State, i: number) => RACKS[i].mins * 60 * Math.max(s.piBase, 1e3) * RACKS[i].rate ** s.racks[i];
export const humansAlive = (s: State) => s.dn.reduce((a, b) => a + b, 0);

export function mixNorm(s: State) {
  const c = s.own.bnpl ? s.mix[1] : 0; const t = s.mix[0] + c + s.mix[2] || 1;
  return [s.mix[0] / t, c / t, s.mix[2] / t];
}

export function derive(s: State): Derived {
  const ai = aiLevel(s);
  const lights = s.own.lights ? 1 : 0;
  const mix = mixNorm(s);
  const retain = s.act >= 3 ? mix[0] : 0;
  const creditShare = s.act >= 3 && s.own.bnpl ? mix[1] : 0;
  const synthShare = s.act >= 3 ? mix[2] : 0;
  // Incidents/hallucinations eat a share of *profit* (plus a sliver of revenue), so a thin early margin never turns into a death spiral.
  const incPen = (s.t < s.incUntil ? A1.INC_PEN : 0) + (s.t < s.hallUntil ? A1.HAL_PEN * 3 : 0);
  const slumpF = (s.t < s.slumpUntil ? s.slump : 1) * (s.S > 60 ? 0.9 : 1);
  const E = s.act === 1 ? humansAlive(s) : s.U + s.I;
  const phi = s.act === 1 ? 0 : E / A2.N0;
  const d = { ai, lights, retain, creditShare, synthShare, E, phi } as Partial<Derived>;
  d.levMax = levMax(s); d.abMax = abMax(s);
  d.phiF = s.F / (Math.max(s.piS, s.piBase * 0.25, 1) * DAYS_PER_YEAR);
  d.price = A2.P0 * (Math.max(E, 1000) / 1000) ** A2.P_EXP / (1 - Math.min(phi, 0.995)) ** (s.act >= 3 ? 1.0 : 0.5) * (s.opt.rolodex ? 0.95 : 1);
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
    return Object.assign(d, { q, Ld, R, pay: s.pay + s.contrPay, oh, pi, piRep: pi, H, humans: H, incPen, slidesRate: slidesRate * (s.opt.tmpl ? 1.25 : 1), mRep: mTot0, mcRep: mcReal, mcReal, kappa: 0, leak: 0, dm: 1, lambdaC: 0, rcEff: 0, debtCap: 0, rackYield: 0, credit: 0, hdRatio: 0, upkeep }) as Derived;
  }
  const kappaE = A2.KAPPA + A2.KAPPA_AI * ai + A2.KAPPA_LIGHTS * lights; // economic automation share (Closed Loop)
  // Human automation share (what the player sees): integrated roles keep few humans, Colleagues shrink it, Lights-Out ends it.
  const kappa = Math.min(1, A2.HUM_KAPPA + A2.HUM_KAPPA_AI * ai + A2.HUM_KAPPA_LIGHTS * lights);
  const base = A2.PI_U * s.U + (A2.PI_I + A2.PI_AI * ai + A2.PI_LIGHTS * lights) * s.I;
  const C = s.I * kappaE;
  const Ceff = C * (1 - 0.5 * retain);
  const leak = A3.EPS * phi * phi * Ceff;
  const c = A3.CREDIT_MAX * creditShare;
  const credit = c * 1.2 * E;
  const synthMul = (0.3 + 1.4 * synthShare) * (s.own.engage ? 2 : 1);
  const rackYield = s.act >= 3 ? (s.racks[0] * RACKS[0].frac + s.racks[1] * RACKS[1].frac) * Math.max(s.piBase, 1e3) * synthMul : 0;
  const retainCost = 0.5 * retain * C;
  const upkeep = A1.ASSOC_UPKEEP * s.assoc + A1.PARTNER_UPKEEP * s.partners + A3.RACK_UPKEEP * rackYield + retainCost;
  const interest = s.debt * A2.INTEREST;
  const gross = base - leak + credit;
  const hal = s.t < s.hallUntil ? 1 - A1.HAL_PEN : 1;
  const pi = gross * slumpF * hal - upkeep - interest;
  const a = A2.ADDBACK[s.addback];
  const piRep = pi + a * Math.max(pi, 0) + rackYield;
  const lambdaC = rackYield > 0 ? rackYield / (Math.max(pi, 0) + rackYield) : 0;
  let mRep = mTot0;
  if (s.act >= 3) mRep = mTot0 + (400 * Math.max(0, lambdaC - 0.5) ** 2) / (1.0001 - lambdaC);
  const rcEff = TIERS.reduce((a2, t, i) => a2 + t.yield * s.rc[i], 0) * s.intensity;
  const humans = Math.max(0, s.U + s.I * Math.max(0, 1 - kappa) + Math.max(s.hqExcess, -1000 * Math.max(0, 1 - kappa)));
  return Object.assign(d, {
    q: 1, Ld: [], R: 0, pay: 0, oh: 0, pi, piRep, H: humans, incPen, kappa, leak, dm: 1 - leak / Math.max(1.2 * E, 1) + c, lambdaC,
    rcEff, debtCap: levMax(s) * Math.max(s.piRepS, 0) * DAYS_PER_YEAR, humans, rackYield, credit,
    slidesRate: ((A1.SLIDES_BASE + A1.ASSOC_SLIDES * s.assoc + A1.PARTNER_SLIDES * s.partners + (s.own.deck ? 40 * ai : 0)) * (s.opt.tmpl ? 1.25 : 1)),
    mRep, mcRep: Math.max(s.piRepS, 0) * DAYS_PER_YEAR * mRep * USD_PER_U, mcReal: Math.max(s.piS, 0) * DAYS_PER_YEAR * mTot0 * USD_PER_U,
    hdRatio: s.HD / (A2.N0 * DAYS_PER_YEAR), upkeep,
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
export function cut(s: State, i: number): string {
  const e = canCut(s, i); if (e) return e;
  const keeper = !!(s.fl[i] & F_KEEPER);
  s.cash -= sevOf(s, i) * (keeper && mapped(s) ? 5 : 1);
  kill(s, i);
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
  let done = 0;
  for (const c of cs) { if (done >= n) break; if (cut(s, c.i) === '') done++; else break; }
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
      kill(s, pick); s.stats.cuts += 0;
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
  if (it.act < s.act && !s.own[it.id]) return it.act === 1 && s.act >= 2 ? false : true;
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
    case 'phi40': return s.act >= 3 && E / A2.N0 >= 0.4;
    case 'phi30': return s.act >= 3 && E / A2.N0 >= 0.3;
  }
  return true;
}
export function costOf(s: State, it: Init) {
  const pity = s.t - s.lastBuyT > 600 ? 0.8 : 1;
  const cash0 = it.cashMin ? it.cashMin * 60 * Math.max(s.act >= 2 ? Math.max(s.piBase, s.piS) : s.piS, 1) : it.cash;
  // "Value-based pricing": nothing ever costs more than a few minutes of what you are actually earning, so a fast player never sits out a flat price.
  const piRef = s.act >= 2 ? Math.max(s.piS, s.piBase * 0.5) : s.piS;
  const cash = it.cashMin || piRef < PRICE_MIN_PI ? cash0 : Math.min(cash0, Math.max((s.act >= 2 ? PRICE_CAP_MIN_2 : PRICE_CAP_MIN) * 60 * piRef, 0));
  // Act I price lock: once quoted, a price never goes up (otherwise it chases your income and you never catch it).
  let locked = cash;
  if (s.act === 1 && !it.cashMin) { const pl = (s.pl ||= {}); locked = Math.min(pl[it.id] ?? Infinity, cash); if (!s.own[it.id] && visible(s, it)) pl[it.id] = locked; }
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
  if (id === 'regcap') mail(s, 'a3_regcap');
  if (id === 'earn') mail(s, 'a1_earn');
  if (id === 'copilot') mail(s, 'a1_copilot');
  if (id === 'ab1') { s.addback = 1; mail(s, 'a2_ab1'); }
  if (id === 'statement') mail(s, 'a2_stmt');
  if (id === 'bnpl') mail(s, 'a3_bnpl');
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
  if (kind === 'rack') {
    if (s.act < 3) return 'locked'; if (idx === 0 && !s.own.synth1) return 'locked'; if (idx === 1 && !s.own.synth2) return 'locked';
    const c = rackCost(s, idx); if (s.cash < c) return 'cash'; s.cash -= c; s.racks[idx]++; s.lastBuyT = s.t; return '';
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
function startAct3(s: State) {
  s.act = 3; s.actT[1] = s.t;
  mail(s, 'a3_orc'); log(s, 'act3', undefined, 'good');
}
function startAct4(s: State) {
  s.act = 4; s.actT[2] = s.t; s.a4 = { step: 0, prog: 0, running: false, tone: [], badge: '', nps: 7, sun: 0, fast: 0 };
  mail(s, 'a4_start'); log(s, 'act4', undefined, 'good');
}

// ---------- Act II+ actions ----------
export function day1Frac(s: State) { return clamp(A2.DAY1_BASE + A2.DAY1_INT * s.intensity, 0.3, 0.55); }
export function bidCost(s: State, d: Derived, size: number) { return size * d.price * d.stockF; }
/** Pure check (no side effects): why a bid on this target cannot go through right now ('' = it can). */
export function canBid(s: State, d: Derived, tg: Target): '' | 'act' | 'orc' | 'cap' | 'cash' {
  if (s.act < 2 || s.act > 3) return 'act';
  if (s.act === 3 && !s.own.regcap && (s.U + s.I + tg.size) / A2.N0 > A3.ORC_PHI) return 'orc';
  if (s.U + s.I + tg.size > A2.N0 * 0.995) return 'cap';
  const cost = bidCost(s, d, tg.size); const room = Math.max(0, d.debtCap - s.debt);
  if (s.cash + room * 0.9 < cost) return 'cash';
  return '';
}
export function bid(s: State, targetId: number): string {
  if (s.act < 2 || s.act > 3) return 'act';
  const ti = s.targets.findIndex((t) => t.id === targetId); if (ti < 0) return 'none';
  const d = derive(s); const tg = s.targets[ti];
  const why = canBid(s, d, tg);
  if (why === 'orc') { mail(s, 'a3_orc_block'); return 'orc'; }
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
export function setMix(s: State, r: number, c: number, y: number) { s.mix = [Math.max(0, r), Math.max(0, c), Math.max(0, y)]; }
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
export function securitize(s: State): string {
  if (!s.own.secur) return 'locked'; const gain = 0.5 * s.HD; if (gain <= 0) return 'none';
  s.cash += gain; s.HD *= 0.5; s.minskyUntil = s.t + 600; s.S = Math.min(100, s.S + 10); log(s, 'securitize'); return '';
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
export function a4Badge(s: State, ch: 'A' | 'B') { if (s.act === 4 && s.a4.step === 4) { s.a4.badge = ch; s.a4.step = 5; s.a4.prog = 0; s.a4.running = false; log(s, 'badge_' + ch); } }
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
  const mv = Math.min(s.U, (d.rcEff / A2.KAPPA) * dt * (off ? 0.5 : 1));
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
  if (off) { s.S = Math.max(0, s.S - 0); if (s.act === 3) { s.HD *= 1; } return; }
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
  if (hz > 0 && next(s) < 1 - Math.exp(-hz * dt)) reckoning(s, d);
  // audits
  const next_ = A2.AUDIT_FIRST * 10 ** s.auditMark;
  if (!s.pendAudit && d.mcRep >= next_ && s.auditMark < 4) { s.auditMark++; s.pendAudit = s.t + 120; mailAny(s, 'a2_audit'); }
  if (s.pendAudit && s.t > s.pendAudit) auditChoice(s, 'ignore');
  // debt: covenant
  if (s.debt > d.debtCap * 1.05) {
    const pay = Math.min(s.debt - d.debtCap, Math.max(0, d.pi) * 0.5 * dt + Math.max(0, s.cash) * 0.01 * dt);
    s.debt -= pay; s.cash -= Math.min(pay, s.cash);
    if (!s.flags.cov) { s.flags.cov = 1; mail(s, 'a2_covenant'); }
    if (s.debt > d.debtCap * 1.5 && s.cash < 60 * Math.abs(d.pi) + 1) {
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
  mail(s, 'a3_leak');
  if (s.own.atm) { s.cash += A3.ATM * Math.max(s.piRepS, 0) * DAYS_PER_YEAR * d.mTot * USD_PER_U * dt; s.mMul *= Math.exp(-A3.ATM * 40 * dt); }
  // household debt & Minsky
  const c = A3.CREDIT_MAX * d.creditShare;
  s.HD += (c * 1.2 * d.E * A3.HD_ACC - A3.HD_DECAY * s.HD) * dt;
  const rho = d.hdRatio;
  if (rho > 0.5) mail(s, 'a3_minsky_warn');
  if (rho > A3.MINSKY_FROM && s.t > s.minskyUntil) {
    const h = (A3.MINSKY_H * (rho - A3.MINSKY_FROM)) / 0.2;
    if (next(s) < 1 - Math.exp(-h * dt)) { s.HD *= 0.4; s.slump = 0.4; s.slumpUntil = s.t + 300; s.mMul *= 0.65; s.flags.minsky = (s.flags.minsky || 0) + 1; log(s, 'minsky', undefined, 'bad'); mail(s, 'a3_minsky'); }
  }
  // closure events
  if (d.lambdaC >= 0.5) mail(s, 'a3_closure50');
  if (d.lambdaC >= 0.8 && !s.lastCust) { s.lastCust = 1; s.flags.lcAt = s.t; log(s, 'lastcust', undefined, 'good'); mail(s, 'a3_lastcust'); }
  if (s.lastCust === 1 && s.t > s.flags.lcAt + 20) s.lastCust = 2;
  s.closureSeen = Math.max(s.closureSeen, d.lambdaC);
  if (d.lambdaC >= A3.CLOSURE && d.humans <= A3.HUMANS_END * s.peakH && s.lastCust === 2) startAct4(s);
}
function stepAct4(s: State, dt: number) {
  const st = s.a4;
  if (st.running) {
    st.prog += dt;
    const need = st.step === 5 ? A4.SUNSET : A4.ANALYSIS;
    if (st.prog >= need) {
      st.running = false; st.prog = 0;
      if (st.step === 5) { st.step = 6; } else st.step++;
      log(s, 'a4_step' + (st.step - 1));
      mailAny(s, 'a4_r' + (st.step - 1));
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
  return { t: s.t, act: s.act, H: d.humans, cash: s.cash, pi: d.pi, mc: d.mcRep, M: s.M, X: s.X, S: s.S, E: d.E, phi: d.phi, lambdaC: d.lambdaC };
}
export { gauss };

// ---------- "Next goal": what is actually blocking, and for how long ----------
export interface Goal { id: string; blocker: 'slides' | 'cash' | 'h' | 'ready'; eta: number; need: number; have: number; orc?: boolean }
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
  // Every target is walled off by the Office of Reasonable Concern: the real next goal is whatever removes the wall.
  if (s.act === 3 && !s.own.regcap && s.targets.length && s.targets.every((tg) => canBid(s, d, tg) === 'orc')) {
    const it = INITS.find((x) => x.id === 'regcap')!; const c = costOf(s, it);
    const eS = c.slides > s.slides ? (c.slides - s.slides) / Math.max(d.slidesRate, 1e-6) : 0;
    const eC = c.cash > s.cash ? (d.pi > 1e-6 ? (c.cash - s.cash) / d.pi : Infinity) : 0;
    if (eS === 0 && eC === 0) return { id: it.id, blocker: 'ready', eta: 0, need: 0, have: 0, orc: true };
    return eS >= eC ? { id: it.id, blocker: 'slides', eta: eS, need: c.slides, have: s.slides, orc: true } : { id: it.id, blocker: 'cash', eta: eC, need: c.cash, have: s.cash, orc: true };
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
