import { useEffect, useState } from 'preact/hooks';
import { initState, type State } from '../engine/state.ts';
import * as S from '../engine/sim.ts';
import { TICK, DEPTS } from '../engine/data.ts';
import { applyOffline, defaultOpts, exportText, importText, load, loadMeta, save, saveMeta, type Meta, type OfflineReport, type Opts } from '../engine/save.ts';
import { setFmt } from '../engine/format.ts';

export interface Game {
  s: State; d: S.Derived; meta: Meta; opts: Opts; speed: number; paused: boolean; lens: boolean; started: boolean;
  tab: string; sel: number; v: number; debug: boolean; hasSave: boolean; modal: '' | 'redesign'; toast: string;
  dec: number[]; saasOn: boolean; report: OfflineReport | null; cardsSeen: number;
}
const kv: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } = (() => {
  try { localStorage.getItem('x'); return localStorage; } catch { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; }
})();
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const meta0 = loadMeta(kv);
const reducedMQ = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMQ && !localStorage.getItem('natural-attrition:v1:meta')) { meta0.opts.reduced = true; meta0.opts.stable = true; }
const s0 = initState(Number(params.get('seed')) || (Date.now() & 0xffffff), 'Alex');

export const G: Game = {
  s: s0, d: S.derive(s0), meta: meta0, opts: meta0.opts, speed: 1, paused: false, lens: false, started: false,
  tab: 'floor', sel: -1, v: 0, debug: params.get('debug') === '1', hasSave: !!kv.getItem('natural-attrition:v1:slot0'), modal: '', toast: '',
  dec: new Array(9).fill(0), saasOn: false, report: null, cardsSeen: 0,
};
const subs = new Set<() => void>();
export function notify() { G.d = S.derive(G.s); G.v++; subs.forEach((f) => f()); }
export function useGame(): Game {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return G;
}
export const act = <T,>(fn: (s: State) => T): T => { const r = fn(G.s); G.s.stats.clicks++; notify(); return r; };

// ----- applying options -----
export function applyOpts() {
  const o = G.opts, r = document.documentElement;
  r.dataset.stable = o.stable || o.reduced ? '1' : '0'; r.dataset.contrast = o.contrast ? '1' : '0';
  r.style.fontSize = `${o.text}%`; r.dataset.act = String(G.s.act);
  G.meta.opts = o; saveMeta(kv, G.meta);
}
export function setOpt<K extends keyof Opts>(k: K, v: Opts[K]) { G.opts[k] = v; if (k === 'stable' && v) S.log(G.s, 'stable_on'); applyOpts(); notify(); }

// ----- twists: department decay (T3), redesign (T4) -----
const DEC_KEYS = ['eng', 'sal', 'sup', 'ops', 'hr', 'leg', 'fin', 'mgt', 'lab'];
const DEC_LOG = new Set(['sup', 'mgt', 'leg', 'hr', 'ops', 'fin', 'eng']);
function twists() {
  const s = G.s;
  for (let k = 0; k < 9; k++) {
    const f = s.dn[k] / DEPTS[k].count; const lvl = f < 0.1 ? 2 : f < 0.4 ? 1 : 0; G.dec[k] = lvl;
    const key = 'dec_' + DEC_KEYS[k];
    if (lvl >= 1 && !s.flags[key] && DEC_LOG.has(DEC_KEYS[k])) { s.flags[key] = 1; S.log(s, 'decay_' + DEC_KEYS[k], undefined, 'meta'); }
  }
  const stable = G.opts.stable || G.opts.reduced;
  setFmt({ nosep: !stable && G.dec[6] >= 1, approx: !stable && G.dec[6] >= 2 });
  if (s.flags.redesign && !s.flags.rdSeen) { s.flags.rdSeen = 1; S.log(s, 'redesign_on', undefined, 'meta'); if (!stable && !G.opts.classic) { G.modal = 'redesign'; G.saasOn = true; } }
  G.saasOn = !!s.flags.redesign && !G.opts.classic && !stable && s.act < 4;
  const r = document.documentElement; r.dataset.act = String(s.act);
  for (let k = 0; k < 9; k++) r.dataset['dec' + DEC_KEYS[k]] = String(stable ? 0 : G.dec[k]);
  r.dataset.saas = G.saasOn ? '1' : '0';
  const base = ['', 'Q3_Workforce_Plan_FINAL_v7(2).xlsx', 'Synergy Dashboard (3)', 'Re-engagement Tracker', 'Untitled Document'][s.act];
  document.title = !stable && G.dec[3] >= 1 && Math.floor(s.t) % 4 === 0 ? base + ' …' : base;
}

// ----- persistence -----
export function saveNow(rotate = false) { if (!G.started) return; save(kv, G.s, rotate); }
export function startNew(name: string, opt: Record<string, number> = {}) {
  G.s = initState(Number(params.get('seed')) || (Date.now() & 0xffffff), name.trim().slice(0, 24) || 'Alex', opt);
  S.log(G.s, 'start'); G.started = true; G.tab = 'floor'; afterLoad(); saveNow(true);
}
export function continueGame(): boolean {
  const { res, restored } = load(kv);
  if (!res.ok) return false;
  G.s = res.state; G.started = true;
  const el = Date.now() - res.savedAt;
  if (el < -5 * 60000) S.log(G.s, 'bridge'); else G.report = applyOffline(G.s, el, G.opts.capH);
  if (restored) S.mailAny(G.s, 'restored');
  afterLoad(); return true;
}
export function loadState(st: State) { G.s = st; G.started = true; afterLoad(); saveNow(true); }
function afterLoad() { G.sel = -1; G.modal = ''; twists(); applyOpts(); notify(); }
export function resetGame() { kv.removeItem('natural-attrition:v1:slot0'); G.started = false; G.hasSave = false; G.s = initState(Date.now() & 0xffffff, 'Alex'); notify(); }
export async function doExport(): Promise<string> { return exportText(G.s); }
export async function doImport(text: string): Promise<boolean> { const r = await importText(text); if (!r.ok) return false; loadState(r.state); S.log(G.s, 'imported'); return true; }

// ----- main loop -----
let acc = 0, last = 0, lastNotify = 0, lastSave = 0, lastTwist = 0, lastInput = 0, hiddenAt = 0, lastAct = 1;
export function startLoop() {
  last = performance.now(); lastInput = last;
  const frame = (now: number) => {
    const dtReal = Math.min(0.5, (now - last) / 1000); last = now;
    const s = G.s;
    if (G.started && !G.paused && !s.ended) {
      acc += dtReal * G.speed;
      let n = 0; const t0 = performance.now();
      while (acc >= TICK && n < 4096) { S.step(s, TICK); acc -= TICK; n++; if (performance.now() - t0 > 18) { acc = 0; break; } }
      if (now - lastInput > 20000) s.stats.idleSec += dtReal;
    }
    if (now - lastTwist > 500) { lastTwist = now; if (G.started) twists(); }
    if (s.act !== lastAct) { lastAct = s.act; saveNow(true); }
    if (now - lastNotify > 200) { lastNotify = now; notify(); }
    if (G.started && now - lastSave > 30000) { lastSave = now; saveNow(false); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('pointerdown', () => { lastInput = performance.now(); }, { passive: true });
  addEventListener('keydown', () => { lastInput = performance.now(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); saveNow(false); }
    else if (hiddenAt && G.started) {
      const el = Date.now() - hiddenAt; hiddenAt = 0; G.s.stats.hiddenSec += el / 1000;
      if (el > 60000 && !G.s.ended) { G.report = applyOffline(G.s, el, G.opts.capH); notify(); }
      else if (!G.s.ended) { S.stepN(G.s, Math.min(4000, Math.floor(el / 1000 / TICK))); notify(); }
      last = performance.now();
    }
  });
  addEventListener('pagehide', () => saveNow(false));
  addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && G.s.act >= 2) { G.lens = true; notify(); } });
  addEventListener('keyup', (e) => { if (e.key === 'r' || e.key === 'R') { G.lens = false; notify(); } });
}
(window as unknown as Record<string, unknown>).__G = G;
(window as unknown as Record<string, unknown>).__nat = { doImport, G, saveNow };
export { defaultOpts };
