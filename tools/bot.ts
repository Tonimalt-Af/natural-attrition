import { initState, type State } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import { INITS, TICK, TIERS, RACKS, DAYS_PER_YEAR, A2 } from '../src/engine/data.ts';

export type Mode = 'greedy' | 'lazy' | 'idle';
export interface Run { s: State; marks: Record<string, number>; log: string[]; }

function cheapestFirst(s: State, ids: string[], cap = 1) {
  let n = 0;
  for (const id of ids) { if (S.canBuy(s, id) === '' && n < cap) { S.buy(s, id); n++; } }
}
const A1_ORDER = ['stack', 'macros', 'bus', 'consult', 'hotdesk', 'cip1', 'bots', 'fb360', 'earn', 'recog', 'chat', 'cip2', 'copilot', 'cip3', 'telemetry', 'memo'];

function act1(s: State, mode: Mode) {
  const d = S.derive(s);
  if (s.M < 0.7 && s.cash > 300 && mode === 'greedy') S.pizza(s);
  if (s.flags.lowM && s.M < 0.65) S.buy(s, 'wellness');
  if (s.flags.lawW) S.buy(s, 'legalhold');
  // buy in order (first affordable-in-sequence; don't skip ahead past unaffordable except cheap)
  for (const id of A1_ORDER) {
    if (s.own[id]) continue;
    const e = S.canBuy(s, id);
    if (e === '') { S.buy(s, id); }
    if (e === 'slides' || e === 'cash' || e === 'h') break;
  }
  // associates
  if (s.own.consult && s.assoc < 24 && s.slides < 150 && s.cash > S.assocCost(s) * 4) S.buyGen(s, 'assoc');
  // rehire
  if (s.own.consult && mode === 'greedy') for (const g of [...s.ghosts]) if (s.cash > 500) S.rehire(s, g);
  // cuts
  const thr = mode === 'greedy' ? 0.62 : 0.7;
  const xmax = mode === 'greedy' ? 58 : 45;
  const n = mode === 'greedy' ? 6 : 12;
  if (s.M > thr && s.X < xmax && d.humans > 400) S.wave(s, -1, n, 300);
  if (!s.own.memo && s.own.cip1 === undefined) void 0;
}

export function run(opts: { seed?: number; mode?: Mode; maxMin?: number; stopAct?: number; init?: Record<string, number>; every?: number; trace?: number; hook?: (s: State) => void } = {}): Run {
  const mode = opts.mode ?? 'greedy';
  const s = initState(opts.seed ?? 1, 'Alex', opts.init ?? {});
  const marks: Record<string, number> = {}; const lg: string[] = [];
  const every = opts.every ?? (mode === 'lazy' ? 45 : mode === 'idle' ? 1e9 : 1);
  let acc = every; const maxT = (opts.maxMin ?? 240) * 60;
  const seenOwn = new Set<string>(); let lastAct = 1;
  while (s.t < maxT && !s.ended) {
    S.step(s, TICK); acc += TICK; opts.hook?.(s);
    if (opts.trace && Math.abs(s.t / (opts.trace * 60) - Math.round(s.t / (opts.trace * 60))) < TICK / (opts.trace * 60) / 2) { const d = S.derive(s); const f = (x: number) => x.toExponential(2); console.log(`t=${(s.t / 60).toFixed(0)}m a${s.act} E=${f(d.E)} U=${f(s.U)} H=${f(d.humans)} cash=${f(s.cash)} debt=${f(s.debt)} pi=${f(d.pi)} piRep=${f(d.piRep)} mc=${f(d.mcRep)} m=${d.mTot.toFixed(1)} S=${s.S.toFixed(0)} F=${d.phiF.toFixed(2)} ab=${s.addback} ai=${d.ai} rc=${s.rc.join('/')} lam=${d.lambdaC.toFixed(2)} sl=${f(s.slides)}`); }
    if (acc >= every) { acc = 0; policy(s, mode); }
    for (const id in s.own) if (!seenOwn.has(id)) { seenOwn.add(id); marks['own:' + id] = s.t; }
    if (s.act !== lastAct) { lastAct = s.act; marks['act' + s.act] = s.t; if (opts.stopAct && s.act >= opts.stopAct) break; }
  }
  if (s.ended) marks['end'] = s.t;
  return { s, marks, log: lg };
}

function policy(s: State, mode: Mode) {
  if (mode === 'idle') return;
  if (s.act === 1) act1(s, mode);
  else if (s.act === 2 || s.act === 3) act23(s, mode);
  else act4(s, mode);
}
const A2_ORDER = ['lev1', 'ai1', 'partners', 'procure', 'ab1', 'statement', 'rainy', 'ai2', 'deck', 'guard1', 'ab2', 'lev2', 'ai3', 'aiwash', 'ai4', 'guard2', 'ab3', 'ai5', 'lev3', 'ai6', 'ab4'];
const A3_ORDER = ['bnpl', 'synth1', 'atm', 'secur', 'regcap', 'lights', 'synth2', 'engage'];
function act23(s: State, mode: Mode) {
  const d = S.derive(s);
  s.flags.debtFirst = 1;
  // initiatives
  if (s.act === 2) { for (const id of A2_ORDER) { const e = S.canBuy(s, id); if (e === '') S.buy(s, id); else if ((e === 'cash' || e === 'slides') && ['ai1','ai2','ai3','ai4','ai5','ai6','lev1','lev2','ab1','ab2'].includes(id) && id === A2_ORDER.find((x) => !s.own[x] && ['ai1','ai2','ai3','ai4','ai5','ai6','lev1','lev2','ab1','ab2'].includes(x))) break; } }
  else {
    const req = ['synth1', 'ai5', 'ai6', 'lights', 'synth2', ...(d.phi > 0.4 ? ['regcap'] : [])];
    let blocked = false;
    for (const id of req) { if (s.own[id]) continue; const e = S.canBuy(s, id); if (e === '') S.buy(s, id); else { blocked = true; break; } }
    if (!blocked) for (const id of ['atm', 'bnpl', 'secur', 'engage', 'ab3', 'ab4', 'lev3']) if (!s.own[id] && S.canBuy(s, id) === '') S.buy(s, id);
  }
  // restructuring capacity
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (s.U <= 0 || d.rcEff * 30 > s.U) break;
    for (let k = 0; k < 4; k++) {
      if (S.buyGen(s, 'rc', i) === '' ) {} else break;
      if (S.tierCost(s, i) > s.cash * 0.2) break;
    }
  }
  if (s.own.consult && s.partners < 30 && s.own.partners && s.cash > S.partnerCost(s) * 6) S.buyGen(s, 'partner');
  if (s.own.consult && s.assoc < 40 && s.cash > S.assocCost(s) * 8) S.buyGen(s, 'assoc');
  // racks
  if (s.act === 3) for (const i of [1, 0]) { while (S.rackCost(s, i) < s.cash * 0.5 && S.buyGen(s, 'rack', i) === '') {} }
  // add-backs
  const ab = S.abMax(s);
  const want = d.phiF > 0.55 ? Math.max(0, s.addback - 1) : d.phiF < 0.3 ? Math.min(ab, 3) : s.addback;
  S.setAddback(s, want);
  if (s.pendAudit) S.auditChoice(s, 'lunch');
  if (s.own.statement && s.S > 35 && s.slides > 100) S.statement(s, [S.moodNow(s), S.moodNow(s), S.moodNow(s)]);
  if (s.own.aiwash && mode === 'greedy') S.aiwash(s);
  S.setIntensity(s, s.S > 60 ? 0.7 : s.S < 20 ? 1.4 : 1);
  S.setGuidance(s, 1);
  // acquisitions
  if (s.act === 3) { const m = d.lambdaC; S.setMix(s, 0.1, m > 0.5 ? 0.1 : 0.3, m > 0.5 ? 0.8 : 0.6); }
  const ready = s.U < Math.max(0.2 * (s.U + s.I), 200) || d.rcEff * 20 > s.U;
  if (ready && (s.act === 2 || s.U + s.I < A2.N0 * 0.55 || s.own.regcap)) {
    const room = Math.max(0, d.debtCap * 0.75 - s.debt);
    let best = -1, bs = 0;
    for (const tg of s.targets) { const c = S.bidCost(s, d, tg.size); if (c <= room && tg.size > bs) { bs = tg.size; best = tg.id; } }
    if (best >= 0) S.bid(s, best);
  }
  if (s.debt > 0 && s.cash > s.debt * 3) S.repay(s);
  if (s.HD > 0 && S.derive(s).hdRatio > 0.55) S.securitize(s);
  if (s.act === 3 && s.lastCust === 0) void 0;
}
function act4(s: State, mode: Mode) {
  void mode; const st = s.a4;
  if (st.running) return;
  if (st.step === 4) S.a4Badge(s, 'A');
  else if (st.step === 6) S.a4Submit(s, 9);
  else S.a4Run(s);
}

const min = (x: number) => (x / 60).toFixed(1);
if (process.argv[1]?.endsWith('bot.ts')) {
  const mode = (process.argv[2] as Mode) || 'greedy';
  const r = run({ mode, maxMin: Number(process.argv[3] || 90), seed: Number(process.argv[4] || 1), trace: Number(process.argv[5] || 0) });
  const { s } = r; const d = S.derive(s);
  console.log(mode, 'seed', s.seed, 't=', min(s.t), 'min act', s.act, 'H', d.humans.toFixed(0), 'cash', s.cash.toFixed(0), 'pi', d.pi.toFixed(0), 'M', s.M.toFixed(2), 'X', s.X.toFixed(0), 'slides', s.slides.toFixed(0));
  for (const k in r.marks) console.log(k.padEnd(14), min(r.marks[k]));
}
