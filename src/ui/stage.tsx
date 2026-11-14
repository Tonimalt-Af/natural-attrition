import { useEffect, useRef, useState } from 'preact/hooks';
import { DEPTS } from '../engine/data.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER } from '../engine/state.ts';
import { tileHumans, canCut, candidates, cut, wave, estC, mapped, netValue, sevOf, noiseLevel } from '../engine/sim.ts';
import { nameOf, quirkOf, roleOf, tenureOf } from '../engine/names.ts';
import { clock, int, num, money, pct, usd } from '../engine/format.ts';
import { t, deptName } from '../i18n/index.ts';
import { G, act, useGame } from './store.ts';
import { drawField, drawFloor, drawJaws, drawTreemap, floorHit, floorLayout, setupCanvas, squarify, type Ghost } from './canvas.ts';

function useWidth(ref: { current: HTMLElement | null }) {
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(200, Math.floor(el.clientWidth)))); ro.observe(el); setW(Math.max(200, el.clientWidth)); return () => ro.disconnect();
  }, []);
  return w;
}

export function PersonCard({ i }: { i: number }) {
  const g = useGame(); const s = g.s; const d = g.d;
  if (i < 0 || i >= s.dept.length) return null;
  const dep = DEPTS[s.dept[i]]; const alive = !!(s.fl[i] & F_ALIVE);
  const est = estC(s, i); const nv = alive ? netValue(s, d, i, false) : 0; const pb = nv > 0 ? sevOf(s, i) / nv : Infinity;
  const err = canCut(s, i);
  const sigma = [1, 0.4, 0.15, 0][noiseLevel(s)];
  return (
    <div class="pcard" role="group" aria-label="Selected person">
      <div class="pc-h"><span class="glyph" style={{ color: dep.color }}>{dep.glyph}</span> <b>{s.fl[i] & F_BADGE ? s.name : nameOf(s.seed, i)}</b>{s.fl[i] & F_BADGE ? <span class="chip">Employee #1000</span> : null}{s.fl[i] & F_KEEPER && mapped(s) ? <span class="chip">{t('dir.keeper')}</span> : null}{s.fl[i] & F_CONTR ? <span class="chip">{t('dir.contractor')}</span> : null}</div>
      <div class="muted">{roleOf(s.seed, i, s.dept[i])} · {deptName(s.dept[i])} · {tenureOf(s.seed, i)} yrs</div>
      <div class="pc-row"><span>{t('dir.wage')}</span><b>{money(s.w[i])}/s</b></div>
      <div class="pc-row"><span>{t('dir.contrib')}</span><b>{est.toFixed(2)}{sigma > 0 ? ` ±${Math.round(sigma * 40)}%` : ''}</b></div>
      <div class="pc-row"><span>Net value</span><b class={nv > 0 ? 'good' : 'bad'}>{nv >= 0 ? '+' : ''}{money(nv)}/s</b></div>
      <div class="pc-row"><span>{t('dir.payback')}</span><b>{isFinite(pb) ? clock(pb) : '—'}</b></div>
      <div class="muted small">{quirkOf(s.seed, i)}</div>
      {alive ? <button class="btn danger" disabled={!!err} onClick={() => act((st) => cut(st, i))}>{t('dir.cut')} ({money(sevOf(s, i))}){err === 'cash' ? ' – need cash' : err === 'badge' ? ' – not yet' : ''}</button> : <div class="muted">Transitioned.</div>}
    </div>
  );
}

export function Floor({ dismantle = 0 }: { dismantle?: number }) {
  const g = useGame(); const wrap = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  const w = useWidth(wrap); const [hover, setHover] = useState(-1);
  const ghosts = useRef<Ghost[]>([]); const prev = useRef<Uint8Array | null>(null);
  const { gh, strip } = floorLayout(w); const reduced = g.opts.reduced || g.opts.stable;
  useEffect(() => {
    const s = g.s; const now = performance.now(); const { cell } = floorLayout(w);
    const cur = new Uint8Array(s.fl.length); for (let i = 0; i < s.fl.length; i++) cur[i] = s.fl[i] & F_ALIVE;
    if (prev.current && prev.current.length === cur.length) for (let i = 0; i < cur.length; i++) if (prev.current[i] && !cur[i]) ghosts.current.push({ x: (i % 40) * cell + cell / 2, y: Math.floor(i / 40) * cell + cell / 2, t0: now, col: DEPTS[s.dept[i]].color });
    prev.current = cur; ghosts.current = ghosts.current.filter((q) => now - q.t0 < 500).slice(-120);
    const c = cv.current!; const ctx = setupCanvas(c, floorLayout(w).gw, gh + strip);
    let raf = 0; const draw = () => { drawFloor(ctx, floorLayout(w).gw, s, g.d, g.sel, hover, ghosts.current, performance.now(), reduced, dismantle); if (ghosts.current.some((q) => performance.now() - q.t0 < 460)) raf = requestAnimationFrame(draw); };
    draw(); return () => cancelAnimationFrame(raf);
  }, [g.v, w, hover, g.sel, dismantle]);
  const pos = (e: PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return floorHit(floorLayout(w).gw, e.clientX - r.left, e.clientY - r.top); };
  return (
    <div class="floor" ref={wrap}>
      <canvas ref={cv} role="img" aria-label={`The Floor: ${int(g.d.humans)} people across nine departments`} onPointerMove={(e) => setHover(pos(e as unknown as PointerEvent))} onPointerLeave={() => setHover(-1)} onClick={(e) => { const i = pos(e as unknown as PointerEvent); G.sel = i; G.v++; act(() => 0); }} />
      <div class="legend" aria-hidden="true">{DEPTS.map((d, i) => <span key={i} style={{ color: d.color }}>{d.glyph} <span class="muted">{deptName(i).slice(0, 3)} {g.s.dn[i]}</span></span>)}</div>
      {g.sel >= 0 && g.sel < g.s.dept.length ? <PersonCard i={g.sel} /> : <div class="hint">{g.s.cuts < 10 ? <div class="firstrun"><b>Find efficiencies.</b> <span class="memo">The grey ○ Innovation Lab, bottom of the Floor, produces nothing. Start there. Click anyone for their card, or use the Directory below.</span><div class="btnrow"><button class="btn primary" disabled={g.s.cash < 60} onClick={() => act((st) => wave(st, 8, 3, 1e9))}>Transition 3 from the Innovation Lab</button></div></div> : <div class="muted small">{t('floor.hint')}</div>}</div>}
    </div>
  );
}

export function Portfolio() {
  const g = useGame(); const wrap = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null); const w = useWidth(wrap); const h = Math.max(220, Math.min(380, Math.round(w * 0.55)));
  const [sel, setSel] = useState(-1);
  useEffect(() => { const ctx = setupCanvas(cv.current!, w, h); drawTreemap(ctx, w, h, g.s, performance.now(), g.d.kappa); }, [g.v, w, h]);
  const hit = (e: MouseEvent) => { const r = cv.current!.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const rects = squarify(g.s.tiles, w - 4, h - 4); const f = rects.find((q) => x >= q.x + 2 && x <= q.x + q.w && y >= q.y + 2 && y <= q.y + q.h); setSel(f ? f.i : -1); };
  const tile = sel >= 0 ? g.s.tiles[sel] : null;
  return (
    <div class="portfolio" ref={wrap}>
      {!g.s.flags.zoomSeen ? <div class="zoomcap card"><span>{t('zoom.cap')}</span> <button class="btn sm" onClick={() => act((st) => { st.flags.zoomSeen = 1; })}>{t('zoom.ok')}</button></div> : null}
      <canvas ref={cv} role="img" aria-label={`Portfolio of ${g.s.tiles.length} holdings, ${int(g.d.E)} roles, ${int(g.d.humans)} humans`} onClick={(e) => hit(e as unknown as MouseEvent)} />
      <div class="muted small">{tile ? `${tile.name}: ${t('hq.humans', { h: int(tileHumans(g.s, g.d.kappa, sel)), r: int(tile.size) })}, ${pct(tile.size > 0 ? 1 - tile.left / tile.size : 1)} ${t('tile.integrated')}` : `${g.s.tiles.length} holdings · ${t('hq.humans', { h: int(g.d.humans), r: int(g.d.E) })} · ${int(g.s.U)} roles awaiting integration`}</div>
      {!tile && g.d.kappa > 0.01 ? <div class="muted small">{t('hq.note')}</div> : null}
    </div>
  );
}

export function Field() {
  const g = useGame(); const cv = useRef<HTMLCanvasElement>(null); const d = g.d;
  const grey = Math.max(0, Math.min(0.85, 1 - d.dm)); const syn = d.lambdaC;
  const sm = useRef({ syn: 0, grey: 0 });
  useEffect(() => { sm.current.syn += (syn - sm.current.syn) * 0.5; sm.current.grey += (grey - sm.current.grey) * 0.5; drawField(cv.current!, g.s, sm.current.syn, sm.current.grey, performance.now()); }, [g.v]);
  useEffect(() => { if (g.s.lastCust !== 1) return; const id = setInterval(() => drawField(cv.current!, g.s, sm.current.syn, sm.current.grey, performance.now()), 250); return () => clearInterval(id); }, [g.s.lastCust]);
  return (
    <div class="field">
      <canvas ref={cv} width={100} height={100} role="img" aria-label={`Market field: ${pct(syn)} of customers are synthetic`} />
      <div class="muted small">{pct(syn)} synthetic · {pct(grey)} exhausted · {pct(Math.max(0, 1 - syn - grey * (1 - syn)))} real</div>
    </div>
  );
}

export function Jaws() {
  const g = useGame(); const wrap = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null); const w = useWidth(wrap);
  const [show, setShow] = useState(false);
  useEffect(() => { const ctx = setupCanvas(cv.current!, w, 96); drawJaws(ctx, w, 96, g.s, g.d, g.s.act >= 2 && (g.lens || g.s.addback > 0 || g.s.flags.corrAt > 0)); }, [g.v, w, g.lens]);
  const hs = g.s.hist; const last = hs[hs.length - 1];
  const rows = hs.slice(-12);
  return (
    <section class="jaws" aria-label={t('jaws.h')}>
      <div class="jaws-h"><b>{t('jaws.h')}</b><span class="muted small"><span class="key gold" />{t('jaws.mc')} <span class="key ink" />{t('jaws.hu')}{g.s.act >= 2 && g.s.addback > 0 ? <> <span class="key bad" />{t('jaws.fic')}</> : null}</span><button class="link small" onClick={() => setShow(!show)} aria-expanded={show}>{t('jaws.show')}</button></div>
      <div ref={wrap}><canvas ref={cv} role="img" aria-label={last ? `Market cap ${usd(Math.pow(10, last[1]))}, humans ${pct(last[2])} of peak` : 'No data yet'} /></div>
      {show ? <table class="data"><thead><tr><th>t</th><th>MC</th><th>Humans</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{clock(r[0])}</td><td>{usd(Math.pow(10, r[1]))}</td><td>{pct(r[2])}</td></tr>)}</tbody></table> : null}
    </section>
  );
}

export function Triangle() {
  const g = useGame(); const s = g.s; const ref = useRef<SVGSVGElement>(null);
  const tot = s.mix[0] + s.mix[1] + s.mix[2] || 1; const m = [s.mix[0] / tot, s.mix[1] / tot, s.mix[2] / tot];
  const V = [[100, 14], [20, 150], [180, 150]]; // retain top, credit left, synth right
  const px = m[0] * V[0][0] + m[1] * V[1][0] + m[2] * V[2][0], py = m[0] * V[0][1] + m[1] * V[1][1] + m[2] * V[2][1];
  const setFrom = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * 200, y = ((e.clientY - r.top) / r.height) * 160;
    const [a, b, c] = V; const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    let l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det; let l3 = 1 - l1 - l2;
    l1 = Math.max(0, l1); l2 = Math.max(0, l2); l3 = Math.max(0, l3); const z = l1 + l2 + l3; act((st) => { st.mix = [l1 / z, l2 / z, l3 / z]; });
  };
  const sl = (i: number, label: string) => (
    <label class="mixrow"><span>{label}</span><input type="range" min={0} max={100} value={Math.round(m[i] * 100)} aria-label={label} onInput={(e) => { const v = Number((e.target as HTMLInputElement).value) / 100; const o = [0, 1, 2].filter((k) => k !== i); const rest = m[o[0]] + m[o[1]] || 1e-9; const nm = [0, 0, 0]; nm[i] = v; nm[o[0]] = ((1 - v) * m[o[0]]) / rest || (1 - v) / 2; nm[o[1]] = ((1 - v) * m[o[1]]) / rest || (1 - v) / 2; act((st) => { st.mix = nm; }); }} /><b>{Math.round(m[i] * 100)}%</b></label>
  );
  const credit = s.own.bnpl;
  return (
    <div class="tri">
      <svg ref={ref} viewBox="0 0 200 160" role="img" aria-label="Demand strategy triangle" onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setFrom(e as unknown as PointerEvent); }} onPointerMove={(e) => { if (e.buttons) setFrom(e as unknown as PointerEvent); }} tabIndex={0} onKeyDown={(e) => { const k = e.key; const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0; if (!dx && !dy) return; e.preventDefault(); const r = ref.current!.getBoundingClientRect(); setFrom({ clientX: r.left + ((px + dx * 3) / 200) * r.width, clientY: r.top + ((py + dy * 3) / 160) * r.height } as PointerEvent); }}>
        <polygon points={V.map((v) => v.join(',')).join(' ')} fill="none" stroke="currentColor" opacity=".5" />
        <text x="100" y="10" text-anchor="middle" class="tl">{t('cap.retain')}</text><text x="6" y="158" class="tl">{t('cap.credit')}{credit ? '' : ' 🔒'}</text><text x="194" y="158" text-anchor="end" class="tl">{t('cap.synth')}</text>
        <circle cx={px} cy={py} r="7" class="dot" />
      </svg>
      <div class="mixes">{sl(0, t('cap.retain'))}{sl(1, t('cap.credit'))}{sl(2, t('cap.synth'))}</div>
      <div class="muted small">{t('cap.mix.d')}</div>
    </div>
  );
}
export { cut, candidates, num, wave };
