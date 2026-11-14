import { useEffect, useRef, useState } from 'preact/hooks';
import { A3, DEPTS } from '../engine/data.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER, F_TWICE } from '../engine/state.ts';
import { tileHumans, canCut, candidates, cut, wave, estC, mapped, netValue, sevOf, noiseLevel, offer, canReengage, reengage, dmGain, goal3 } from '../engine/sim.ts';
import { nameOf, quirkOf, roleOf, tenureOf } from '../engine/names.ts';
import { clock, int, num, money, pct, usd } from '../engine/format.ts';
import { t, deptName } from '../i18n/index.ts';
import { eta } from '../engine/format.ts';
import { G, act, useGame } from './store.ts';
import { drawFloor, drawJaws, drawTreemap, floorHit, floorLayout, setupCanvas, squarify, type Ghost } from './canvas.ts';

function useWidth(ref: { current: HTMLElement | null }) {
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(200, Math.floor(el.clientWidth)))); ro.observe(el); setW(Math.max(200, el.clientWidth)); return () => ro.disconnect();
  }, []);
  return w;
}

/** Act III: how this person left, and what bringing them back costs and does. */
export function exitLine(s: typeof G.s, i: number): string {
  const w = s.cutW[i];
  if (w > 0) return t('a3.cutw', { w, k: s.waves[w - 1] ?? 1, time: clock(s.cutT[i]) }) + (s.fl[i] & F_TWICE ? ' ' + t('a3.twice') : '');
  return t('a3.left', { time: clock(s.cutT[i]) });
}
function OfferCard({ i }: { i: number }) {
  const g = useGame(); const s = g.s; const d = g.d; const dep = DEPTS[s.dept[i]]; const f = s.fl[i];
  const head = (
    <><div class="pc-h"><span class="glyph" style={{ color: dep.color }}>{dep.glyph}</span> <b>{f & F_BADGE ? s.name : nameOf(s.seed, i)}</b>{i === s.first ? <span class="chip">{t('a3.firstchip')}</span> : null}{f & F_CONTR ? <span class="chip">{t('dir.contractor')}</span> : null}</div>
      <div class="muted">{roleOf(s.seed, i, s.dept[i])} · {deptName(s.dept[i])} · {tenureOf(s.seed, i)} yrs</div></>
  );
  if (f & F_BADGE) return <div class="pcard" role="group" aria-label="Selected person">{head}<div class="muted small">{t('a3.badge')}</div></div>;
  if (f & F_ALIVE) return <div class="pcard" role="group" aria-label="Selected person">{head}<div class="muted small">{f & F_CONTR ? t('a3.back', { bill: money(s.w[i] * A3.PAY * Math.max(s.pi0, 1)) }) : t('a3.here')}</div></div>;
  const o = offer(s, i); const why = canReengage(s, i); const gain = dmGain(s, o.eff, d);
  const after = s.conf - o.pen; const lvl = o.grudge < 0.34 ? 0 : o.grudge < 0.67 ? 1 : 2;
  return (
    <div class="pcard" role="group" aria-label="Selected person">
      {head}
      <div class="small">{exitLine(s, i)}</div>
      <div class="muted small">{quirkOf(s.seed, i)}</div>
      {i === s.first ? <div class="small memo">{t('a3.first.card')}</div> : (
        <>
          <div class="muted small">{t('a3.grudge.' + lvl)}</div>
          <div class="pc-row"><span>{t('a3.ret')}</span><b>{money(o.ret)}</b></div>
          <div class="pc-row"><span>{t('a3.bill')}</span><b>{money(o.pay)}{t('hero.s')} <span class="muted small">(3×)</span></b></div>
          <div class="pc-row"><span>{t('a3.demand')}</span><b class="good">+{(gain * 100).toFixed(1)} pts</b></div>
          <div class="pc-row"><span>{t('a3.board')}</span><b class={after < A3.INTERV_AT ? 'bad' : ''}>−{(o.pen * 100).toFixed(0)} → {Math.max(0, Math.round(after * 100))}%</b></div>
          {after < A3.INTERV_AT ? <div class="small bad">{t('a3.warn')}</div> : null}
          <button class="btn primary" disabled={!!why} onClick={() => act((st) => reengage(st, i))}>{why === 'cash' ? t('a3.needcash', { n: money(o.ret) }) : why === 'done' ? t('a3.reeng') : t('a3.reeng') + ' · ' + money(o.ret)}</button>
        </>
      )}
    </div>
  );
}

export function PersonCard({ i }: { i: number }) {
  const g = useGame(); const s = g.s; const d = g.d;
  if (i < 0 || i >= s.dept.length) return null;
  if (s.act === 3) return <OfferCard i={i} />;
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
    if (prev.current && prev.current.length === cur.length) for (let i = 0; i < cur.length; i++) { if (prev.current[i] && !cur[i]) ghosts.current.push({ x: (i % 40) * cell + cell / 2, y: Math.floor(i / 40) * cell + cell / 2, t0: now, col: DEPTS[s.dept[i]].color }); else if (!prev.current[i] && cur[i] && s.act === 3) ghosts.current.push({ x: (i % 40) * cell + cell / 2, y: Math.floor(i / 40) * cell + cell / 2, t0: now, col: DEPTS[s.dept[i]].color, kind: 'in' }); }
    prev.current = cur; ghosts.current = ghosts.current.filter((q) => now - q.t0 < 500).slice(-120);
    const c = cv.current!; const ctx = setupCanvas(c, floorLayout(w).gw, gh + strip);
    let raf = 0; const gold = s.act === 3 && !s.flags.finAt && !reduced; const draw = () => { drawFloor(ctx, floorLayout(w).gw, s, g.d, g.sel, hover, ghosts.current, performance.now(), reduced, dismantle); if (ghosts.current.some((q) => performance.now() - q.t0 < 460)) raf = requestAnimationFrame(draw); };
    draw(); const iv = gold ? window.setInterval(draw, 160) : 0; return () => { cancelAnimationFrame(raf); if (iv) clearInterval(iv); };
  }, [g.v, w, hover, g.sel, dismantle]);
  const pos = (e: PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return floorHit(floorLayout(w).gw, e.clientX - r.left, e.clientY - r.top); };
  const shown = g.sel >= 0 ? g.sel : g.s.act === 3 ? hover : -1;
  return (
    <div class="floor" ref={wrap}>
      <canvas ref={cv} role="img" aria-label={g.s.act === 3 ? `The Floor: ${g.s.reh} re-engaged, ${g.s.dept.length - g.s.dn.reduce((a, b) => a + b, 0)} still out. Use the Re-engagement Desk below for the full list.` : `The Floor: ${int(g.d.humans)} people across nine departments`} onPointerMove={(e) => setHover(pos(e as unknown as PointerEvent))} onPointerLeave={() => setHover(-1)} onClick={(e) => { const i = pos(e as unknown as PointerEvent); G.sel = i; G.v++; act(() => 0); }} />
      <div class="legend" aria-hidden="true">{DEPTS.map((d, i) => <span key={i} style={{ color: d.color }}>{d.glyph} <span class="muted">{deptName(i).slice(0, 3)} {g.s.dn[i]}</span></span>)}</div>
      {shown >= 0 && shown < g.s.dept.length ? <PersonCard i={shown} /> : g.s.act === 3 ? <div class="hint muted small">{t('a3.hint')}</div> : <div class="hint">{g.s.cuts < 10 ? <div class="firstrun"><b>Find efficiencies.</b> <span class="memo">The grey ○ Innovation Lab, bottom of the Floor, produces nothing. Start there. Click anyone for their card, or use the Directory below.</span><div class="btnrow"><button class="btn primary" disabled={g.s.cash < 60} onClick={() => act((st) => wave(st, 8, 3, 1e9))}>Transition 3 from the Innovation Lab</button></div></div> : <div class="muted small">{t('floor.hint')}</div>}</div>}
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

const moodOf = (c: number) => (c >= 0.7 ? 0 : c >= 0.5 ? 1 : c >= A3.INTERV_AT ? 2 : 3);
/** Act III's two meters: demand coming back vs. the Board's patience, and the goal under them. */
export function Meters() {
  const g = useGame(); const s = g.s; const d = g.d; if (s.act !== 3) return null;
  return (
    <div class="meters">
      <div class="meter" role="group" aria-label={t('a3.demand')}>
        <div class="m-h"><b>{t('a3.demand')}</b><span>{pct(d.dm)} <small class="muted">→ {pct(d.dmTarget)}</small></span></div>
        <div class="m-bar" role="progressbar" aria-valuenow={Math.round(d.dm * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t('a3.demand')}><i style={{ width: `${d.dm * 100}%` }} /><u class="target" style={{ left: `${d.dmTarget * 100}%` }} /><u class="mark" style={{ left: `${A3.DM_FIN * 100}%` }} /></div>
        <small class="muted">{t('a3.demand.d', { n: Math.round(A3.DM_FIN * 100) })}</small>
      </div>
      <div class={'meter board' + (s.conf < A3.INTERV_AT + 0.1 ? ' danger' : '')} role="group" aria-label={t('a3.board')}>
        <div class="m-h"><b>{t('a3.board')}</b><span>{pct(s.conf)} <small class="muted">{t('a3.mood.' + moodOf(s.conf))}</small></span></div>
        <div class="m-bar" role="progressbar" aria-valuenow={Math.round(s.conf * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t('a3.board')}><i class="conf" style={{ width: `${s.conf * 100}%` }} /><u class="zone" style={{ width: `${A3.INTERV_AT * 100}%` }} /></div>
        <small class="muted">{t('a3.board.d', { n: Math.round(A3.INTERV_AT * 100), k: A3.INTERV_N })}</small>
      </div>
    </div>
  );
}
export function GoalCard() {
  const g = useGame(); const s = g.s; const d = g.d; if (s.act !== 3) return null;
  const gl = goal3(s, d);
  const m = gl.mandate === 1 ? t('a3.m1', { have: gl.have, need: gl.need }) : gl.mandate === 2 ? t('a3.m2', { have: Math.round(gl.have * 100) }) : gl.mandate === 3 ? t('a3.m3', { have: Math.round(gl.have * 100), n: Math.round(A3.DM_FIN * 100) }) : t('a3.m4');
  const lim = gl.limit === 'cash' ? t('a3.lim.cash', { c: money(gl.ret), have: money(s.cash), eta: eta(gl.eta) }) : gl.limit === 'board' ? t('a3.lim.board', { conf: Math.round(s.conf * 100), n: Math.round(A3.INTERV_AT * 100), eta: eta(gl.eta) }) : gl.limit === 'finale' ? t('a3.lim.finale', { c: money(gl.ret) }) : gl.limit === 'done' ? t('a3.lim.done', { eta: Math.ceil(gl.eta) }) : t('a3.lim.go');
  return <div class="goal card" role="status"><span class="muted small">{t('a3.goal', { n: gl.mandate })}</span><b>{m}</b><span class="small">{lim}</span></div>;
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

export { cut, candidates, num, wave };
