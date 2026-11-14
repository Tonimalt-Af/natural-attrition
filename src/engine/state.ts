import { A1, NDEPT, DEPTS, SAVE_VERSION, TIERS, RACKS } from './data.ts';
import { next, gauss } from './rng.ts';

export const F_ALIVE = 1, F_KEEPER = 2, F_CONTR = 4, F_BADGE = 8;
export type P = Record<string, string | number>;
export interface Tile { name: string; size: number; left: number; cult: number }
export interface Target { id: number; name: string; size: number; cult: number }
export interface Mail { id: string; t: number; p?: P; read: boolean }
export interface LogLine { t: number; k: string; p?: P; tone?: string }
export interface Quarter { n: number; startT: number; street: number; startPi: number; prevPi: number; g: number }
export interface A4State { step: number; prog: number; running: boolean; tone: number[]; badge: '' | 'A' | 'B'; nps: number; sun: number }
export interface Stats { cuts: number; incidents: number; lawsuits: number; beats: number; misses: number; liesMax: number; audits: number; reckonings: number; clicks: number; hiddenSec: number; idleSec: number; maxFiction: number; statements: number }

export interface State {
  v: number; seed: number; rng: number; t: number; act: 1 | 2 | 3 | 4; ended: '' | 'A' | 'B';
  name: string; caseFile: string; opt: Record<string, number>;
  dept: number[]; c: number[]; w: number[]; fl: number[];
  dn: number[]; lc: number[]; lcx: number[]; L0: number[];
  nContr: number; pay: number; contrPay: number;
  M: number; X: number; incUntil: number; hallUntil: number; ghosts: number[];
  cuts: number; cutTimes: number[]; incidents: number; lawsuits: number;
  cash: number; slides: number; own: Record<string, number>;
  assoc: number; partners: number; rc: number[]; racks: number[];
  cipAcc: number; pizzaAt: number; creepAt: number; bridge: number;
  mBase: number; mMul: number; wash: number; washAt: number;
  piS: number; piRepS: number;
  q: Quarter; guidance: number; beats: number; misses: number; lastQ: { beat: number; g: number; at: number };
  U: number; I: number; peakH: number; hqExcess: number; debt: number; addback: number; F: number; S: number;
  intensity: number; tiles: Tile[]; targets: Target[]; nextTarget: number;
  immuneUntil: number; ignoreUntil: number; auditMark: number; pendAudit: number;
  corr: number; slumpUntil: number; slump: number; reckonings: number; piBase: number;
  mix: number[]; HD: number; lastCust: number; minskyUntil: number; closureSeen: number; actT: number[];
  a4: A4State;
  log: LogLine[]; inbox: Mail[]; seen: Record<string, number>; hist: number[][]; histAt: number;
  advAt: number; lastBuyT: number; flags: Record<string, number>; stats: Stats; rev: number;
}

export function initState(seed = 1, name = 'Alex', opt: Record<string, number> = {}): State {
  const s = { rng: (seed * 2654435761) >>> 0 || 1 } as State;
  const dept: number[] = [], c: number[] = [], w: number[] = [], fl: number[] = [];
  for (let d = 0; d < NDEPT; d++) {
    for (let k = 0; k < DEPTS[d].count; k++) {
      dept.push(d);
      c.push(Math.exp(gauss(s) * 0.5 - 0.125));
      w.push(DEPTS[d].wage * Math.exp(gauss(s) * 0.25 - 0.03) * (0.85 + 0.15 * c[c.length - 1]));
      fl.push(F_ALIVE);
    }
  }
  const n = dept.length;
  const mw = w.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) w[i] = Math.round((w[i] / mw) * 1000) / 1000;
  for (let i = 0; i < n; i++) c[i] = Math.round(c[i] * 1000) / 1000;
  // badge = Employee #1000 (last LAB slot)
  const badge = n - 1;
  fl[badge] |= F_BADGE; w[badge] = 0.55; c[badge] = 1;
  let k = 0;
  while (k < A1.KEEPERS) {
    const i = Math.floor(next(s) * n);
    if (!(fl[i] & (F_KEEPER | F_BADGE)) && dept[i] !== 8) { fl[i] |= F_KEEPER; k++; }
  }
  const dn = new Array(NDEPT).fill(0), lc = new Array(NDEPT).fill(0);
  let pay = 0;
  for (let i = 0; i < n; i++) { dn[dept[i]]++; lc[dept[i]] += c[i]; pay += w[i]; }
  const q0 = 0.4 + 0.6 * A1.M0;
  const L0 = lc.map((x) => x * q0);
  const st: State = Object.assign(s, {
    v: SAVE_VERSION, seed, t: 0, act: 1 as const, ended: '' as const, name, caseFile: 'nullwater', opt,
    dept, c, w, fl, dn, lc, lcx: new Array(NDEPT).fill(0), L0, nContr: 0, pay, contrPay: 0,
    M: A1.M0, X: 0, incUntil: 0, hallUntil: 0, ghosts: [], cuts: 0, cutTimes: [], incidents: 0, lawsuits: 0,
    cash: A1.CASH0 * (opt.warm ? 3 : 1), slides: 0, own: {} as Record<string, number>,
    assoc: 0, partners: 0, rc: TIERS.map(() => 0), racks: RACKS.map(() => 0),
    cipAcc: 0, pizzaAt: -999, creepAt: 0, bridge: 0,
    mBase: 8, mMul: 1, wash: 0, washAt: -999, piS: 55, piRepS: 55,
    q: { n: 0, startT: 0, street: 58, startPi: 55, prevPi: 55, g: 0 }, guidance: 1, beats: 0, misses: 0, lastQ: { beat: 0, g: 1, at: 0 },
    U: 0, I: 0, peakH: A1.H0, hqExcess: 0, debt: 0, addback: 0, F: 0, S: 0, intensity: 1, tiles: [], targets: [], nextTarget: 1,
    immuneUntil: 0, ignoreUntil: 0, auditMark: 0, pendAudit: 0, corr: 0, slumpUntil: 0, slump: 1, reckonings: 0, piBase: 0,
    mix: [0.1, 0.3, 0.6], HD: 0, lastCust: 0, minskyUntil: 0, closureSeen: 0, actT: [0, 0, 0, 0],
    a4: { step: 0, prog: 0, running: false, tone: [], badge: '' as const, nps: 7, sun: 0 },
    log: [], inbox: [], seen: {}, hist: [], histAt: 0, advAt: 0, lastBuyT: 0, flags: {},
    stats: { cuts: 0, incidents: 0, lawsuits: 0, beats: 0, misses: 0, liesMax: 0, audits: 0, reckonings: 0, clicks: 0, hiddenSec: 0, idleSec: 0, maxFiction: 0, statements: 0 },
    rev: 0,
  });
  if (opt.preread) st.own.stack = 1;
  return st;
}
