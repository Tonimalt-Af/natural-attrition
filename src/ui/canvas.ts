import { DEPTS } from '../engine/data.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER, F_TWICE, type State, type Tile } from '../engine/state.ts';
import { netValue, mapped, noiseLevel, tileHumans, type Derived } from '../engine/sim.ts';
import { hash01 } from '../engine/rng.ts';

export const COLS = 40, ROWS = 25;
export const css = (name: string, fb = '#888') => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

export function setupCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
}

function shape(ctx: CanvasRenderingContext2D, k: number, x: number, y: number, r: number) {
  ctx.beginPath();
  switch (k) {
    case 0: ctx.roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.25); break;
    case 1: ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.1, y + r * 0.9); ctx.lineTo(x - r * 1.1, y + r * 0.9); ctx.closePath(); break;
    case 2: ctx.arc(x, y, r, 0, 6.2832); break;
    case 3: ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); break;
    case 4: ctx.moveTo(x, y + r * 1.1); ctx.lineTo(x + r * 1.1, y - r * 0.9); ctx.lineTo(x - r * 1.1, y - r * 0.9); ctx.closePath(); break;
    case 5: { const a = r * 0.38; ctx.rect(x - a, y - r, 2 * a, 2 * r); ctx.rect(x - r, y - a, 2 * r, 2 * a); break; }
    case 6: for (let i = 0; i < 6; i++) { const an = (i / 6) * 6.2832 + 0.5236; ctx.lineTo(x + Math.cos(an) * r * 1.1, y + Math.sin(an) * r * 1.1); } ctx.closePath(); break;
    case 7: ctx.roundRect(x - r * 1.15, y - r * 0.45, r * 2.3, r * 0.9, 2); break;
    default: ctx.arc(x, y, r * 0.95, 0, 6.2832); break;
  }
}

export interface Ghost { x: number; y: number; t0: number; col: string; kind?: 'in' }
export function floorLayout(w: number) { const cell = Math.floor(w / COLS); return { cell, gw: cell * COLS, gh: cell * ROWS, strip: 26 }; }

export function drawFloor(ctx: CanvasRenderingContext2D, w: number, s: State, d: Derived, sel: number, hover: number, ghosts: Ghost[], now: number, reduced: boolean, dismantle = 0) {
  const { cell, gw, gh, strip } = floorLayout(w);
  const ink = css('--ink'), muted = css('--muted'), accent = css('--accent'), bg = css('--surface');
  ctx.clearRect(0, 0, w, gh + strip); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, gh + strip);
  const a3 = s.act === 3; const r = cell * 0.36; const showEst = !a3 && (!!s.own.stack || noiseLevel(s) > 0); const keepers = !a3 && mapped(s);
  const nv: number[] = showEst ? [] : [];
  let lo = Infinity, hi = -Infinity;
  if (showEst) for (let i = 0; i < s.dept.length; i++) { if (!(s.fl[i] & F_ALIVE)) { nv.push(0); continue; } const v = netValue(s, d, i, false); nv.push(v); if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, 1e-6);
  const maxI = Math.floor(s.dept.length * (1 - dismantle));
  for (let i = 0; i < maxI; i++) {
    const x = (i % COLS) * cell + cell / 2, y = Math.floor(i / COLS) * cell + cell / 2; const f = s.fl[i];
    const dep = DEPTS[s.dept[i]];
    if (a3 && !(f & F_ALIVE)) {
      // the people who were cut: hollow rings you can click; the first one out is gold; the Board's re-cuts are red
      const gold = i === s.first, twice = !!(f & F_TWICE);
      ctx.strokeStyle = gold ? accent : twice ? css('--bad') : muted; ctx.globalAlpha = gold ? 1 : twice ? 0.8 : 0.5; ctx.lineWidth = gold ? 2 : 1.3;
      ctx.beginPath(); ctx.arc(x, y, r * (gold ? 1.0 : 0.82), 0, 6.2832); ctx.stroke();
      if (gold) { ctx.beginPath(); ctx.arc(x, y, r * (1.35 + (reduced ? 0 : 0.18 * Math.sin(now / 350))), 0, 6.2832); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (i === sel || i === hover) { ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.strokeRect(x - cell / 2 + 1, y - cell / 2 + 1, cell - 2, cell - 2); }
      continue;
    }
    if (!(f & F_ALIVE)) { ctx.strokeStyle = muted; ctx.globalAlpha = 0.12; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    const alpha = a3 ? ((f & F_CONTR) ? 1 : 0.3) : showEst ? 0.3 + 0.7 * (1 - (nv[i] - lo) / span) : 0.9;
    ctx.globalAlpha = alpha;
    if (a3 && (f & F_CONTR)) { ctx.fillStyle = dep.color; shape(ctx, s.dept[i], x, y, r); ctx.fill(); ctx.globalAlpha = 0.9; ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, 6.2832); ctx.stroke(); }
    else if (f & F_CONTR) { shape(ctx, s.dept[i], x, y, r); ctx.strokeStyle = dep.color; ctx.lineWidth = 1.6; ctx.stroke(); }
    else { ctx.fillStyle = dep.color; shape(ctx, s.dept[i], x, y, r); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (f & F_BADGE) { ctx.setLineDash([2, 2]); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    else if (keepers && f & F_KEEPER) { ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 6.2832); ctx.stroke(); }
    if (i === sel || i === hover) { ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.strokeRect(x - cell / 2 + 1, y - cell / 2 + 1, cell - 2, cell - 2); }
  }
  // fading ghosts (cut animation)
  for (const g of ghosts) { const k = Math.min(1, (now - g.t0) / (reduced ? 120 : 420)); if (k >= 1) continue; if (g.kind === 'in') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = g.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, r * (1.2 + (reduced ? 0 : 2.6 * k)), 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; continue; } ctx.globalAlpha = 1 - k; ctx.fillStyle = g.col; ctx.beginPath(); ctx.arc(g.x, g.y - (reduced ? 0 : 10 * k), r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
  // Opportunities strip
  ctx.fillStyle = muted; ctx.font = '600 10px ui-sans-serif, system-ui'; ctx.globalAlpha = 0.8; ctx.fillText(a3 ? 'RE-ENGAGED' : 'OPPORTUNITIES', 4, gh + 11); ctx.globalAlpha = 1;
  const total = a3 ? s.reh : s.stats.cuts + (s.flags.attr || 0); const shown = Math.min(total, Math.floor((w - 110) / 5));
  ctx.globalAlpha = 0.35; for (let i = 0; i < shown; i++) { ctx.fillStyle = DEPTS[Math.floor(hash01(s.seed, i + 77) * 9)].color; ctx.fillRect(100 + i * 5, gh + 5 + (i % 3), 3, 3 + (i % 2)); } ctx.globalAlpha = 1;
  if (total) { ctx.fillStyle = muted; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(String(total), 4, gh + 23); }
}
export function floorHit(w: number, x: number, y: number): number {
  const { cell } = floorLayout(w); const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return -1; return cy * COLS + cx;
}

// ---------- Jaws ("The Alligator") ----------
export function drawJaws(ctx: CanvasRenderingContext2D, w: number, h: number, s: State, d: Derived, showReal: boolean) {
  const ink = css('--ink'), gold = css('--accent'), muted = css('--muted'), bad = css('--bad');
  ctx.clearRect(0, 0, w, h);
  const hs = s.hist; const pad = { l: 6, r: 6, t: 8, b: 14 };
  if (hs.length < 2) { ctx.fillStyle = muted; ctx.font = '12px ui-sans-serif, system-ui'; ctx.fillText('The chart will appear after the first cuts.', 8, h / 2); return; }
  const t0 = hs[0][0], t1 = hs[hs.length - 1][0] + 1; const X = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (w - pad.l - pad.r);
  let mn = Infinity, mx = -Infinity; for (const p of hs) { mn = Math.min(mn, p[1], p[3]); mx = Math.max(mx, p[1], p[3]); }
  mn = Math.floor(mn); mx = Math.max(mx, mn + 1);
  const Yh = (v: number) => pad.t + (1 - v) * (h - pad.t - pad.b);
  const Ym = (v: number) => pad.t + (1 - (v - mn) / (mx - mn)) * (h - pad.t - pad.b);
  // fill between
  ctx.beginPath(); hs.forEach((p, i) => { const x = X(p[0]), y = Ym(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); for (let i = hs.length - 1; i >= 0; i--) ctx.lineTo(X(hs[i][0]), Yh(hs[i][2]));
  ctx.closePath(); ctx.fillStyle = gold; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
  if (showReal) {
    ctx.beginPath(); hs.forEach((p, i) => { const x = X(p[0]), y = Ym(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); for (let i = hs.length - 1; i >= 0; i--) ctx.lineTo(X(hs[i][0]), Ym(hs[i][3]));
    ctx.closePath(); ctx.fillStyle = bad; ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1;
    ctx.setLineDash([4, 3]); ctx.beginPath(); hs.forEach((p, i) => { const x = X(p[0]), y = Ym(p[3]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = bad; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.lineWidth = 2; ctx.strokeStyle = gold; ctx.beginPath(); hs.forEach((p, i) => { const x = X(p[0]), y = Ym(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  ctx.strokeStyle = ink; ctx.beginPath(); hs.forEach((p, i) => { const x = X(p[0]), y = Yh(p[2]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  // annotations
  ctx.font = '10px ui-sans-serif, system-ui'; ctx.fillStyle = muted; ctx.strokeStyle = muted; ctx.lineWidth = 1;
  const marks: [number, string][] = []; if (s.actT[0]) marks.push([s.actT[0], 'Synergy']); if (s.flags.corrAt) marks.push([s.flags.corrAt, 'Correction']); if (s.actT[1]) marks.push([s.actT[1], 'The Stall']); if (s.flags.finAt) marks.push([s.flags.finAt, 'Head of Efficiency']);
  marks.forEach(([t, label], i) => { const x = X(t); if (x < pad.l || x > w - pad.r) return; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(label, Math.min(x + 3, w - 62), h - 3 - (i % 2) * 0); });
}

// ---------- Treemap ----------
export interface Rect { x: number; y: number; w: number; h: number; t: Tile; i: number }
export function squarify(tiles: Tile[], W: number, H: number): Rect[] {
  const items = tiles.map((t, i) => ({ t, i, v: Math.max(t.size, 1) })).sort((a, b) => b.v - a.v);
  const total = items.reduce((a, b) => a + b.v, 0); const out: Rect[] = [];
  let x = 0, y = 0, w = W, h = H, rest = total; let row: typeof items = [];
  const area = (v: number) => (v / rest) * w * h;
  const worst = (r: typeof items, side: number) => { const s = r.reduce((a, b) => a + area(b.v), 0); let m = 0; for (const it of r) { const a = area(it.v); m = Math.max(m, Math.max((side * side * a) / (s * s), (s * s) / (side * side * a))); } return m; };
  const layout = (r: typeof items) => {
    const s = r.reduce((a, b) => a + area(b.v), 0); const side = Math.min(w, h);
    if (w >= h) { const rw = s / h; let yy = y; for (const it of r) { const hh = area(it.v) / rw; out.push({ x, y: yy, w: rw, h: hh, t: it.t, i: it.i }); yy += hh; } x += rw; w -= rw; }
    else { const rh = s / w; let xx = x; for (const it of r) { const ww = area(it.v) / rh; out.push({ x: xx, y, w: ww, h: rh, t: it.t, i: it.i }); xx += ww; } y += rh; h -= rh; }
    rest -= r.reduce((a, b) => a + b.v, 0); void side;
  };
  for (const it of items) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it); else { layout(row); row = [it]; }
  }
  if (row.length) layout(row);
  return out;
}
const CULT = ['#b9822f', '#5a8d6a', '#4f7fd0', '#9b5fb0'];
export function drawTreemap(ctx: CanvasRenderingContext2D, W: number, H: number, s: State, now: number, kappa = 0) {
  const ink = css('--ink'), bg = css('--surface'), muted = css('--muted'), accent = css('--accent');
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rects = squarify(s.tiles, W - 4, H - 4);
  for (const r of rects) {
    const x = r.x + 2, y = r.y + 2, w = r.w - 2, h = r.h - 2; const prog = r.t.size > 0 ? 1 - r.t.left / r.t.size : 1;
    ctx.fillStyle = CULT[r.t.cult] ?? '#888'; ctx.globalAlpha = 0.18; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 0.85; ctx.fillRect(x, y, w * prog, h);
    ctx.globalAlpha = 1;
    // human density texture on the unintegrated part
    if (prog < 1) { ctx.fillStyle = ink; ctx.globalAlpha = 0.28; const gap = 7; for (let yy = y + 3; yy < y + h - 2; yy += gap) for (let xx = x + w * prog + 3; xx < x + w - 2; xx += gap) { ctx.beginPath(); ctx.arc(xx, yy, 1.4, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.strokeStyle = bg; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    if (w > 60 && h > 30) { ctx.fillStyle = prog > 0.5 ? '#fff' : ink; ctx.font = '600 11px ui-sans-serif, system-ui'; ctx.fillText(r.t.name.length * 6 > w - 8 ? r.t.name.slice(0, Math.floor((w - 8) / 6)) + '…' : r.t.name, x + 5, y + 14); ctx.font = '10px ui-monospace, monospace'; ctx.globalAlpha = 0.85; { const fmt = (n: number) => Math.round(n).toLocaleString('en-US'); const two = kappa > 0.01 && prog > 0; const hm = two ? fmt(tileHumans(s, kappa, s.tiles.indexOf(r.t))) : ''; const pc = prog < 1 ? ` · ${Math.round(prog * 100)}%` : '';
      let lab = two ? `${hm} ppl / ${fmt(r.t.size)} roles${pc}` : fmt(r.t.size) + pc; if (ctx.measureText(lab).width > w - 8 && two) lab = `${hm} / ${fmt(r.t.size)}${pc}`; if (ctx.measureText(lab).width > w - 8) lab = `${hm || fmt(r.t.size)}`; ctx.fillText(lab, x + 5, y + 27); } ctx.globalAlpha = 1; }
  }
  ctx.fillStyle = muted; void now; void accent;
}
