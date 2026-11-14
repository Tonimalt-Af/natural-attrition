import { useEffect, useState } from 'preact/hooks';
import { A4 } from '../engine/data.ts';
import * as S from '../engine/sim.ts';
import { clock, int, money, num, pct, usd } from '../engine/format.ts';
import { t, mailText } from '../i18n/index.ts';
import { G, act, continueGame, notify, saveNow, startNew, useGame } from './store.ts';
import { Field, Floor, Jaws, Portfolio } from './stage.tsx';
import { Capital, Debug, Directory, Initiatives, Inbox, LogView, Settings, Ticker, Targets, Vitals, WavePlanner } from './panels.tsx';
import { LOG, MAIL } from '../i18n/en.ts';

function Welcome() {
  const g = useGame(); const [name, setName] = useState('Alex');
  return (
    <main class="welcome" id="main">
      <div class="doc">
        <p class="mono muted">Q3_Workforce_Plan_FINAL_v7(2).xlsx</p>
        <h1>NATURAL ATTRITION</h1>
        <p class="memo lead">{t('welcome.h')}</p>
        <p class="memo">{t('welcome.p')}</p>
        <label class="field-l"><span class="sr-only">Badge name</span><input aria-label="Badge name" maxLength={24} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') startNew(name); }} /></label>
        <div class="btnrow">
          <button class="btn primary" onClick={() => startNew(name)}>{t('welcome.go')}</button>
          {g.hasSave ? <button class="btn" onClick={() => { continueGame(); }}>{t('welcome.cont')}</button> : null}
        </div>
        <p class="muted small">{t('welcome.fine')}</p>
      </div>
    </main>
  );
}

function Hero() {
  const g = useGame(); const s = g.s, d = g.d; const lens = g.lens && s.act >= 2;
  const mc = lens ? d.mcReal : d.mcRep; const daggers = s.act >= 2 && s.addback > 0 && !lens;
  return (
    <header class="top">
      <div class="hero"><span class="lab">{t('hero.mc')} <span class="muted">{lens ? t('hero.real') : t('hero.reported')}{daggers ? <sup>†</sup> : null}</span></span><b class="mc" data-hero title={lens ? 'Real' : 'Reported'}>{mc > 1e22 ? '∞' : usd(mc)}</b></div>
      <div class="mini"><span>{t('hero.head')} <i class="down">↘</i></span><b>{int(d.humans)}</b></div>
      <div class="mini"><span>{t('hero.cash')}</span><b>{money(s.cash)}</b></div>
      <div class="mini hide-s"><span>{t('hero.profit')}</span><b class={d.pi >= 0 ? 'good' : 'bad'}>{money(d.pi)}{t('hero.s')}</b></div>
      <div class="mini"><span>{t('hero.slides')}</span><b>{num(s.slides)}</b></div>
      <div class="mini hide-s"><span>Time</span><b>{clock(s.t)}</b></div>
      <button class="btn sm pause" aria-pressed={g.paused} onClick={() => { g.paused = !g.paused; notify(); }}>{g.paused ? '▶' : '⏸'}</button>
    </header>
  );
}

const unread = (g: typeof G) => g.s.inbox.filter((m) => !m.read).length;
function Side({ tab }: { tab: string }) {
  switch (tab) {
    case 'inbox': return <Inbox />;
    case 'capital': return <><Targets /><Capital /></>;
    case 'log': return <LogView />;
    case 'settings': return <Settings />;
    default: return <Initiatives />;
  }
}

function Tabs({ mobile }: { mobile: boolean }) {
  const g = useGame(); const s = g.s;
  const tabs: [string, string][] = [['floor', mobile ? (s.act === 1 ? t('tab.floor') : s.act === 2 ? 'Portfolio' : t('tab.market')) : ''], ['init', t('tab.init')], ['inbox', t('tab.inbox')], ['capital', t('tab.capital')], ['log', t('tab.log')], ['settings', t('tab.settings')]];
  return (
    <nav class={mobile ? 'tabbar' : 'tabs'} aria-label={mobile ? 'Sections' : 'Panels'}>
      {tabs.filter(([k]) => (mobile || k !== 'floor') && (k !== 'capital' || s.act >= 2) && (!mobile || k !== 'log')).map(([k, label]) => (
        <button key={k} class={(g.tab === k || (!mobile && g.tab === 'floor' && k === 'init')) ? 'on' : ''} aria-current={g.tab === k ? 'page' : undefined} onClick={() => { g.tab = k; notify(); }}>{label}{k === 'inbox' && unread(g) ? <span class="badge">{unread(g)}</span> : null}</button>
      ))}
    </nav>
  );
}

function Stage() {
  const g = useGame(); const s = g.s;
  return (
    <section class="stage" aria-label="Stage">
      <div class="card stagecard">
        <h2 class="stage-h">{s.act === 1 ? 'The Floor' : s.act === 2 ? t('portfolio.h') : 'The Market'}</h2>
        {s.act === 1 ? <Floor /> : s.act === 2 ? <Portfolio /> : <Field />}
      </div>
      <Jaws />
      {s.act === 1 ? <Directory /> : null}
      {s.act === 2 ? <Targets /> : null}
      <Footer />
    </section>
  );
}

function Footer() {
  const g = useGame(); const stable = g.opts.stable || g.opts.reduced; const lvl = stable ? 0 : g.dec[5];
  return <footer class="fine muted small">{lvl >= 2 ? t('foot.terms.0') : lvl === 1 ? t('foot.terms.1') : t('foot.terms')}{lvl === 0 ? ' No network calls. No analytics.' : ''}</footer>;
}

function Modals() {
  const g = useGame(); const [more, setMore] = useState(false);
  useEffect(() => { if (g.modal !== 'redesign') return; const id = setTimeout(() => { (document.getElementById('rd-ok') as HTMLButtonElement | null)?.removeAttribute('disabled'); }, 3000); return () => clearTimeout(id); }, [g.modal]);
  return (
    <>
      {g.modal === 'redesign' ? (
        <div class="modal" role="dialog" aria-modal="true" aria-label={t('redesign.h')}>
          <div class="sheet saas-sheet"><div class="sparkle">✦</div><h2>{t('redesign.h')}</h2><p>{t('redesign.p')}</p>{more ? <p class="muted">{t('redesign.more.p')}</p> : <button class="link" onClick={() => setMore(true)}>{t('redesign.more')}</button>}
            <button id="rd-ok" class="btn primary" disabled onClick={() => { g.modal = ''; notify(); }}>{t('redesign.ok')}</button></div></div>
      ) : null}
      {g.report ? (
        <div class="modal" role="dialog" aria-modal="true" aria-label="Out of Office report"><div class="sheet"><h2>Out of Office report</h2>
          <p class="memo">While you were away ({(g.report.secs / 3600).toFixed(1)} h{g.report.capped ? ', capped' : ''}), productivity was unaffected. We have flagged this.</p>
          <table class="data"><tbody><tr><td>Cash</td><td class="r">+{money(g.report.cash)}</td></tr><tr><td>Slides</td><td class="r">+{num(g.report.slides)}</td></tr><tr><td>Transitions</td><td class="r">{g.report.cuts}</td></tr></tbody></table>
          <button class="btn primary" onClick={() => { g.report = null; notify(); }}>Accept</button></div></div>
      ) : null}
    </>
  );
}

// ---------------- Act IV: the UI dismantles itself (T7) ----------------
const STATUS = ['Reviewing mandate…', 'Cross-referencing responsibilities…', 'Locating the person responsible…', 'Finding that the person responsible is this analysis…', 'Recommending efficiency…', 'Drafting a gracious note…'];
function Act4() {
  const g = useGame(); const s = g.s; const a = s.a4; const stable = g.opts.stable || g.opts.reduced;
  const step = a.step; const need = step === 5 ? A4.SUNSET : A4.ANALYSIS;
  const [nps, setNps] = useState(9);
  const removed = ['Initiatives tab', 'Capital panel', 'Jaws chart', 'Vitals', 'Floor', 'Header'];
  const gone = removed.slice(0, Math.min(step + 1, 6));
  const last = step >= 1 ? S && s.inbox.filter((m) => m.id === 'a4_r' + (step - 1)).slice(-1)[0] : null;
  const lastTxt = last ? mailText(s, last) : null;
  const ended = s.ended;
  const [typed, setTyped] = useState(0);
  const endMail = ended ? MAIL[ended === 'A' ? 'a4_endA' : 'a4_endB'] : null;
  useEffect(() => { if (!ended) return; if (stable) { setTyped(9999); return; } const id = setInterval(() => setTyped((n) => n + 3), 30); return () => clearInterval(id); }, [ended]);
  const review = (
    <div class="perf"><h3>{t('perf.h')}</h3>
      <table class="data"><tbody>
        <tr><td>{t('perf.min')}</td><td class="r">{clock(s.t)}</td></tr>
        <tr><td>{t('perf.cuts')}</td><td class="r">{int(s.stats.cuts)}</td></tr>
        <tr><td>{t('perf.inc')}</td><td class="r">{s.stats.incidents}</td></tr>
        <tr><td>{t('perf.lies')}</td><td class="r">{pct(Math.min(9.99, s.stats.maxFiction))}</td></tr>
        <tr><td>{t('perf.q')}</td><td class="r">{s.stats.beats} / {s.stats.beats + s.stats.misses}</td></tr>
        {!g.opts.noMeta ? <tr><td>{t('perf.tab')}</td><td class="r">{Math.round(s.stats.hiddenSec / 60)} min</td></tr> : null}
        <tr><td>{t('perf.stance')}</td><td class="r">{t('stance.' + S.a4Stance(s))}{(a.fast ?? 0) > 0 ? ` · fast-tracked ×${a.fast}` : ''}</td></tr>
        <tr><td>{t('perf.fit')}</td><td class="r">{t('perf.fit.v')}</td></tr>
      </tbody></table>
      {!g.opts.noMeta && s.stats.hiddenSec > 60 ? <p class="memo small">{t('perf.hidden')}</p> : null}
    </div>
  );
  return (
    <main class="act4" id="main" data-step={step}>
      <div class="doc4">
        {stable ? null : <div class="gone" aria-hidden="true" />}
        <h1 class="memo">{t('a4.h')}</h1>
        {!ended ? <p class="memo intro4">{t('a4.intro')}</p> : null}
        <ul class="eliminated" aria-live="polite">{gone.map((x, i) => <li key={x} class="memo muted">{t('a4.elim.' + i)}</li>)}</ul>
        {!ended && step <= 5 ? <h2 class="memo">{t('a4.step' + step)}</h2> : null}
        {lastTxt && !ended && step <= 6 ? <blockquote class="memo mail4"><b>{lastTxt[0]}</b><br />{lastTxt[2]}</blockquote> : null}
        {!ended && step <= 3 || (!ended && step === 5) ? (
          <div class="a4act">
            {a.running ? (<><div class="bar big" role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((a.prog / need) * 100)}><i style={{ width: `${(a.prog / need) * 100}%` }} /></div><p class="memo muted">{STATUS[Math.floor((a.prog / need) * STATUS.length)] ?? STATUS[5]} <span class="mono">{Math.max(0, Math.ceil(need - a.prog))} s</span></p>
              {step <= 3 && a.tone[step] != null ? <p class="memo small">{t('a4.reply.' + a.tone[step])}</p> : null}
              <button class="btn fastbtn" onClick={() => act((st) => S.a4Fast(st))}>{t('a4.fast')}</button> <span class="muted small">{t('a4.fast.d')}</span></>) : (
              step <= 3 ? <><p class="memo">{t('a4.hint')}</p><div class="btnrow tone">{[t('a4.agree'), t('a4.question'), t('a4.resign')].map((x, i) => <button key={i} class="btn primary tone-pick" onClick={() => act((st) => S.a4Pick(st, i))}>{x}</button>)}</div></>
              : <button class="btn primary" onClick={() => act((st) => S.a4Run(st))}>{t('a4.sunset')}</button>
            )}
          </div>
        ) : null}
        {!ended && step === 4 ? <div class="a4act"><p class="memo">{s.name}, Employee #1000, is the last entry in the Directory. Their role: the Initiative’s badge. Their tenure: since the beginning.</p><div class="btnrow"><button class="btn danger" onClick={() => act((st) => S.a4Badge(st, 'A'))}>{t('a4.badgeA')}</button><button class="btn" onClick={() => act((st) => S.a4Badge(st, 'B'))}>{t('a4.badgeB')}</button></div></div> : null}
        {!ended && step === 6 ? <div class="a4act">{review}<h3 class="memo">{t('a4.step6')}</h3><label class="slider"><span class="memo">{t('a4.nps')} <b>{nps}</b></span><input type="range" min={0} max={10} value={nps} onInput={(e) => setNps(Number((e.target as HTMLInputElement).value))} /></label><button class="btn primary" onClick={() => act((st) => S.a4Submit(st, nps))}>{t('a4.submit')}</button></div> : null}
        {ended && endMail ? (
          <div class="ending">
            <h2 class="memo">{t('end.' + ended)}</h2>
            {ended === 'B' ? <div class="soloDot" aria-label="One dot remains"><i /></div> : null}
            <p class="memo letter">{endMail[2].slice(0, typed)}<span class="caret">▍</span></p>
            {typed >= endMail[2].length ? <><p class="memo muted">{t('stance.note.' + S.a4Stance(s))}</p>{review}<p class="memo muted">{t('a4.pending')}: 0. {t('a4.close')}</p><button class="btn" onClick={() => { localStorage.removeItem('natural-attrition:v1:slot0'); location.reload(); }}>{t('end.again')}</button></> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function App() {
  const g = useGame(); const s = g.s;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === 'Space' && !['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'A'].includes((e.target as HTMLElement).tagName) && g.started) { e.preventDefault(); g.paused = !g.paused; notify(); } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  if (!g.started) return <Welcome />;
  if (s.act === 4) return <><Act4 /><Modals />{g.debug ? <Debug /> : null}</>;
  const tab = g.tab === 'floor' ? 'init' : g.tab;
  return (
    <div class={'app' + (g.lens && s.act >= 2 ? ' lens' : '')} data-pane={g.tab}>
      <a class="skip" href="#main">{t('skip')}</a>
      <Hero />
      <Ticker />
      <div class="grid" id="main">
        <div class="col-l"><Vitals /><WavePlanner /></div>
        <div class="col-c"><Stage /></div>
        <aside class="col-r"><Tabs mobile={false} /><div class="sidebody"><Side tab={tab} /></div></aside>
        <div class="mobile-pane"><Side tab={g.tab} /></div>
      </div>
      <Tabs mobile />
      <Modals />
      {g.debug ? <Debug /> : null}
    </div>
  );
}
export { LOG, saveNow };
