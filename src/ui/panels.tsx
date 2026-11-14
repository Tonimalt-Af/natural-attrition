import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { A1, INITS, QUARTER, RACKS, STATEMENT, TIERS, GUIDANCE, A4 } from '../engine/data.ts';
import * as S from '../engine/sim.ts';
import { clock, eta, int, money, num, pct, usd } from '../engine/format.ts';
import { t, initName, initBlurb, logText, mailText, deptName, deptShort } from '../i18n/index.ts';
import { DEPTS } from '../engine/data.ts';
import { nameOf, roleOf } from '../engine/names.ts';
import { F_ALIVE, F_BADGE, F_CONTR, F_KEEPER } from '../engine/state.ts';
import { G, act, doExport, doImport, notify, resetGame, saveNow, setOpt, useGame } from './store.ts';
import { Triangle } from './stage.tsx';

const Bar = ({ v, max = 1, cls = '', label }: { v: number; max?: number; cls?: string; label?: string }) => (
  <div class={'bar ' + cls} role="progressbar" aria-valuenow={Math.round((v / max) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} /></div>
);
const Beta = () => (G.dec[7 - 7] >= 1 && !G.opts.stable && !G.opts.reduced ? <span class="beta">{t('beta')}</span> : null);

// ---------- Vitals ----------
export function Vitals() {
  const g = useGame(); const s = g.s, d = g.d; const lens = g.lens;
  const saas = g.saasOn;
  const raw = (
    <>
      <div class="vital"><span>{t('hero.cash')}</span><b>{money(s.cash)}</b></div>
      <div class="vital"><span>{t('hero.profit')}</span><b class={d.pi >= 0 ? 'good' : 'bad'}>{money(d.pi)}{t('hero.s')}</b></div>
      <div class="vital"><span>{t('hero.slides')}</span><b>{num(s.slides)}</b><small class="muted"> +{num(d.slidesRate)}{t('hero.s')}</small></div>
      {s.act === 1 ? (
        <>
          <div class="vital col"><span>{t('hero.morale')} <b>{pct(s.M)}</b></span><Bar v={s.M} cls={s.M < 0.6 ? 'warn' : ''} label={t('hero.morale')} /></div>
          <div class="vital col"><span>{t('hero.exposure')} <b>{Math.round(s.X)}</b>/100</span><Bar v={s.X} max={100} cls={s.X > 70 ? 'warn' : ''} label={t('hero.exposure')} /></div>
        </>
      ) : (
        <>
          <div class="vital" title={t('hq.note')}><span>Roles <i class="muted small">(org chart)</i></span><b>{int(d.E)}</b></div>
          <div class="vital"><span>{t('cap.debt')}</span><b>{money(s.debt)}</b></div>
          <div class="vital col"><span>{t('hero.scandal')} <b>{Math.round(s.S)}</b>/100</span><Bar v={s.S} max={100} cls={s.S > 60 ? 'warn' : ''} label={t('hero.scandal')} /></div>
          <div class="vital" title={t('hq.note')}><span>Humans <i class="muted small">(in the roles)</i></span><b>{int(d.humans)}</b>{s.act >= 2 && s.act <= 3 && <i class="muted small" style="display:block">{t('hq.keep', { p: pct(Math.max(0, 1 - d.kappa)) })}</i>}</div>
        </>
      )}
    </>
  );
  return (
    <aside class="vitals card" aria-label="Vitals">
      <div class="vital big"><span>{t('hero.head')} <i class="down" aria-hidden="true">↘</i></span><b data-hero>{s.act === 1 ? int(d.humans) : int(d.humans)}</b></div>
      {saas ? (
        <div class="insights">
          <div class="muted small">{t('insight.h')}</div>
          <div class="eff">{t('insight.eff')}</div>
          <details><summary>{t('insight.details')}</summary>{raw}</details>
          <button class="link small" onClick={() => setOpt('classic', true)}>{t('skip.raw')}</button>
        </div>
      ) : raw}
      {s.own.earn ? <Earnings /> : null}
      <Assistant />
      {lens ? null : null}
    </aside>
  );
}

function Assistant() {
  const g = useGame(); if (!g.saasOn) return null; const s = g.s;
  const best = INITS.filter((i) => S.visible(s, i) && !s.own[i.id]).map((i) => ({ i, c: S.costOf(s, i) })).sort((a, b) => a.c.slides - b.c.slides)[0];
  return <div class="assistant"><b>✦ {t('insight.assist')}</b><p class="small">{t('insight.asst.p')} {best ? <b>{initName(best.i.id)}</b> : 'more of the same'}. {s.S > 40 ? ' Also: consider a statement.' : ''}</p></div>;
}

function Earnings() {
  const g = useGame(); const s = g.s; const d = g.d;
  const left = Math.max(0, QUARTER - (s.t - s.q.startT)); const cur = s.act === 1 ? s.piS : s.piRepS;
  const target = s.q.street * (1 + GUIDANCE[s.guidance]);
  return (
    <section class="earn" aria-label={t('earn.h')}>
      <div class="vital"><span><b>{t('earn.h')}</b> · {t('earn.next')}</span><b>{clock(left)}</b></div>
      <div class="vital"><span>{t('earn.street')}</span><b>{money(s.q.street)}{t('hero.s')}</b></div>
      <div class="vital"><span>Run rate</span><b class={cur >= target ? 'good' : 'bad'}>{money(cur)}{t('hero.s')}</b></div>
      <div class="seg" role="radiogroup" aria-label={t('earn.guid')}>{[0, 1, 2, 3].map((k) => <button key={k} role="radio" aria-checked={s.guidance === k} class={s.guidance === k ? 'on' : ''} onClick={() => act((st) => S.setGuidance(st, k))}>{t('earn.g' + k)}</button>)}</div>
      <div class="muted small">Guide to {pct(GUIDANCE[s.guidance])} vs Street. Beat → multiple up ({['+0.5', '+1', '+2', '+4'][s.guidance]}). Miss → down ({['−1', '−2', '−4', '−8'][s.guidance]}).</div>
      {void d}
    </section>
  );
}

// ---------- Directory + Wave planner ----------
export function WavePlanner() {
  const g = useGame(); const s = g.s;
  const [dept, setDept] = useState(-1); const [wn, setWn] = useState(5); const [wpb, setWpb] = useState(300);
  if (s.act !== 1) return null;
  return (
    <section class="card waveCard">
      <div class="wave" role="group" aria-label={t('wave.h')}>
        <b>{t('wave.h')}</b>
        <label>{t('wave.dept')}<select value={dept} onChange={(e) => setDept(Number((e.target as HTMLSelectElement).value))}><option value={-1}>{t('wave.all')}</option>{DEPTS.map((_, i) => <option key={i} value={i}>{deptName(i)}</option>)}</select></label>
        <label>{t('wave.n')}<input type="number" min={1} max={200} value={wn} onInput={(e) => setWn(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} /></label>
        <label>{t('wave.pb')}<input type="number" min={10} max={3600} value={wpb} onInput={(e) => setWpb(Math.max(10, Number((e.target as HTMLInputElement).value) || 10))} /></label>
        <button class="btn danger" onClick={() => act((st) => S.wave(st, dept, wn, wpb))}>{t('wave.go')}</button>
        <div class="muted small">{t('wave.hint')}</div>
      </div>
    </section>
  );
}

export function Directory() {
  const g = useGame(); const s = g.s; const d = g.d;
  const [dept, setDept] = useState(-1); const [sort, setSort] = useState<'pb' | 'net' | 'wage'>('pb'); const [q, setQ] = useState('');
  if (s.act !== 1) return null;
  let rows = S.candidates(s, d, dept, false).map((c) => ({ ...c, name: nameOf(s.seed, c.i) }));
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  rows.sort((a, b) => (sort === 'pb' ? a.pb - b.pb : sort === 'net' ? b.net - a.net : s.w[b.i] - s.w[a.i]));
  rows = rows.slice(0, 24);
  const ghosts = s.ghosts.slice(-6);
  return (
    <section class="dir card" aria-label={t('tab.dir')}>
      <div class="dir-h"><h3>{t('tab.dir')}</h3><span class="muted small">{t('act1.hint')}</span></div>
      <div class="filters"><input type="search" placeholder={t('dir.search')} aria-label={t('dir.search')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <label>{t('dir.sort')} <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as 'pb')}><option value="pb">{t('dir.payback')}</option><option value="net">Net value</option><option value="wage">{t('dir.wage')}</option></select></label></div>
      <div class="tablewrap"><table class="data">
        <thead><tr><th>{t('dir.name')}</th><th>{t('dir.dept')}</th><th class="r">{t('dir.wage')}</th><th class="r">Net</th><th class="r">{t('dir.payback')}</th><th /></tr></thead>
        <tbody>{rows.map((r) => { const f = s.fl[r.i]; return (
          <tr key={r.i} class={G.sel === r.i ? 'sel' : ''} onClick={() => { G.sel = r.i; notify(); }}>
            <td>{r.name}{f & F_KEEPER && S.mapped(s) ? <span class="chip">{t('dir.keeper')}</span> : null}{f & F_BADGE ? <span class="chip">{t('dir.badge')}</span> : null}<div class="muted small">{roleOf(s.seed, r.i, s.dept[r.i])}</div></td>
            <td><span style={{ color: DEPTS[s.dept[r.i]].color }}>{DEPTS[s.dept[r.i]].glyph}</span> {deptShort(s.dept[r.i])}</td>
            <td class="r">{money(s.w[r.i])}</td><td class={'r ' + (r.net > 0 ? 'good' : 'bad')}>{r.net >= 0 ? '+' : ''}{money(r.net)}</td><td class="r">{r.pb < 1e5 ? clock(r.pb) : '—'}</td>
            <td><button class="btn sm" disabled={!!S.canCut(s, r.i)} onClick={(e) => { e.stopPropagation(); act((st) => S.cut(st, r.i)); }}>{t('dir.cut')}</button></td></tr>
        ); })}</tbody></table></div>
      {s.own.consult && ghosts.length ? <div class="alumni"><b>Alumni</b><div class="muted small">Re-engage as a Senior Transitional Advisor (3× the rate).</div>{ghosts.map((i) => <div class="row" key={i}><span>{nameOf(s.seed, i)} <span class="muted small">{roleOf(s.seed, i, s.dept[i])}</span></span><button class="btn sm" disabled={s.cash < A1.REHIRE_RETAINER * s.w[i]} onClick={() => act((st) => S.rehire(st, i))}>Rehire · {money(A1.REHIRE_RETAINER * s.w[i])}</button></div>)}</div> : null}
    </section>
  );
}

// ---------- Initiatives ----------
function Cost({ slides, cash, s }: { slides: number; cash: number; s: typeof G.s }) {
  return <span class="cost"><span class={s.slides >= slides ? '' : 'short'}>{num(slides)} {t('init.slides')}</span>{cash > 0 ? <span class={s.cash >= cash ? '' : 'short'}> · {money(cash)}</span> : null}</span>;
}
function Card({ id }: { id: string }) {
  const g = useGame(); const s = g.s; const it = INITS.find((i) => i.id === id)!; const c = S.costOf(s, it);
  const prog = Math.min(1, Math.min(s.slides / Math.max(c.slides, 1), c.cash > 0 ? s.cash / c.cash : 1));
  const err = S.canBuy(s, id); const etaS = Math.max((c.slides - s.slides) / Math.max(g.d.slidesRate, 1e-6), c.cash > s.cash ? (c.cash - s.cash) / Math.max(g.d.pi, 1e-6) : 0);
  return (
    <div class={'init' + (!err ? ' ready' : '')}>
      <div class="init-h"><b>{initName(id)}</b><Beta /></div>
      <div class="muted small">{initBlurb(id)}{id === 'memo' && s.act === 1 ? ` (Headcount now ${int(g.d.humans)}.)` : ''}</div>
      <div class="init-f"><Cost slides={c.slides} cash={c.cash} s={s} />{!err ? null : <span class="muted small">{err === 'h' ? `needs ≤ ${A1.END_H}` : `${t('init.afford')} ${eta(etaS)}`}</span>}
        <button class="btn" disabled={!!err} onClick={() => act((st) => S.buy(st, id))}>{t('init.buy')}</button></div>
      <i class="hair" style={{ width: `${prog * 100}%` }} />
    </div>
  );
}
export function Initiatives() {
  const g = useGame(); const s = g.s; const d = g.d;
  const [open, setOpen] = useState(false);
  let list = INITS.filter((i) => !s.own[i.id] && S.visible(s, i) && i.act <= s.act);
  list = list.sort((a, b) => S.costOf(s, a).slides - S.costOf(s, b).slides);
  if (G.dec[7] >= 1 && !G.opts.stable && !G.opts.reduced) list = list.slice().sort((a, b) => S.costOf(s, b).cash - S.costOf(s, a).cash);
  const owned = INITS.filter((i) => s.own[i.id]);
  const goal = S.nextGoal(s, d);
  const pizzaCd = Math.max(0, A1.PIZZA_CD - (s.t - s.pizzaAt));
  const gens: JSX.Element[] = [];
  if (s.act === 1) gens.push(<div class="init gen" key="pizza"><div class="init-h"><b>{t('init.pizza')}</b></div><div class="muted small">{t('init.pizza.d')}</div><div class="init-f"><span class="cost">{money(A1.PIZZA_COST)}</span><button class="btn" disabled={pizzaCd > 0 || s.cash < A1.PIZZA_COST} onClick={() => act((st) => S.pizza(st))}>{pizzaCd > 0 ? `${Math.ceil(pizzaCd)} s` : t('init.buy')}</button></div></div>);
  if (s.own.consult) { const cap = S.assocCap(s), full = s.assoc >= cap, maxNeed = Math.max(0, ...list.map((i) => S.costOf(s, i).slides)), surplusS = s.slides > Math.max(300, 1.5 * maxNeed);
    gens.push(<div class="init gen" key="assoc"><div class="init-h"><b>{t('init.assoc')}</b><span class="count">{s.assoc <= cap ? `${s.assoc}/${cap}` : s.assoc}</span></div><div class="muted small">{t('init.assoc.d')} {t('assoc.eff', { s: A1.ASSOC_SLIDES, u: A1.ASSOC_UPKEEP })}</div>{full ? <div class="muted small">{t('assoc.cap')}</div> : surplusS ? <div class="muted small">{t('assoc.surplus', { n: num(s.slides) })}</div> : null}<div class="init-f"><span class="cost">{money(S.assocCost(s))}</span><button class="btn" disabled={full || s.cash < S.assocCost(s)} onClick={() => act((st) => S.buyGen(st, 'assoc'))}>{t('init.buy')}</button></div></div>); }
  { const di = S.deckInfo(s, d); if (di.unlocked && s.act <= 3) gens.push(<div class="init gen" key="deck"><div class="init-h"><b>{t('deck.h')}</b></div><div class="muted small">{t('deck.d')}</div><div class="init-f"><span class="cost">{di.surplus >= 100 ? <>{t('deck.sur', { n: num(di.surplus) })} · <b>{t('deck.get', { c: money(di.gain) })}</b></> : t('deck.none')}</span><button class="btn" disabled={!di.ok} onClick={() => act((st) => { S.presentDeck(st); })}>{di.cd > 0 ? t('deck.cd', { s: Math.ceil(di.cd) }) : t('deck.btn')}</button></div></div>); }
  if (s.own.partners) gens.push(<div class="init gen" key="partner"><div class="init-h"><b>{t('init.partner')}</b><span class="count">{s.partners}</span></div><div class="muted small">{t('init.partner.d')}</div><div class="init-f"><span class="cost">{money(S.partnerCost(s))}</span><button class="btn" disabled={s.cash < S.partnerCost(s)} onClick={() => act((st) => S.buyGen(st, 'partner'))}>{t('init.buy')}</button></div></div>);
  if (s.act >= 2) TIERS.forEach((tr, i) => { if (i > 0 && s.rc[i - 1] < tr.unlockPrev && !s.rc[i]) return; gens.push(<div class="init gen" key={'rc' + i}><div class="init-h"><b>{t('init.rc' + i)}</b><span class="count">{s.rc[i]}</span></div><div class="muted small">{t('init.rc.d')} +{num(tr.yield)}/s each.</div><div class="init-f"><span class="cost">{money(S.tierCost(s, i))}</span><button class="btn" disabled={s.cash < S.tierCost(s, i)} onClick={() => act((st) => S.buyGen(st, 'rc', i))}>{t('init.buy')}</button></div></div>); });
  if (s.act >= 3) RACKS.forEach((rk, i) => { if ((i === 0 && !s.own.synth1) || (i === 1 && !s.own.synth2)) return; gens.push(<div class="init gen" key={'rk' + i}><div class="init-h"><b>{t('init.rk' + i)}</b><span class="count">{s.racks[i]}</span></div><div class="muted small">{t('init.rk.d')}</div><div class="init-f"><span class="cost">{money(S.rackCost(s, i))}</span><button class="btn" disabled={s.cash < S.rackCost(s, i)} onClick={() => act((st) => S.buyGen(st, 'rack', i))}>{t('init.buy')}</button></div></div>); });
  return (
    <div class="inits">
      <div class="goal card"><span class="muted small">{t('init.next')}</span>{goal ? <><b>{initName(goal.id)}</b>{goal.orc ? <span class="small">{t('bid.orc.goal')}</span> : null}<span class="small">{goal.blocker === 'ready' ? t('goal.ready') : t('goal.' + goal.blocker, { n: goal.blocker === 'cash' ? money(goal.need) : num(goal.need), have: goal.blocker === 'cash' ? money(goal.have) : num(goal.have), eta: eta(goal.eta) })}</span></> : <span class="muted">{t('init.wait')}</span>}</div>
      {gens}
      {list.map((i) => <Card key={i.id} id={i.id} />)}
      {owned.length ? <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}><summary>{t('init.owned')} ({owned.length})</summary><ul class="ownedlist">{owned.map((i) => <li key={i.id}>{initName(i.id)}</li>)}</ul></details> : null}
    </div>
  );
}

// ---------- Inbox & log ----------
export function Inbox() {
  const g = useGame(); const s = g.s; const mails = s.inbox.slice().reverse().slice(0, 40);
  return (
    <div class="inbox">
      <div class="inbox-h"><button class="link small" onClick={() => act((st) => { st.inbox.forEach((m) => (m.read = true)); })}>{t('inbox.mark')}</button></div>
      {mails.length ? mails.map((m, i) => { const [from, sub, body] = mailText(s, m); return (
        <article class={'mail' + (m.read ? '' : ' unread')} key={m.t + m.id + i} onClick={() => { if (!m.read) { m.read = true; notify(); } }}>
          <header><b>{from}</b><span class="muted small">{clock(m.t)}</span></header><div class="sub">{sub}</div><p class="memo">{body}</p></article>); }) : <div class="muted empty">{t('inbox.empty')}</div>}
    </div>
  );
}
export function LogView({ n = 40 }: { n?: number }) {
  const g = useGame(); const s = g.s; const hr = g.dec[4] >= 1 && !g.opts.stable && !g.opts.reduced;
  const lines = s.log.slice(-n).reverse();
  return <div class="log" role="log" aria-live="polite" aria-relevant="additions">{lines.length ? lines.map((l, i) => <div key={l.t + l.k + i} class={'logline ' + (l.tone ?? '')}><span class="muted mono">{clock(l.t)}</span> <span class="memo">{logText(s, l, hr)}</span></div>) : <div class="muted empty">{t('log.empty')}</div>}</div>;
}

/** The newest log line, always visible: the jokes live here, not in a hidden tab. */
export function Ticker() {
  const g = useGame(); const s = g.s; const hr = g.dec[4] >= 1 && !g.opts.stable && !g.opts.reduced;
  const l = s.log[s.log.length - 1]; if (!l) return null;
  return <div class={'ticker ' + (l.tone ?? '')} role="status" aria-live="off"><span class="mono muted">{clock(l.t)}</span> <span key={l.t + l.k} class="tk">{logText(s, l, hr)}</span></div>;
}

// ---------- Capital ----------
export function Capital() {
  const g = useGame(); const s = g.s; const d = g.d;
  if (s.act < 2) return <div class="muted empty">Capital opens when the Synergy Memo is signed.</div>;
  const mood = S.moodNow(s); const [cards, setCards] = useState<number[]>([-1, -1, -1]);
  const decks = STATEMENT.cards;
  const moodNames = STATEMENT.moods;
  const clue = ['The room is red in the face. Someone has stood up.', 'Arms are folded. Someone is reading your footnotes.', 'Everyone is nodding. Nobody has read anything.', 'Phones are out. A man is looking at the ceiling.'][mood];
  const aud = s.pendAudit;
  return (
    <div class="capital">
      {aud ? (
        <section class="card audit" role="alertdialog" aria-label={t('cap.audit')}>
          <h3>{t('cap.audit')}</h3><p class="memo">Pym, Halloway & Orr are in the lobby. {clock(Math.max(0, aud - s.t))} until they stop being polite.</p>
          <div class="btnrow"><button class="btn" onClick={() => act((st) => S.auditChoice(st, 'lunch'))}>{t('cap.audit.lunch')}</button><button class="btn" onClick={() => act((st) => S.auditChoice(st, 'restate'))}>{t('cap.audit.restate')}</button><button class="btn" onClick={() => act((st) => S.auditChoice(st, 'switch'))}>{t('cap.audit.switch')}</button><button class="btn ghost" onClick={() => act((st) => S.auditChoice(st, 'ignore'))}>{t('cap.audit.ignore')}</button></div>
        </section>
      ) : null}
      <section class="card">
        <h3>{t('cap.h')}</h3>
        <div class="kv"><span>{t('cap.debt')}</span><b>{money(s.debt)}</b></div>
        <div class="kv"><span>{t('cap.cap')} <span class="muted small">({d.levMax}× reported profit)</span></span><b>{money(d.debtCap)}</b></div>
        <Bar v={s.debt} max={Math.max(d.debtCap, 1)} cls={s.debt > d.debtCap ? 'warn' : ''} label={t('cap.debt')} />
        <div class="muted small">Lenders read the reported number.</div>
        <div class="btnrow"><button class="btn sm" onClick={() => act((st) => S.repay(st))} disabled={s.debt <= 0 || s.cash <= 0}>{t('cap.repay')}</button>
          <div class="seg" role="radiogroup" aria-label={t('cap.fund')}><button role="radio" aria-checked={!s.flags.debtFirst} class={!s.flags.debtFirst ? 'on' : ''} onClick={() => act((st) => { st.flags.debtFirst = 0; })}>{t('cap.fund.cash')}</button><button role="radio" aria-checked={!!s.flags.debtFirst} class={s.flags.debtFirst ? 'on' : ''} onClick={() => act((st) => { st.flags.debtFirst = 1; })}>{t('cap.fund.debt')}</button></div></div>
        <label class="slider"><span>{t('cap.int')}: <b>{s.intensity.toFixed(1)}×</b></span><input type="range" min={0.5} max={2} step={0.1} value={s.intensity} onInput={(e) => act((st) => S.setIntensity(st, Number((e.target as HTMLInputElement).value)))} /></label>
        <div class="muted small">{t('cap.int.d')}</div>
        {S.abMax(s) > 0 ? <><label class="slider"><span>{t('cap.addback')}: <b>{s.addback}</b> / {S.abMax(s)}</span><input type="range" min={0} max={S.abMax(s)} step={1} value={s.addback} onInput={(e) => act((st) => S.setAddback(st, Number((e.target as HTMLInputElement).value)))} /></label><div class="muted small">{t('cap.addback.d')}</div></> : null}
        <div class="kv"><span>Blocked by scandal?</span><b>{Math.round(s.S)}/100</b></div>
        {s.own.aiwash ? <button class="btn sm" disabled={s.t - s.washAt < 60} onClick={() => act((st) => S.aiwash(st))}>{t('cap.aiwash')}{s.t - s.washAt < 60 ? ` (${Math.ceil(60 - (s.t - s.washAt))} s)` : ''}</button> : null}
      </section>
      <section class="card reality" aria-label="Reality table">
        <h3>{t('cap.lens')}</h3>
        <table class="data"><thead><tr><th /><th class="r">{t('cap.rep')}</th><th class="r">{t('cap.real')}</th></tr></thead><tbody>
          <tr><td>Market cap</td><td class="r">{usd(d.mcRep)}</td><td class="r">{usd(d.mcReal)}</td></tr>
          <tr><td>Profit/s</td><td class="r">{money(d.piRep)}</td><td class="r">{money(d.pi)}</td></tr>
          <tr><td>{t('cap.fiction')}</td><td class="r" colSpan={2}>{pct(Math.min(9.99, d.phiF))} of a year’s profit</td></tr>
        </tbody></table>
        <button class={'btn sm' + (g.lens ? ' on' : '')} aria-pressed={g.lens} onClick={() => { G.lens = !G.lens; notify(); }}>{t('cap.lens')}</button> <span class="muted small">{t('cap.lens.d')}</span>
        <p class="sr-only" aria-live="polite">Reported {usd(d.mcRep)}, real {usd(d.mcReal)}</p>
      </section>
      {s.own.statement ? (
        <section class="card stmt"><h3>{t('cap.stmt')}</h3><div class="muted small">{t('cap.stmt.d')}</div>
          <div class="mood"><b>{t('cap.mood')}:</b> <span class="memo">{clue}</span></div>
          {decks.map((deck, di) => <div class="deck" key={di} role="radiogroup" aria-label={`Card ${di + 1}`}>{deck.map((c, k) => <button key={k} role="radio" aria-checked={cards[di] === k} class={'cardbtn mono' + (cards[di] === k ? ' on' : '')} onClick={() => { const n = cards.slice(); n[di] = k; setCards(n); }}>{c}</button>)}</div>)}
          <button class="btn" disabled={cards.some((c) => c < 0) || s.slides < STATEMENT.cost} onClick={() => { act((st) => S.statement(st, cards)); setCards([-1, -1, -1]); }}>{t('cap.send')} · {STATEMENT.cost} {t('init.slides')}</button>
          <div class="muted small sr-only">{moodNames[mood]}</div>
        </section>
      ) : null}
      {s.act >= 3 ? (
        <section class="card"><h3>{t('cap.mixes')}</h3><Triangle />
          <div class="kv"><span>{t('cap.closure')}</span><b>{pct(d.lambdaC)}</b></div><Bar v={d.lambdaC} cls="blue" label={t('cap.closure')} />
          <div class="kv"><span>{t('cap.demand')}</span><b>{pct(Math.max(0, d.dm))}</b></div><Bar v={Math.max(0, d.dm)} label={t('cap.demand')} />
          <div class="kv"><span>{t('cap.hd')}</span><b>{pct(d.hdRatio)}</b></div><Bar v={d.hdRatio} max={1} cls={d.hdRatio > 0.7 ? 'warn' : ''} label={t('cap.hd')} />
          {s.own.secur ? <button class="btn sm" disabled={s.HD <= 0} onClick={() => act((st) => S.securitize(st))}>{t('cap.secur')}</button> : null}
        </section>
      ) : null}
    </div>
  );
}

// ---------- Targets (Act II/III) ----------
export function Targets() {
  const g = useGame(); const s = g.s; const d = g.d; if (s.act < 2 || s.act > 3) return null;
  const why = s.targets.map((tg) => S.canBid(s, d, tg));
  const allOrc = s.targets.length > 0 && why.every((w) => w === 'orc'), allCap = s.targets.length > 0 && why.every((w) => w === 'cap'), allCash = s.targets.length > 0 && why.every((w) => w === 'cash');
  const rc = INITS.find((i) => i.id === 'regcap')!; const rcc = S.costOf(s, rc);
  const rcEta = Math.max(rcc.slides > s.slides ? (rcc.slides - s.slides) / Math.max(d.slidesRate, 1e-6) : 0, rcc.cash > s.cash ? (rcc.cash - s.cash) / Math.max(d.pi, 1e-6) : 0);
  const orcAny = why.some((w) => w === 'orc');
  return (
    <section class="card targets" aria-label={t('targets.h')}>
      <h3>{t('targets.h')}</h3>
      {s.act === 3 && !s.own.regcap && orcAny && (allOrc || why.every((w) => w === 'orc' || w === 'cap')) ? <div class="banner orc" role="status"><span>{t('bid.banner.orc')}</span> <b>{t('bid.banner.orc2')}</b> <span class="muted small">{rcc.slides > s.slides ? `${num(rcc.slides)} Slides (${num(s.slides)} so far)` : `${num(rcc.slides)} Slides ✓`}{rcc.cash > 0 ? ` · ${money(rcc.cash)}` : ''} · {rcEta < 1 ? t('goal.ready') : `${t('init.afford')} ${eta(rcEta)}`}{S.visible(s, rc) ? '' : ' · appears at 40% consolidation'}</span></div> : allCap ? <div class="banner" role="status">{t('bid.banner.cap')}</div> : allCash ? <div class="banner" role="status">{t('bid.banner.cash')}</div> : null}
      <div class="tablewrap"><table class="data"><thead><tr><th>Company</th><th class="r">{t('targets.size')}</th><th class="r">{t('targets.cost')}</th><th /></tr></thead><tbody>
        {s.targets.map((tg, i) => { const cost = S.bidCost(s, d, tg.size); const w = why[i];
          return <tr key={tg.id}><td>{tg.name}<div class="muted small">{t('culture.' + ['family', 'union', 'vc', 'founder'][tg.cult])}</div></td><td class="r">{int(tg.size)}</td><td class="r">{money(cost)}</td><td><button class="btn sm" disabled={!!w} title={w ? t('bid.' + w, { n: money(Math.max(0, cost - s.cash)) }) : ''} onClick={() => act((st) => S.bid(st, tg.id))}>{w ? t('bid.' + w, { n: money(Math.max(0, cost - s.cash)) }) : t('targets.bid')}</button></td></tr>; })}
      </tbody></table></div>
      <div class="muted small">Price per employee {money(d.price * d.stockF)} · stock-funded share {pct(1 - d.stockF)} cheaper at a high multiple.</div>
    </section>
  );
}

// ---------- Settings & Debug ----------
export function Settings() {
  const g = useGame(); const o = g.opts; const [txt, setTxt] = useState(''); const [msg, setMsg] = useState(''); const [rs, setRs] = useState('');
  const Tg = ({ k, label }: { k: 'stable' | 'reduced' | 'contrast' | 'sound' | 'noMeta'; label: string }) => <label class="chk"><input type="checkbox" checked={!!o[k]} onChange={(e) => setOpt(k, (e.target as HTMLInputElement).checked)} /> {label}</label>;
  return (
    <div class="settings card">
      <h3>{t('settings.h')}</h3>
      <Tg k="stable" label={t('settings.stable')} /><Tg k="reduced" label={t('settings.reduced')} /><Tg k="contrast" label={t('settings.contrast')} /><Tg k="noMeta" label={t('settings.nometa')} />
      <label class="slider"><span>{t('settings.text')}: <b>{o.text}%</b></span><input type="range" min={90} max={140} step={5} value={o.text} onInput={(e) => setOpt('text', Number((e.target as HTMLInputElement).value))} /></label>
      <label class="slider"><span>{t('settings.cap')}: <b>{o.capH}</b></span><input type="range" min={1} max={8} value={o.capH} onInput={(e) => setOpt('capH', Number((e.target as HTMLInputElement).value))} /></label>
      <div><button class="btn sm" onClick={() => { setOpt('classic', !o.classic); if (!o.classic && !g.s.flags.rdBonus && g.s.flags.redesign) { g.s.flags.rdBonus = 1; g.s.slides += 1; S.log(g.s, 'redesign_off', undefined, 'meta'); } }}>{o.classic ? 'Enable updated experience' : t('settings.classic')}</button><div class="muted small">{t('settings.classic.d')}</div></div>
      <hr />
      <div class="btnrow">
        <button class="btn sm" onClick={async () => { const x = await doExport(); setTxt(x); setMsg('Export ready (below).'); try { const a = document.createElement('a'); const d = new Date(); a.href = URL.createObjectURL(new Blob([x], { type: 'text/plain' })); a.download = `natural-attrition-${d.toISOString().slice(0, 16).replace(/[-:T]/g, '')}.nasave`; a.click(); } catch { /* ignore */ } }}>{t('settings.export')}</button>
        <button class="btn sm" onClick={async () => { const x = await doExport(); try { await navigator.clipboard.writeText(x); setMsg('Copied.'); } catch { setTxt(x); setMsg('Copy failed — select the text below.'); } }}>{t('settings.copy')}</button>
        <button class="btn sm" disabled={!txt.trim()} onClick={async () => setMsg((await doImport(txt)) ? 'Imported.' : 'That does not look like a save.')}>{t('settings.import')}</button>
      </div>
      <textarea rows={3} placeholder={t('settings.paste')} aria-label={t('settings.paste')} value={txt} onInput={(e) => setTxt((e.target as HTMLTextAreaElement).value)} />
      {msg ? <div class="muted small" role="status">{msg}</div> : null}
      <hr />
      <div class="reset"><div class="muted small">{t('settings.reset.p')}</div><input aria-label="Type RESIGN" value={rs} onInput={(e) => setRs((e.target as HTMLInputElement).value)} /> <button class="btn sm danger" disabled={rs !== 'RESIGN'} onClick={() => { resetGame(); }}>{t('settings.reset')}</button></div>
      <p class="muted small">{t('settings.about')}</p>
    </div>
  );
}

const JUMPS = ['act1-mid', 'act1-end', 'act2-start', 'act2-mid', 'act3-start', 'act3-mid', 'act4'];
export function Debug() {
  const g = useGame(); const s = g.s; if (!g.debug) return null;
  return (
    <div class="debug card" aria-label={t('debug.h')}>
      <b>{t('debug.h')}</b>
      <div class="seg">{[1, 4, 16, 64, 256].map((x) => <button key={x} class={g.speed === x ? 'on' : ''} onClick={() => { g.speed = x; notify(); }}>×{x}</button>)}<button class={g.paused ? 'on' : ''} onClick={() => { g.paused = !g.paused; notify(); }}>{t('debug.pause')}</button></div>
      <div class="btnrow"><button class="btn sm" onClick={() => act((st) => { st.cash += 1e5; st.slides += 1000; })}>+cash +slides</button><button class="btn sm" onClick={() => act((st) => { st.cash *= 100; st.slides *= 100; })}>×100</button><button class="btn sm" onClick={() => act((st) => { st.M = 0.9; st.X = 0; })}>morale</button>
        <select aria-label={t('debug.jump')} onChange={async (e) => { const v = (e.target as HTMLSelectElement).value; if (!v) return; const r = await fetch(`./fixtures/${v}.nasave`); if (r.ok) { await doImport(await r.text()); g.meta.debugUsed = true; } }}><option value="">{t('debug.jump')}…</option>{JUMPS.map((j) => <option key={j}>{j}</option>)}</select></div>
      <div class="muted small mono">t={s.t.toFixed(0)} act={s.act} E={num(g.d.E)} π={num(g.d.pi)} φ={g.d.phi.toFixed(3)} λc={g.d.lambdaC.toFixed(2)} dm={g.d.dm.toFixed(2)} hz: F={g.d.phiF.toFixed(2)}</div>
    </div>
  );
}
export { saveNow, F_ALIVE, F_CONTR, A4 };
