import { describe, expect, it } from 'vitest';
import { run } from '../tools/bot.ts';
import { analyze } from '../tools/deadtime.ts';

// Pacing regression: the headless greedy bot must finish each act inside the spec windows (minutes).
const WIN = { I: [24, 42], II: [28, 47], III: [22, 42], IV: [2, 6], TOTAL: [80, 125] } as const;
describe('pacing (greedy bot)', () => {
  for (const seed of [1, 2]) {
    it(`seed ${seed} stays in the spec windows and reaches an ending`, () => {
      const r = run({ seed, mode: 'greedy', maxMin: 200 });
      const m = r.marks; const min = (k: string) => m[k] / 60;
      expect(m.end, 'ending reached').toBeDefined();
      const d = { I: min('act2'), II: min('act3') - min('act2'), III: min('act4') - min('act3'), IV: min('end') - min('act4') };
      for (const k of ['I', 'II', 'III', 'IV'] as const) { expect(d[k], `Act ${k} ${d[k].toFixed(1)}min`).toBeGreaterThanOrEqual(WIN[k][0]); expect(d[k], `Act ${k} ${d[k].toFixed(1)}min`).toBeLessThanOrEqual(WIN[k][1]); }
      expect(min('end')).toBeGreaterThanOrEqual(WIN.TOTAL[0]); expect(min('end')).toBeLessThanOrEqual(WIN.TOTAL[1]);
    }, 120000);
  }
  // Dead-time guard: human-like players (spam-clicking, buying everything affordable) must never stare at a screen with nothing to do for long.
  for (const mode of ['aggressive', 'clicky'] as const) {
    for (const seed of [1, 2]) {
      it(`${mode} bot seed ${seed}: finishes in a sane time and never waits more than 2.5 min with nothing to do`, () => {
        const r = analyze(mode, seed);
        expect(r.endMin, 'ending reached').toBeLessThanOrEqual(135); expect(r.endMin).toBeGreaterThanOrEqual(85);
        const worst = Math.max(0, ...r.gaps.map((g) => g.secs)); expect(worst / 60, `longest dead gap ${(worst / 60).toFixed(1)}min`).toBeLessThanOrEqual(2.5);
      }, 120000);
    }
  }
  it('greedy bot: no dead stretch beyond 2.5 min and Slides never pile up unused', () => {
    const r = analyze('greedy', 1); const worst = Math.max(0, ...r.gaps.map((g) => g.secs));
    expect(worst / 60).toBeLessThanOrEqual(2.5); expect(r.surplusMin).toBeLessThan(1);
  }, 120000);
  it('lazy bot finishes within 180 minutes', () => {
    const r = run({ seed: 1, mode: 'lazy', maxMin: 200 });
    expect(r.marks.end / 60).toBeLessThanOrEqual(180);
  }, 120000);
  it('an idle player is never walled: the company keeps running (no crash, no NaN)', () => {
    const r = run({ seed: 1, mode: 'idle', maxMin: 60 });
    expect(Number.isFinite(r.s.cash)).toBe(true); expect(r.s.t).toBeGreaterThan(3000);
  }, 120000);
});
