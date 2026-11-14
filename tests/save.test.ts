import { describe, expect, it } from 'vitest';
import { initState } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import { TICK } from '../src/engine/data.ts';
import * as V from '../src/engine/save.ts';
import { num, int, usd, clock, eta, tpl, pct, setFmt } from '../src/engine/format.ts';

class Mem implements V.KV {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const played = (secs = 120, seed = 3) => { const s = initState(seed, 'Tester'); for (let t = 0; t < secs; t += TICK) S.step(s, TICK); return s; };

describe('save system', () => {
  it('round-trips state exactly', () => {
    const s = played();
    const r = V.deserialize(V.serialize(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
  });
  it('a loaded save continues identically to the original (determinism through saves)', () => {
    const a = played(60); const r = V.deserialize(V.serialize(a)); if (!r.ok) throw new Error('load');
    const b = r.state;
    for (let i = 0; i < 400; i++) { S.step(a, TICK); S.step(b, TICK); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('detects corruption via CRC', () => {
    const txt = V.serialize(played(20));
    const env = JSON.parse(txt); env.state = env.state.replace('"cash":', '"cash":9');
    expect(V.deserialize(JSON.stringify(env)).ok).toBe(false);
    expect(V.deserialize('not json').ok).toBe(false);
  });
  it('rejects saves from the future', () => {
    const env = JSON.parse(V.serialize(played(5))); env.v = 999;
    const r = V.deserialize(JSON.stringify(env)); expect(r.ok).toBe(false);
  });
  it('restores from a rolling backup when the main slot is corrupt', () => {
    const kv = new Mem(); const s = played(30);
    V.save(kv, s, true); S.step(s, TICK); V.save(kv, s, true);
    kv.setItem(V.KEY, '{"v":1,"crc":0,"state":"garbage"}');
    const { res, restored } = V.load(kv);
    expect(res.ok).toBe(true); expect(restored).toBe(true);
  });
  it('fills missing fields from a fresh state (forward compatible)', () => {
    const s = played(10) as unknown as Record<string, unknown>;
    const o = JSON.parse(JSON.stringify(s)); delete o.piBase; delete o.closureSeen; delete o.flags;
    const body = JSON.stringify(o);
    const env = { v: 1, savedAt: 0, crc: V.crc32(body), state: body };
    const r = V.deserialize(JSON.stringify(env));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(typeof r.state.piBase).toBe('number'); expect(r.state.flags).toBeTypeOf('object'); S.step(r.state, TICK); }
  });
  it('export/import round-trips (gzip and plain)', async () => {
    const s = played(40);
    const g = await V.exportText(s); expect(g.startsWith('G1.')).toBe(true);
    const r = await V.importText(g); expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
    const p = 'P1.' + g.slice(3); // wrong payload for plain => must fail gracefully
    expect((await V.importText(p)).ok).toBe(false);
    expect((await V.importText('hello')).ok).toBe(false);
  });
  it('meta/opts survive and default safely', () => {
    const kv = new Mem(); expect(V.loadMeta(kv).endings).toEqual([]);
    const m = V.defaultMeta(); m.endings.push('A'); m.opts.stable = true; V.saveMeta(kv, m);
    const l = V.loadMeta(kv); expect(l.endings).toEqual(['A']); expect(l.opts.stable).toBe(true); expect(l.opts.text).toBe(100);
    kv.setItem(V.META_KEY, '{broken'); expect(V.loadMeta(kv).endings).toEqual([]);
  });
});

describe('offline progress', () => {
  it('ignores short absences', () => { expect(V.applyOffline(played(10), 30_000)).toBeNull(); });
  it('is capped and deposits an Out of Office mail', () => {
    const s = played(300); const m0 = s.inbox.length;
    const rep = V.applyOffline(s, 40 * 3600 * 1000, 8);
    expect(rep).not.toBeNull(); expect(rep!.capped).toBe(true); expect(rep!.secs).toBe(8 * 3600);
    expect(s.inbox.length).toBeGreaterThan(m0);
  });
  it('never triggers hazards or act transitions while away', () => {
    const s = played(200); const act = s.act;
    V.applyOffline(s, 6 * 3600 * 1000);
    expect(s.act).toBe(act); expect(S.humansAlive(s)).toBeGreaterThan(0);
  });
  it('does nothing after the game has ended', () => { const s = played(10); s.ended = 'A'; expect(V.applyOffline(s, 3600_000)).toBeNull(); });
});

describe('formatters', () => {
  it('abbreviates numbers', () => {
    expect(num(0)).toBe('0'); expect(num(999)).toBe('999'); expect(num(1500)).toBe('1.50K'); expect(num(2.5e6)).toBe('2.50M');
    expect(num(999_999)).toBe('1.00M'); expect(num(-1500)).toBe('−1.50K'); expect(num(1e18)).toBe('1.00e18'); expect(num(Infinity)).toBe('∞');
  });
  it('ints, money, clocks, etas', () => {
    expect(int(1234567)).toBe('1,234,567'); expect(usd(5)).toBe('$5'); expect(usd(-5)).toBe('−$5');
    expect(clock(65)).toBe('01:05'); expect(clock(3725)).toBe('1:02:05'); expect(eta(0.2)).toBe('now'); expect(eta(30)).toBe('30 s'); expect(eta(600)).toBe('10 min'); expect(eta(Infinity)).toBe('—');
    expect(pct(0.256, 1)).toBe('25.6%'); expect(tpl('a {{x}} b {{y}}', { x: 1 })).toBe('a 1 b ');
  });
  it('FIN decay mode drops separators', () => { setFmt({ nosep: true }); expect(int(1234567)).toBe('1234567'); setFmt({}); });
});
