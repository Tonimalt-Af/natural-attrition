// Act III probe: per-mode Act III length, interventions, demand trough, cruelty and verdict. Usage: node tools/act3probe.ts greedy,lazy,aggressive,clicky 1,2,3 [v]
import { run, type Mode } from './bot.ts';
import * as S from '../src/engine/sim.ts';
const modes = (process.argv[2]||'greedy').split(',') as Mode[]; const seeds=(process.argv[3]||'1').split(',').map(Number); const verbose=process.argv[4]==='v';
for (const seed of seeds) for (const mode of modes) {
  let lastLog=0; let minPi=1e99, r0=-1, E0=0, Emin=1e99, maxDebt=0, trough=1, troughT=0;
  const r = run({ seed, mode, maxMin: 260, hook: (s)=>{ if(s.act===3){ const d=S.derive(s); if(r0<0){r0=s.reckonings;E0=d.E;} Emin=Math.min(Emin,d.E); maxDebt=Math.max(maxDebt,s.debt/Math.max(d.debtCap,1)); minPi=Math.min(minPi,d.pi); if(s.dm<trough){trough=s.dm;} if (verbose && s.t-lastLog>=120 ){ lastLog=s.t; console.log(`  ${mode} t3=${((s.t-s.actT[1])/60).toFixed(1)}m dm=${s.dm.toFixed(2)} conf=${s.conf.toFixed(2)} reh=${s.reh} cash=${(s.cash/s.pi0).toFixed(1)}π0s pi=${(d.pi/s.pi0).toFixed(2)}π0 interv=${s.interv} debt/cap=${(s.debt/d.debtCap).toFixed(2)} mc=${d.mcRep.toExponential(1)}`);} } } });
  const s=r.s; const m=r.marks;
  console.log(mode.padEnd(10), 'seed',seed,'act3@',(m.act3/60).toFixed(1),'len',((m.act4-m.act3)/60).toFixed(1),'end',(m.end/60).toFixed(1),'| interv',s.interv,'reh',s.reh,'recks3',s.reckonings-r0,'Edrop',(1-Emin/E0).toFixed(3),'debt/cap max',maxDebt.toFixed(2),'trough dm',trough.toFixed(2),'minPi',(minPi/s.pi0).toFixed(2),'| cruelty',S.cruelty(s).c.toFixed(2),'v',s.a4.v,'ended',s.ended);
}
