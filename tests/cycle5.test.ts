import { describe, expect, it } from 'vitest';
import { initState } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import * as V from '../src/engine/save.ts';
import { A1, A2, INITS, TICK } from '../src/engine/data.ts';
import { run } from '../tools/bot.ts';

const step = (s: ReturnType<typeof initState>, secs: number) => { for (let t = 0; t < secs; t += TICK) S.step(s, TICK); };

describe('next goal', () => {
  it('names the real blocker (cash vs slides vs headcount) and never says "now" while blocked', () => {
    const s = initState(1, 'T'); step(s, 30); expect(() => S.nextGoal(s, S.derive(s))).not.toThrow();
    const m = initState(1, 'T'); m.own.stack = 1; m.own.macros = 1; m.slides = 1e5; m.cash = 1e7; // everything but the Memo's headcount gate is affordable
    for (const it of INITS) if (it.act === 1 && it.id !== 'memo') m.own[it.id] = 1;
    m.dn[0] = A1.END_H + 40; for (let i = 1; i < m.dn.length; i++) m.dn[i] = 0; // END_H+40 people left: the Memo card appears, still blocked by headcount
    const gm = S.nextGoal(m, S.derive(m)); expect(gm?.id).toBe('memo'); expect(gm!.blocker).toBe('h'); expect(gm!.have).toBeGreaterThan(A1.END_H);
  });
});

describe('associates', () => {
  it('are capped per act', () => {
    const s = initState(1, 'T'); s.own.consult = 1; s.cash = 1e9;
    let r = ''; for (let i = 0; i < 100 && r === ''; i++) r = S.buyGen(s, 'assoc');
    expect(r).toBe('cap'); expect(s.assoc).toBe(A1.ASSOC_CAP);
  });
});

describe('Strategic Deck', () => {
  it('turns surplus Slides into capped cash, then cools down', () => {
    const s = initState(1, 'T'); s.own.stack = 1; step(s, 60); s.slides = 5e4;
    const c0 = s.cash; expect(S.presentDeck(s)).toBe(''); expect(s.cash).toBeGreaterThan(c0); expect(s.slides).toBeLessThan(5e4);
    expect(S.presentDeck(s)).toBe('cd');
  });
  it('does nothing without the unlock or without surplus', () => {
    const s = initState(1, 'T'); s.slides = 1e5; expect(S.presentDeck(s)).toBe('locked');
    const u = initState(1, 'T'); u.own.stack = 1; u.slides = 0; expect(S.presentDeck(u)).toBe('none');
  });
});

describe('Day-1 synergies and integration waves', () => {
  it('a closing cuts a slice at once, then several blocks integrate in parallel in steps', () => {
    let snap: { s: ReturnType<typeof initState>; log: number } | null = null; const seen: number[][] = []; let day1 = 0;
    run({ seed: 1, mode: 'greedy', maxMin: 120, hook: (s) => {
      if (s.act !== 2) return;
      if (s.flags.lastDay1 && !day1) day1 = s.flags.lastDay1;
      const live = s.tiles.filter((t) => t.left > 1);
      if (live.length >= 2 && (s.t * 10 | 0) % 200 === 0) seen.push(live.map((t) => Math.round(t.left)));
      if (!snap && s.flags.waveN > 3) snap = { s, log: s.flags.waveN };
    } });
    expect(day1).toBeGreaterThan(0);
    expect(snap, 'at least a few waves fired').not.toBeNull();
    // parallelism: at some sampled moment two or more blocks are mid-integration at once
    expect(seen.length).toBeGreaterThan(0);
  });
  it('day-1 fraction scales with intensity and stays inside its clamp', () => {
    const s = initState(1, 'T'); s.act = 2; s.intensity = 0.5; const lo = S.day1Frac(s); s.intensity = 2; const hi = S.day1Frac(s);
    expect(hi).toBeGreaterThan(lo); expect(lo).toBeGreaterThanOrEqual(0.3); expect(hi).toBeLessThanOrEqual(0.55);
    expect(A2.DAY1_BASE).toBeGreaterThan(0);
  });
  it('an HQ block reports fewer humans than roles once the AI has done its quiet work', () => {
    const r = run({ seed: 1, mode: 'greedy', maxMin: 200, stopAct: 3 }); const d = S.derive(r.s);
    expect(S.tileHumans(r.s, d.kappa, 0)).toBeLessThanOrEqual(r.s.tiles[0].size);
  });
});

describe('save migration v2 -> v3', () => {
  it('upgrades an Act II save with blocks mid-integration without losing them', () => {
    const r = run({ seed: 2, mode: 'greedy', maxMin: 200, stopAct: 3 }); void r;
    const run2 = run({ seed: 2, mode: 'greedy', maxMin: 40 }); const s = run2.s;
    expect(s.act).toBeGreaterThanOrEqual(2);
    const env = JSON.parse(V.serialize(s)); const body = JSON.parse(env.state);
    delete body.flags.waveAcc; delete body.flags.waveAt; body.v = 2;
    const old = JSON.stringify(body);
    const crc = V.serialize(Object.assign(s)); void crc; void old;
    const migrated = V.migrations[1](body) as { flags: Record<string, number>; tiles: unknown[] };
    expect(migrated.flags.waveAcc).toBe(0); expect(migrated.flags.waveAt).toBe(0); expect(migrated.tiles.length).toBe(s.tiles.length);
  });
  it('a migrated save keeps running', () => {
    const s = run({ seed: 2, mode: 'greedy', maxMin: 40 }).s; s.flags.waveAcc = undefined as unknown as number;
    for (let i = 0; i < 200; i++) S.step(s, TICK);
    expect(Number.isFinite(s.cash)).toBe(true); expect(Number.isFinite(s.U + s.I)).toBe(true);
  });
});

describe('Act III ORC wall', () => {
  const act3 = () => { const s = run({ seed: 1, mode: 'aggressive', maxMin: 200, stopAct: 3 }).s; return s; };
  it('canBid is pure and agrees with bid() about the reason', () => {
    const s = act3(); const d = S.derive(s); s.own.regcap = 0 as unknown as number; delete s.own.regcap;
    const tg = { ...s.targets[0], size: Math.round(0.6 * 150e6) };
    s.targets[0] = tg; s.cash = 1e15;
    const snap = JSON.stringify(s);
    expect(S.canBid(s, d, tg)).toBe('orc'); expect(JSON.stringify(s)).toBe(snap); // no mail, no mutation
    expect(S.bid(s, tg.id)).toBe('orc');
    s.own.regcap = 1; s.targets[0] = { ...tg, size: Math.round(0.6 * 150e6) };
    expect(S.canBid(s, S.derive(s), s.targets[0])).toBe('');
  });
  it('the Next goal points at Regulatory Capture when every bid is walled', () => {
    const s = act3(); delete s.own.regcap; const d = S.derive(s);
    s.targets = s.targets.map((tg) => ({ ...tg, size: Math.round(0.6 * 150e6) }));
    const g = S.nextGoal(s, d)!; expect(g.id).toBe('regcap'); expect(g.orc).toBe(true);
  });
  for (const mode of ['aggressive', 'clicky'] as const) it(`${mode} bot never sits behind the wall for more than 2.5 min`, () => {
    let blocked = 0, worst = 0;
    run({ seed: 1, mode, maxMin: 200, hook: (s) => {
      if (s.act !== 3) return; const d = S.derive(s);
      if (!s.own.regcap && s.targets.length && s.targets.every((tg) => S.canBid(s, d, tg) === 'orc')) { blocked += TICK; worst = Math.max(worst, blocked); } else blocked = 0;
    } });
    expect(worst / 60).toBeLessThanOrEqual(2.5);
  }, 60000);
});
