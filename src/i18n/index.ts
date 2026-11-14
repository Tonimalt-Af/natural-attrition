import { INIT, LOG, MAIL, UI, type Mail } from './en.ts';
import { tpl } from '../engine/format.ts';
import type { P, State, LogLine, Mail as InboxMail } from '../engine/state.ts';
import { nameOf, quirkOf, roleOf, tenureOf } from '../engine/names.ts';
import { DEPTS } from '../engine/data.ts';

export const t = (k: string, p?: P): string => tpl(UI[k] ?? k, p as Record<string, string | number>);
export const initName = (id: string) => INIT[id]?.[0] ?? id;
export const initBlurb = (id: string) => INIT[id]?.[1] ?? '';

function person(s: State, i: number, hr: boolean) {
  const dept = s.dept[i] ?? 0;
  return { name: hr ? `Resource #${i + 1}` : nameOf(s.seed, i), role: roleOf(s.seed, i, dept), ten: tenureOf(s.seed, i), quirk: quirkOf(s.seed, i), first: nameOf(s.seed, i).split(' ')[0], n: i };
}
export function logText(s: State, l: LogLine, hrDecay = false): string {
  let k = l.k; const p: Record<string, string | number> = { ...(l.p as Record<string, string | number>) };
  if (k.startsWith('buy_')) { const id = k.slice(4); return `Approved: ${initName(id)}.`; }
  if (k === 'cut' || k === 'attr' || k === 'handover' || k === 'incident' || k === 'rehire_offer' || k === 'rehired') {
    const q = person(s, p.n as number, hrDecay && k === 'cut'); Object.assign(p, q);
    if (hrDecay && k === 'cut') k = 'cut_hr';
  }
  let raw = LOG[k] ?? k;
  if (raw.includes('||')) { const v = raw.split('||'); raw = v[Math.abs(Number(p.v) || 0) % v.length]; }
  return tpl(raw, p);
}
export function mailText(s: State, m: InboxMail): Mail {
  const base = MAIL[m.id] ?? (m.id.startsWith('advisor_') ? MAIL.advisor_cash : ['Nullwater', m.id, '']);
  const p: Record<string, string | number> = { name: s.name, ...(m.p as Record<string, string | number>) };
  if (typeof p.n === 'number') { const q = person(s, p.n, false); p.name = q.name; p.first = q.first; }
  return [tpl(base[0], p), tpl(base[1], p), tpl(base[2], p)];
}
export const deptName = (i: number) => ['Engineering', 'Sales', 'Support', 'Operations', 'HR', 'Legal', 'Finance', 'Management', 'Innovation Lab'][i] ?? DEPTS[i]?.id ?? '';
export const deptShort = (i: number) => ['ENG', 'SAL', 'SUP', 'OPS', 'HR', 'LEG', 'FIN', 'MGT', 'LAB'][i];
