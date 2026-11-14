import { initState, type State } from './state.ts';
import { OFFLINE_CAP, SAVE_VERSION } from './data.ts';
import { mailAny, step } from './sim.ts';

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
];

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
