// Generates golden fixtures (saves taken from the headless bot at key moments) into public/fixtures/*.nasave
import { mkdirSync, writeFileSync } from 'node:fs';
import { run } from './bot.ts';
import { exportText } from '../src/engine/save.ts';
import * as S from '../src/engine/sim.ts';
import type { State } from '../src/engine/state.ts';

mkdirSync('public/fixtures', { recursive: true });
const want: Record<string, (s: State) => boolean> = {
  'act1-early': (s) => s.act === 1 && s.t >= 6 * 60,
  'act1-mid': (s) => s.act === 1 && s.t >= 22 * 60,
  'act1-end': (s) => s.act === 1 && S.humansAlive(s) <= 540 && !!s.own.telemetry,
  'act2-start': (s) => s.act === 2 && s.t - s.actT[0] >= 20,
  'act2-mid': (s) => s.act === 2 && s.U + s.I >= 3e5,
  'act2-redesign': (s) => s.act === 2 && !!s.flags.redesign && s.t - s.flags.redesign > 2,
  'act2-pre-correction': (s) => s.act === 2 && s.U + s.I >= 1.5e7,
  'act2-correction': (s) => s.act === 2 && s.corr === 1,
  'act3-start': (s) => s.act === 3 && s.t - s.actT[1] >= 20,
  'act3-mid': (s) => s.act === 3 && S.derive(s).lambdaC >= 0.4,
  'act3-lastcust': (s) => s.act === 3 && s.lastCust === 1,
  'act4': (s) => s.act === 4 && s.t - s.actT[2] >= 5,
  'act4-badge': (s) => s.act === 4 && s.a4.step === 4,
  'act4-final': (s) => s.act === 4 && s.a4.step === 6,
};
const done = new Set<string>();
const jobs: Promise<void>[] = [];
run({ mode: 'greedy', maxMin: 200, hook: (s) => { for (const k in want) if (!done.has(k) && want[k](s)) { done.add(k); const snap = JSON.parse(JSON.stringify(s)); jobs.push(exportText(snap).then((x) => { writeFileSync(`public/fixtures/${k}.nasave`, x); })); } } });
await Promise.all(jobs);
console.log('fixtures:', [...done].join(', '), '| missing:', Object.keys(want).filter((k) => !done.has(k)).join(', ') || 'none');
