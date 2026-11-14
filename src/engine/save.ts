import { initState, type State } from './state.ts';
import { A3, OFFLINE_CAP, SAVE_VERSION } from './data.ts';
import { a4Verdict, mailAny, pickFirst, step } from './sim.ts';
import { hash01 } from './rng.ts';

export const KEY = 'natural-attrition:v1:slot0';
export const BAK = (i: number) => `natural-attrition:v1:bak${i}`;
export const META_KEY = 'natural-attrition:v1:meta';

export interface Meta { endings: string[]; opts: Opts; billable: number; debugUsed: boolean }
export interface Opts { stable: boolean; reduced: boolean; contrast: boolean; text: number; sound: boolean; noMeta: boolean; capH: number; classic: boolean; lang: string }
export const defaultOpts = (): Opts => ({ stable: false, reduced: false, contrast: false, text: 100, sound: false, noMeta: false, capH: 8, classic: false, lang: 'en' });
export const defaultMeta = (): Meta => ({ endings: [], opts: defaultOpts(), billable: 0, debugUsed: false });

export function crc32(str: string): number {
  let c, crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    c = (crc ^ str.charCodeAt(i)) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface Envelope { v: number; savedAt: number; crc: number; state: string }

export function serialize(s: State, now = Date.now()): string {
  const body = JSON.stringify(s);
  const env: Envelope = { v: SAVE_VERSION, savedAt: now, crc: crc32(body), state: body };
  return JSON.stringify(env);
}

/** Migrations: index i upgrades version i+1 -> i+2. */
export const migrations: Array<(o: Record<string, unknown>) => Record<string, unknown>> = [
  // v1 -> v2: added Act III/IV fields and piBase
  (o) => ({ ...o, piBase: o.piBase ?? 0, closureSeen: o.closureSeen ?? 0, v: 2 }),
  // v2 -> v3: integration waves (parallel blocks, Day-1 cut) and the Strategic Deck. In-progress queues keep their per-block `left`; the wave buffer starts empty.
  (o) => { const f = { ...((o.flags as Record<string, number>) ?? {}) }; f.waveAcc = f.waveAcc ?? 0; f.waveAt = f.waveAt ?? 0; return { ...o, flags: f, v: 3 }; },
  // v3 -> v4: Act III "The Rehire" replaces the Closed Loop. Everyone who left in Act I gets a (reconstructed) exit record, old Act III saves restart at the stall.
  (o) => migrateV4(o),
];
const OLD_A3_OWN = ['bnpl', 'secur', 'synth1', 'synth2', 'atm', 'regcap', 'engage', 'lights'];
function migrateV4(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o, v: 4 };
  for (const k of ['racks', 'mix', 'HD', 'lastCust', 'minskyUntil', 'closureSeen']) delete out[k];
  const own = { ...((o.own as Record<string, number>) ?? {}) }; for (const k of OLD_A3_OWN) delete own[k]; out.own = own;
  const seed = (o.seed as number) ?? 1; const fl = (o.fl as number[]) ?? []; const n = fl.length;
  const actT = (o.actT as number[]) ?? [0, 0, 0, 0]; const horizon = Math.max(120, (o.act as number) >= 2 && actT[0] > 0 ? actT[0] : ((o.t as number) ?? 600));
  const dead: number[] = []; for (let i = 0; i < n; i++) if (!(fl[i] & 1) && !(fl[i] & 8)) dead.push(i);
  dead.sort((a, b) => hash01(seed, a * 13 + 7) - hash01(seed, b * 13 + 7));
  const cutN = Math.min(dead.length, Math.max(0, Math.round((o.cuts as number) ?? 0)));
  const cutT = new Array(n).fill(0), cutW = new Array(n).fill(0); const waves: number[] = [];
  let left = 0, w = 0;
  dead.forEach((i, r) => {
    cutT[i] = Math.round((30 + (r / Math.max(1, dead.length)) * (horizon - 30)) * 10) / 10;
    if (r < cutN) { if (left <= 0) { left = 3 + Math.floor(hash01(seed, 900 + w) * 14); waves.push(0); w++; } cutW[i] = w; waves[w - 1]++; left--; }
  });
  out.cutT = cutT; out.cutW = cutW; out.waves = waves; out.lastCutT = -999; out.first = -1;
  const act = (o.act as number) ?? 1;
  if (act >= 3) out.first = pickFirst({ ...out, fl, dept: o.dept } as unknown as State);
  if (act === 3) {
    const pi0 = Math.max((o.piS as number) ?? 0, (o.piBase as number) ?? 0, 1);
    Object.assign(out, { pi0, dm: 1, conf: 1, reh: 0, rstack: [], reffRaw: 0, rwRaw: 0, interv: 0, cash: Math.max((o.cash as number) ?? 0, A3.GRANT * pi0) });
    const seen = { ...((o.seen as Record<string, number>) ?? {}), a3_start: 1 }; out.seen = seen;
    out.inbox = [...(((o.inbox as unknown[]) ?? []) as unknown[]), { id: 'a3_start', t: (o.t as number) ?? 0, read: false }];
  }
  if (act === 4) {
    const a4 = { step: 0, prog: 0, running: false, tone: [], badge: '', nps: 7, sun: 0, fast: 0, ...((o.a4 as object) ?? {}), c: 0, v: 0 };
    out.a4 = a4;
    const st = { ...initState((o.seed as number) ?? 1), ...out } as unknown as State; if (a4.step >= 4) { a4Verdict(st); (out.a4 as { c: number; v: number }).c = st.a4.c; (out.a4 as { c: number; v: number }).v = st.a4.v; }
  }
  return out;
}

/** Fill any field missing from an older/partial save from a fresh state (forward-compatible). */
function fill(o: Record<string, unknown>): State {
  const base = initState((o.seed as number) ?? 1, (o.name as string) ?? 'Alex', (o.opt as Record<string, number>) ?? {}) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base, ...o };
  for (const k of ['stats', 'flags', 'a4', 'q', 'lastQ']) if (typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = { ...(base[k] as object), ...((o[k] as object) ?? {}) };
  return out as unknown as State;
}

export type LoadResult = { ok: true; state: State; savedAt: number; v: number } | { ok: false; error: string };

export function deserialize(text: string): LoadResult {
  try {
    const env = JSON.parse(text) as Envelope;
    if (typeof env.state !== 'string') return { ok: false, error: 'format' };
    if (crc32(env.state) !== env.crc) return { ok: false, error: 'crc' };
    if (env.v > SAVE_VERSION) return { ok: false, error: 'future' };
    let o = JSON.parse(env.state) as Record<string, unknown>;
    let v = env.v;
    while (v < SAVE_VERSION) { o = migrations[v - 1](o); v++; }
    return { ok: true, state: fill(o), savedAt: env.savedAt, v: env.v };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export function save(kv: KV, s: State, rotate = false, now = Date.now()) {
  const txt = serialize(s, now);
  try {
    if (rotate) { for (let i = 3; i > 1; i--) { const p = kv.getItem(BAK(i - 1)); if (p) kv.setItem(BAK(i), p); } const cur = kv.getItem(KEY); if (cur) kv.setItem(BAK(1), cur); }
    kv.setItem(KEY, txt);
    return true;
  } catch { return false; }
}

export function load(kv: KV): { res: LoadResult; restored: boolean } {
  const cur = kv.getItem(KEY);
  if (!cur) return { res: { ok: false, error: 'none' }, restored: false };
  const r = deserialize(cur);
  if (r.ok) return { res: r, restored: false };
  for (let i = 1; i <= 3; i++) { const b = kv.getItem(BAK(i)); if (b) { const rb = deserialize(b); if (rb.ok) return { res: rb, restored: true }; } }
  return { res: r, restored: false };
}

export function loadMeta(kv: KV): Meta {
  try { const m = JSON.parse(kv.getItem(META_KEY) ?? 'null'); if (m) return { ...defaultMeta(), ...m, opts: { ...defaultOpts(), ...m.opts } }; } catch { /* ignore */ }
  return defaultMeta();
}
export function saveMeta(kv: KV, m: Meta) { try { kv.setItem(META_KEY, JSON.stringify(m)); } catch { /* quota */ } }

// ---------- export / import (gzip + base64url) ----------
const b64u = (buf: Uint8Array) => { let s = ''; for (const b of buf) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (t: string) => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter(); void w.write(data as unknown as BufferSource); void w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
export async function exportText(s: State, now = Date.now()): Promise<string> {
  const raw = new TextEncoder().encode(serialize(s, now));
  if (typeof CompressionStream === 'undefined') return 'P1.' + b64u(raw);
  return 'G1.' + b64u(await pipe(raw, new CompressionStream('gzip')));
}
export async function importText(text: string): Promise<LoadResult> {
  try {
    const t = text.trim();
    const kind = t.slice(0, 3); const body = t.slice(3);
    let raw: Uint8Array;
    if (kind === 'G1.') raw = await pipe(unb64u(body), new DecompressionStream('gzip'));
    else if (kind === 'P1.') raw = unb64u(body);
    else return { ok: false, error: 'format' };
    return deserialize(new TextDecoder().decode(raw));
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ---------- offline ("Out of Office") ----------
export interface OfflineReport { secs: number; cash: number; slides: number; cuts: number; capped: boolean; skipped: boolean }
export function applyOffline(s: State, elapsedMs: number, capH = 8): OfflineReport | null {
  let secs = elapsedMs / 1000;
  if (secs < 0) return null;
  if (secs < 60 || s.ended) return null;
  const cap = Math.min(OFFLINE_CAP, capH * 3600);
  const capped = secs > cap; secs = Math.min(secs, cap);
  const c0 = s.cash, sl0 = s.slides, h0 = s.stats.cuts + s.dn.reduce((a, b) => a + b, 0);
  const dt = secs <= 7200 ? 1 : 10;
  for (let t = 0; t < secs; t += dt) step(s, dt, true);
  const h1 = s.stats.cuts + s.dn.reduce((a, b) => a + b, 0);
  const rep: OfflineReport = { secs, cash: s.cash - c0, slides: s.slides - sl0, cuts: Math.max(0, h0 - h1), capped, skipped: false };
  mailAny(s, 'ooo', { h: +(secs / 3600).toFixed(1), cash: Math.round(rep.cash), slides: Math.round(rep.slides), capped: capped ? 1 : 0 });
  return rep;
}
