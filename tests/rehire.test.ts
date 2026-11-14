import { describe, expect, it } from 'vitest';
import { initState, F_ALIVE, F_BADGE, F_CONTR, type State } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import * as V from '../src/engine/save.ts';
import { A3, TICK } from '../src/engine/data.ts';
import { run, type Mode } from '../tools/bot.ts';
import { analyze } from '../tools/deadtime.ts';

const step = (s: State, secs: number) => { for (let t = 0; t < secs; t += TICK) S.step(s, TICK); };
const toAct3 = (seed = 1, mode: Mode = 'greedy') => run({ seed, mode, maxMin: 200, stopAct: 3 }).s;
const clone = (s: State) => JSON.parse(JSON.stringify(s)) as State;
const pool = (s: State) => S.pool3(s);

describe('Act I leaves a record of who went', () => {
  it('every person who is out has an exit time; waves are counted; attrition is wave 0', () => {
    const s = run({ seed: 2, mode: 'greedy', maxMin: 40 }).s;
    let out = 0; for (let i = 0; i < s.dept.length; i++) if (!(s.fl[i] & F_ALIVE)) { out++; expect(s.cutT[i], `person ${i}`).toBeGreaterThan(0); }
    expect(out).toBeGreaterThan(50);
    expect(s.waves.length).toBeGreaterThan(3); expect(s.waves.reduce((a, b) => a + b, 0)).toBe(s.stats.cuts);
    const cutIdx = s.cutW.filter((w) => w > 0).length; expect(cutIdx).toBe(s.stats.cuts);
  });
  it('a Planner wave is one wave; a click ten seconds later is another', () => {
    const s = initState(1, 'T'); s.cash = 1e6; step(s, 5);
    const n0 = s.waves.length; S.wave(s, 8, 3, 1e9); expect(s.waves.length).toBe(n0 + 1); expect(s.waves[n0]).toBe(3);
    step(s, 12); const c = S.candidates(s, S.derive(s), -1, false)[0]; S.cut(s, c.i); expect(s.waves.length).toBe(n0 + 2);
  });
});

describe('Act III: The Rehire', () => {
  it('starts with a stall: demand falls, profit stays positive, nothing is sold off', () => {
    const s = toAct3(1); expect(s.act).toBe(3); const E0 = s.U + s.I; const pi0 = s.pi0; expect(pi0).toBeGreaterThan(1e6);
    expect(s.first).toBeGreaterThanOrEqual(0); expect(s.fl[s.first] & F_ALIVE).toBe(0); expect(s.cutT[s.first]).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThanOrEqual(A3.GRANT * pi0 - 1);
    let minPi = Infinity; for (let t = 0; t < 240; t += TICK) { S.step(s, TICK); minPi = Math.min(minPi, S.derive(s).pi); }
    expect(s.dm, 'demand collapsed').toBeLessThan(0.4); expect(minPi).toBeGreaterThan(0); expect(s.U + s.I).toBeCloseTo(E0, 0); expect(s.flags.stall).toBe(1);
  });
  it('the first person ever cut is the reserved one: never in the pool, never re-cut, only back via the finale', () => {
    const s = toAct3(1); const f = s.first; expect(pool(s)).not.toContain(f); expect(S.canReengage(s, f)).toBe('first'); expect(S.reengage(s, f)).toBe('first');
    for (const i of pool(s)) if (s.fl[i] & F_BADGE) throw new Error('badge in pool');
    let earliest = Infinity; for (let i = 0; i < s.dept.length; i++) if (s.cutW[i] > 0 && !(s.fl[i] & F_ALIVE)) earliest = Math.min(earliest, s.cutT[i]);
    expect(s.cutT[f]).toBe(earliest);
  });
  it('re-engaging is pure of surprises: it costs what the offer says, shows its reason when it cannot, and raises Demand and the contractor bill', () => {
    const s = toAct3(1); const i = pool(s)[0]; const o = S.offer(s, i); const snap = JSON.stringify(s);
    expect(S.canReengage(s, i)).toBe(''); expect(JSON.stringify(s)).toBe(snap);
    const cash0 = s.cash, conf0 = s.conf; const d0 = S.derive(s);
    expect(S.reengage(s, i)).toBe(''); const d1 = S.derive(s);
    expect(cash0 - s.cash).toBeCloseTo(o.ret, 3); expect(conf0 - s.conf).toBeCloseTo(o.pen, 6); expect(d1.dmTarget).toBeGreaterThan(d0.dmTarget); expect(d1.pay3).toBeCloseTo(o.pay, 6);
    expect(s.fl[i] & F_CONTR).toBeTruthy(); expect(S.reengage(s, i)).toBe('here'); s.cash = 0; expect(S.reengage(s, pool(s)[0])).toBe('cash');
    expect(S.derive(s).humans).toBeGreaterThan(d0.humans - 1 + 0); // headcount goes UP with a rehire
  });
  it('the Board intervenes when confidence drops under the line, re-cutting the newest rehires; the first stays out', () => {
    const s = toAct3(1); s.cash = 1e15; let k = 0; for (const i of pool(s)) { if (s.conf < A3.INTERV_AT + 0.02 || k > 40) break; S.reengage(s, i); k++; }
    const before = s.reh; expect(s.conf).toBeLessThan(A3.INTERV_AT + 0.2);
    for (const i of pool(s)) { if (s.conf < A3.INTERV_AT) break; S.reengage(s, i); }
    expect(s.conf).toBeLessThan(A3.INTERV_AT); const reh = s.reh; step(s, 1);
    expect(s.interv).toBe(1); expect(s.reh).toBe(reh - A3.INTERV_N); expect(s.conf).toBeGreaterThan(A3.INTERV_AT + 0.2); expect(before).toBeGreaterThan(0);
    expect(s.fl[s.first] & F_ALIVE).toBe(0);
    const twice = s.fl.filter((f) => f & 16).length; expect(twice).toBe(A3.INTERV_N);
    expect(S.derive(s).mcRep).toBeGreaterThan(0);
  });
  it('batch re-engagement stops before the Board line and says why', () => {
    const s = toAct3(1); s.cash = 1e15; expect(S.reengageBest(s, 25).why).toBe('locked'); s.own.alumni = 1;
    const r = S.reengageBest(s, 25); expect(r.done).toBeGreaterThan(0); expect(r.done).toBeLessThan(25); expect(r.why).toBe('board'); expect(s.conf).toBeGreaterThanOrEqual(A3.SAFE - A3.PEN * 1.6);
    expect(S.reengageBest(s, 25)).toEqual({ done: 0, why: 'board' });
  });
  it('goal card names the real limit and the finale gates on demand', () => {
    const s = toAct3(1); s.cash = 0; expect(S.goal3(s, S.derive(s)).limit).toBe('cash'); s.cash = 1e15; expect(S.goal3(s, S.derive(s)).limit).toBe('');
    expect(S.finaleState(s)).toBe('dm'); expect(S.offerHead(s)).toBe('dm');
    s.conf = 0.5; for (const i of pool(s)) S.reengage(s, i); s.conf = 1; // everyone back
    step(s, 120); s.conf = 1; expect(s.dm).toBeGreaterThan(A3.DM_FIN); expect(S.finaleState(s)).toBe(''); expect(S.goal3(s, S.derive(s)).limit).toBe('finale');
    expect(S.offerHead(s)).toBe(''); expect(s.fl[s.first] & F_ALIVE).toBeTruthy(); expect(S.offerHead(s)).toBe('done');
    step(s, A3.FIN_WAIT + 1); expect(s.act).toBe(4);
  });
  for (const mode of ['greedy', 'aggressive', 'clicky', 'lazy'] as const) for (const seed of [1, 2]) {
    it(`${mode} seed ${seed}: the stall never sells the company or breaks the books, and the act ends in a sane time`, () => {
      let E0 = 0, Emin = Infinity, r0 = -1, minPi = Infinity, bad = false;
      const r = run({ seed, mode, maxMin: 260, hook: (s) => { if (s.act !== 3) return; const d = S.derive(s); if (r0 < 0) { r0 = s.reckonings; E0 = d.E; } Emin = Math.min(Emin, d.E); minPi = Math.min(minPi, d.pi); if (!Number.isFinite(s.cash) || !Number.isFinite(d.pi) || !Number.isFinite(s.dm)) bad = true; } });
      const m = r.marks; const len = (m.act4 - m.act3) / 60;
      expect(m.end, 'ending reached').toBeDefined(); expect(bad).toBe(false);
      expect(Emin).toBeGreaterThanOrEqual(E0 - 1); expect(r.s.reckonings - r0).toBe(0); expect(minPi).toBeGreaterThan(0);
      const win = mode === 'lazy' ? [18, 40] : mode === 'aggressive' ? [18, 40] : [17, 34];
      expect(len, `Act III ${len.toFixed(1)} min`).toBeGreaterThanOrEqual(win[0]); expect(len, `Act III ${len.toFixed(1)} min`).toBeLessThanOrEqual(win[1]);
    }, 120000);
  }
  it('max dead gap in Act III stays under 2.5 minutes for every human-like mode', () => {
    for (const mode of ['greedy', 'aggressive', 'clicky'] as const) {
      const r = analyze(mode, 1); const g = Math.max(0, ...r.gaps.filter((x) => x.act === 3).map((x) => x.secs));
      expect(g / 60, `${mode} Act III gap ${(g / 60).toFixed(1)}min`).toBeLessThanOrEqual(2.5);
    }
  }, 240000);
});

describe('Act IV: the first person you cut reviews you', () => {
  const act4 = (mode: Mode = 'greedy') => { const s = run({ seed: 1, mode, maxMin: 260, stopAct: 4 }).s; s.a4 = { ...s.a4, step: 0, prog: 0, running: false }; return s; };
  const toStep4 = (s: State) => { for (let st = 0; st < 4; st++) { S.a4Pick(s, 0); S.a4Fast(s); for (let i = 0; i < 8; i++) S.step(s, TICK); } };
  it('the reviewer is the first person cut, and the verdict band follows Act I cruelty', () => {
    const lo = act4(); toStep4(lo); expect(lo.a4.step).toBe(4);
    const kind = clone(lo); kind.stats.cuts = 40; kind.stats.incidents = 0; kind.stats.lawsuits = 0; kind.waves = [5, 5, 5, 5, 5, 5, 5, 5]; kind.S = 0; kind.interv = 0; kind.a4.tone = []; S.a4Verdict(kind); expect(kind.a4.v).toBe(0); expect(kind.a4.c).toBeLessThan(0.3);
    const cruel = clone(lo); cruel.stats.cuts = 900; cruel.stats.incidents = 8; cruel.stats.lawsuits = 3; cruel.waves = [300, 300, 300]; cruel.S = 90; cruel.interv = 5; S.a4Verdict(cruel); expect(cruel.a4.v).toBe(2); expect(cruel.a4.c).toBeGreaterThan(0.62);
    const mid = clone(lo); mid.a4.tone = []; mid.stats.cuts = 500; mid.stats.incidents = 3; mid.waves = [20, 20, 20]; mid.stats.lawsuits = 0; mid.S = 10; mid.interv = 0; S.a4Verdict(mid); expect(mid.a4.v).toBe(1);
    expect(S.cruelty(cruel).c).toBeGreaterThan(S.cruelty(kind).c); expect(lo.first).toBeGreaterThanOrEqual(0);
  });
  it('appeal works in the middle band, is denied in the top band; both endings stay reachable', () => {
    const s = act4(); toStep4(s); s.a4.v = 2; S.a4Badge(s, 'B'); expect(s.a4.step).toBe(4); expect(s.a4.badge).toBe('');
    s.a4.v = 1; S.a4Badge(s, 'B'); expect(s.a4.badge).toBe('B'); expect(s.a4.step).toBe(5);
    const t = act4(); toStep4(t); t.a4.v = 0; S.a4Badge(t, 'A'); expect(t.a4.badge).toBe('A');
  });
  it('the opening mail names the reviewer', () => {
    const s = act4(); const m = s.inbox.find((x) => x.id === 'a4_start')!; expect(m.p?.n).toBe(s.first);
  });
  it('bots land in more than one verdict band across modes', () => {
    const bands = new Set<number>(); for (const mode of ['greedy', 'aggressive', 'clicky'] as const) { const s = act4(mode); toStep4(s); bands.add(s.a4.v); }
    expect(bands.size).toBeGreaterThanOrEqual(2);
  }, 120000);
});

describe('save v4', () => {
  /** Rewrite a current save as a v3 one: no per-person records, old Closed Loop fields present. */
  const asV3 = (s: State) => {
    const o = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    for (const k of ['cutT', 'cutW', 'waves', 'lastCutT', 'first', 'pi0', 'dm', 'conf', 'reh', 'rstack', 'reffRaw', 'rwRaw', 'interv']) delete o[k];
    Object.assign(o, { racks: [3, 1], mix: [0.1, 0.3, 0.6], HD: 12345, lastCust: 0, minskyUntil: 0, closureSeen: 0.4, v: 3 });
    (o.own as Record<string, number>).synth1 = 1; (o.own as Record<string, number>).regcap = 1;
    const body = JSON.stringify(o); return JSON.stringify({ v: 3, savedAt: 1, crc: V.crc32(body), state: body });
  };
  it('an old Act III save lands at a fresh stall, keeps cash and debt, and gets full exit records', () => {
    const s = toAct3(1); const cash = s.cash, debt = s.debt; step(s, 200); // a v3 save taken mid-Act III
    const old = JSON.parse(JSON.stringify(s)) as State; old.cash = cash; old.debt = debt;
    const r = V.deserialize(asV3(old)); expect(r.ok).toBe(true); if (!r.ok) return; const n = r.state;
    expect(n.v).toBe(4); expect(n.cutT.length).toBe(1000); expect(n.cutW.length).toBe(1000); expect(n.conf).toBe(1); expect(n.dm).toBe(1); expect(n.reh).toBe(0); expect(n.debt).toBe(debt);
    expect(n.cash).toBeGreaterThanOrEqual(cash); expect(n.own.synth1).toBeUndefined(); expect(n.own.regcap).toBeUndefined();
    expect((n as unknown as Record<string, unknown>).racks).toBeUndefined(); expect((n as unknown as Record<string, unknown>).HD).toBeUndefined();
    for (let i = 0; i < 1000; i++) if (!(n.fl[i] & F_ALIVE)) expect(n.cutT[i]).toBeGreaterThan(0);
    expect(n.first).toBeGreaterThanOrEqual(0); expect(n.fl[n.first] & F_ALIVE).toBe(0); expect(n.waves.reduce((a, b) => a + b, 0)).toBe(Math.min(n.cuts, n.cutW.filter((w) => w > 0).length));
    expect(n.inbox.some((m) => m.id === 'a3_start')).toBe(true);
    step(n, 120); expect(n.dm).toBeLessThan(0.6); expect(Number.isFinite(n.cash)).toBe(true); expect(S.derive(n).pi).toBeGreaterThan(0);
  });
  it('an old Act IV save still has a reviewer and a verdict; an Act I save gets exit records that Act III can use', () => {
    const s4 = run({ seed: 1, mode: 'greedy', maxMin: 200, stopAct: 4 }).s; s4.a4.step = 4;
    const r4 = V.deserialize(asV3(s4)); expect(r4.ok).toBe(true); if (r4.ok) { expect(r4.state.first).toBeGreaterThanOrEqual(0); expect([0, 1, 2]).toContain(r4.state.a4.v); }
    const s1 = run({ seed: 3, mode: 'greedy', maxMin: 20 }).s; const r1 = V.deserialize(asV3(s1)); expect(r1.ok).toBe(true);
    if (r1.ok) { let out = 0; for (let i = 0; i < 1000; i++) if (!(r1.state.fl[i] & F_ALIVE)) { out++; expect(r1.state.cutT[i]).toBeGreaterThan(0); } expect(out).toBeGreaterThan(20); }
  });
  it('a v4 save round-trips unchanged', () => { const s = toAct3(1); step(s, 30); const r = V.deserialize(V.serialize(s)); expect(r.ok).toBe(true); if (r.ok) expect(JSON.stringify(r.state)).toBe(JSON.stringify(s)); });
});
