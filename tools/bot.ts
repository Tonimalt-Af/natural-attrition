import { initState, type State } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import { INITS, TICK, TIERS, A2, A3 } from '../src/engine/data.ts';

export type Mode = 'greedy' | 'lazy' | 'idle' | 'aggressive' | 'clicky';
const HUMANLIKE = (m: Mode) => m === 'aggressive' || m === 'clicky';
export interface Run { s: State; marks: Record<string, number>; log: string[]; }

function cheapestFirst(s: State, ids: string[], cap = 1) {
  let n = 0;
  for (const id of ids) { if (S.canBuy(s, id) === '' && n < cap) { S.buy(s, id); n++; } }
}
const A1_ORDER = ['stack', 'macros', 'bus', 'consult', 'hotdesk', 'cip1', 'bots', 'fb360', 'earn', 'recog', 'chat', 'cip2', 'copilot', 'cip3', 'telemetry', 'memo'];

function act1(s: State, mode: Mode) {
  const d = S.derive(s);
  if (s.M < (HUMANLIKE(mode) ? 0.5 : 0.7) && s.cash > 300 && (mode === 'greedy' || HUMANLIKE(mode))) S.pizza(s);
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
  // humans spam associates whenever they can afford one (they 'do something', right?)
  if (HUMANLIKE(mode) && s.own.consult) { let k = 0; while (k++ < 30 && s.cash > S.assocCost(s) * 1.5 && S.buyGen(s, 'assoc') === '') {} }
  if (mode === 'clicky') { for (const id of INITS.filter((i) => i.act === 1).map((i) => i.id)) if (!s.own[id] && S.canBuy(s, id) === '') S.buy(s, id); }
  // rehire
  if (s.own.consult && (mode === 'greedy' || mode === 'clicky')) for (const g of [...s.ghosts]) if (s.cash > 500) S.rehire(s, g);
  // cuts
  const H_ = HUMANLIKE(mode);
  const thr = H_ ? 0.35 : mode === 'greedy' ? 0.62 : 0.7;
  const xmax = H_ ? 85 : mode === 'greedy' ? 58 : 45;
  const n = H_ ? (mode === 'clicky' ? 10 : 20) : mode === 'greedy' ? 6 : 12;
  const floor = H_ ? 300 : 400;
  if (H_) {
    // humans save up for the thing they want: don't spend the severance money the next purchase needs
    let reserve = 0;
    for (const id of A1_ORDER) { if (s.own[id]) continue; const e = S.canBuy(s, id); if (e === 'cash' || e === '') { reserve = S.costOf(s, INITS.find((i) => i.id === id)!).cash; } break; }
    if (s.M > thr && s.X < xmax) {
      const cs = S.candidates(s, d, -1, false).filter((c) => c.pb <= 900).sort((a, b) => a.pb - b.pb);
      let k = 0; for (const c of cs) { if (k >= n || S.humansAlive(s) <= floor) break; if (s.cash < S.sevOf(s, c.i)) break; if (c.pb > 90 && s.cash - S.sevOf(s, c.i) < reserve) break; if (S.cut(s, c.i) === '') k++; }
    }
  } else if (s.M > thr && s.X < xmax && d.humans > floor) S.wave(s, -1, n, 300);
  if (!s.own.memo && s.own.cip1 === undefined) void 0;
}

export function run(opts: { seed?: number; mode?: Mode; maxMin?: number; stopAct?: number; init?: Record<string, number>; every?: number; trace?: number; hook?: (s: State) => void } = {}): Run {
  const mode = opts.mode ?? 'greedy';
  const s = initState(opts.seed ?? 1, 'Alex', opts.init ?? {});
  const marks: Record<string, number> = {}; const lg: string[] = [];
  const every = opts.every ?? (mode === 'lazy' ? 45 : mode === 'idle' ? 1e9 : mode === 'clicky' ? 0.5 : mode === 'aggressive' ? 2 : 1);
  let acc = every; const maxT = (opts.maxMin ?? 240) * 60;
  const seenOwn = new Set<string>(); let lastAct = 1;
  while (s.t < maxT && !s.ended) {
    S.step(s, TICK); acc += TICK; opts.hook?.(s);
    if (opts.trace && Math.abs(s.t / (opts.trace * 60) - Math.round(s.t / (opts.trace * 60))) < TICK / (opts.trace * 60) / 2) { const d = S.derive(s); const f = (x: number) => x.toExponential(2); console.log(`t=${(s.t / 60).toFixed(0)}m a${s.act} E=${f(d.E)} U=${f(s.U)} H=${f(d.humans)} cash=${f(s.cash)} debt=${f(s.debt)} pi=${f(d.pi)} piRep=${f(d.piRep)} mc=${f(d.mcRep)} m=${d.mTot.toFixed(1)} S=${s.S.toFixed(0)} F=${d.phiF.toFixed(2)} ab=${s.addback} ai=${d.ai} rc=${s.rc.join('/')} dm=${s.dm.toFixed(2)} conf=${s.conf.toFixed(2)} reh=${s.reh} sl=${f(s.slides)}`); }
    if (acc >= every) { acc = 0; policy(s, mode); }
    for (const id in s.own) if (!seenOwn.has(id)) { seenOwn.add(id); marks['own:' + id] = s.t; }
    if (s.act !== lastAct) { lastAct = s.act; marks['act' + s.act] = s.t; if (opts.stopAct && s.act >= opts.stopAct) break; }
  }
  if (s.ended) marks['end'] = s.t;
  return { s, marks, log: lg };
}

function policy(s: State, mode: Mode) {
  if (mode === 'idle') return;
  if (HUMANLIKE(mode) || mode === 'greedy') S.presentDeck(s);
  if (s.act === 1) act1(s, mode);
  else if (s.act === 2 || s.act === 3) act23(s, mode);
  else act4(s, mode);
}
const A2_ORDER = ['lev1', 'ai1', 'partners', 'procure', 'ab1', 'statement', 'rainy', 'ai2', 'deck', 'guard1', 'ab2', 'lev2', 'ai3', 'aiwash', 'ai4', 'guard2', 'ab3', 'ai5', 'lev3', 'ai6', 'ab4'];
const A3_ORDER = ['alumni', 'flex', 'store', 'ir'];
function act23(s: State, mode: Mode) {
  const d = S.derive(s);
  s.flags.debtFirst = 1;
  // initiatives
  if (s.act === 2) { for (const id of A2_ORDER) { const e = S.canBuy(s, id); if (e === '') S.buy(s, id); else if ((e === 'cash' || e === 'slides') && ['ai1','ai2','ai3','ai4','ai5','ai6','lev1','lev2','ab1','ab2'].includes(id) && id === A2_ORDER.find((x) => !s.own[x] && ['ai1','ai2','ai3','ai4','ai5','ai6','lev1','lev2','ab1','ab2'].includes(x))) break; } }
  else {
    for (const id of A3_ORDER) if (!s.own[id] && S.canBuy(s, id) === '') S.buy(s, id);
    for (const id of A2_ORDER) if (!s.own[id] && S.canBuy(s, id) === '' && !['lev1', 'lev2', 'lev3'].includes(id)) S.buy(s, id);
  }
  if (HUMANLIKE(mode)) { for (const it of INITS) if (it.act <= s.act && !s.own[it.id] && S.canBuy(s, it.id) === '' && !(it.id === 'aiwash') && !(it.id.startsWith('ab') && s.act < 3 && false)) S.buy(s, it.id); }
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
  const ready = s.U < Math.max(0.2 * (s.U + s.I), 200) || d.rcEff * 20 > s.U;
  if (ready && s.act === 2) {
    const room = Math.max(0, d.debtCap * 0.75 - s.debt);
    let best = -1, bs = 0;
    for (const tg of s.targets) { const c = S.bidCost(s, d, tg.size); if (c <= room && tg.size > bs) { bs = tg.size; best = tg.id; } }
    if (best >= 0) S.bid(s, best);
  }
  if (s.debt > 0 && s.cash > s.debt * 3) S.repay(s);
  if (s.act === 3) act3(s, mode);
}
/** Act III: pick the best value-for-the-Board people you can afford. Lazy batches, aggressive ignores the Board, the rest keep a confidence floor. */
function act3(s: State, mode: Mode) {
  if (S.finaleState(s) === '') { S.offerHead(s); return; }
  if (s.flags.finAt) return;
  const floor = mode === 'aggressive' ? 0 : mode === 'clicky' ? 0.47 : 0.5;
  if (mode === 'lazy' && s.own.alumni) { S.reengageBest(s, 25); return; }
  const list = S.pool3(s).map((i) => S.offer(s, i)).sort((a, b) => b.value - a.value);
  let k = 0;
  for (const o of list) {
    if (k >= (mode === 'lazy' ? 6 : 40)) break;
    const cur = S.offer(s, o.i);
    if (s.cash < cur.ret) break;
    if (s.conf - cur.pen < floor) break;
    if (S.reengage(s, o.i) === '') k++;
  }
}
function act4(s: State, mode: Mode) {
  void mode; const st = s.a4;
  if (st.running) return;
  if (st.step === 4) S.a4Badge(s, st.v === 2 ? 'A' : mode === 'lazy' ? 'A' : 'B');
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
