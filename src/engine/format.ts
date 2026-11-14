const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export interface Fmt { nosep?: boolean; approx?: boolean }
let FMT: Fmt = {};
export const setFmt = (f: Fmt) => { FMT = f; };

export function num(x: number, digits = 3): string {
  if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
  const neg = x < 0; x = Math.abs(x);
  let out: string;
  if (x < 1000) out = x < 10 && x % 1 !== 0 ? x.toFixed(digits > 2 ? 2 : 1) : x < 100 && x % 1 !== 0 ? x.toFixed(1) : Math.round(x).toString();
  else if (x < 1e15) {
    let e = Math.floor(Math.log10(x) / 3); let v = x / 1000 ** e;
    if (v >= 999.5) { e++; v = x / 1000 ** e; }
    out = (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUF[e];
  } else {
    const e = Math.floor(Math.log10(x)); const m = x / 10 ** e;
    out = `${m.toFixed(2)}e${e}`;
  }
  return neg ? '−' + out : out;
}
export function int(x: number): string {
  const r = Math.round(x);
  if (FMT.nosep) return String(r);
  if (Math.abs(r) >= 1e15) return num(r);
  return r.toLocaleString('en-US');
}
export function usd(x: number, unit = 1): string {
  const v = x * unit; const s = (FMT.approx ? '≈ $' : '$') + (Math.abs(v) >= 1e6 ? num(Math.abs(v)) : FMT.nosep ? String(Math.round(Math.abs(v))) : Math.round(Math.abs(v)).toLocaleString('en-US'));
  return v < 0 ? '−' + s : s;
}
export const USD_UNIT = 320;
/** model units (u) to display dollars */
export const money = (u: number) => usd(u, USD_UNIT);
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
export function clock(sec: number): string {
  sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
export function eta(sec: number): string {
  if (!isFinite(sec)) return '—'; if (sec < 1) return 'now'; if (sec < 90) return `${Math.ceil(sec)} s`;
  if (sec < 5400) return `${Math.ceil(sec / 60)} min`; return `${(sec / 3600).toFixed(1)} h`;
}
export function tpl(t: string, p?: Record<string, string | number>): string {
  if (!p) return t;
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => (p[k] === undefined ? '' : String(p[k])));
}
