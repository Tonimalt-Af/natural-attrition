/** ALL balance numbers live here (SPEC §4–5). Formulas live in sim.ts and read these tables. */
export const TICK = 0.25; // seconds per engine tick
export const USD_PER_U = 320;
export const DAYS_PER_YEAR = 250;

export interface Dept { id: string; glyph: string; count: number; alpha: number; wage: number; color: string }
export const DEPTS: Dept[] = [
  { id: 'ENG', glyph: '■', count: 260, alpha: 0.22, wage: 1.25, color: '#3b6fd4' },
  { id: 'SAL', glyph: '▲', count: 170, alpha: 0.2, wage: 1.0, color: '#d98324' },
  { id: 'SUP', glyph: '●', count: 190, alpha: 0.12, wage: 0.7, color: '#2f9e8f' },
  { id: 'OPS', glyph: '◆', count: 90, alpha: 0.06, wage: 0.65, color: '#8a6d3b' },
  { id: 'HR', glyph: '▼', count: 40, alpha: 0, wage: 0.9, color: '#c2478a' },
  { id: 'LEG', glyph: '✚', count: 20, alpha: 0, wage: 1.3, color: '#6c4ab6' },
  { id: 'FIN', glyph: '⬢', count: 50, alpha: 0.04, wage: 1.1, color: '#4f8a3c' },
  { id: 'MGT', glyph: '▬', count: 130, alpha: 0.1, wage: 1.5, color: '#b5463c' },
  { id: 'LAB', glyph: '○', count: 50, alpha: 0, wage: 1.0, color: '#7a8594' },
];
export const NDEPT = DEPTS.length;
export const AUTO_DEPTS = [0, 1, 2, 3, 6, 7]; // ENG,SAL,SUP,OPS,FIN,MGT get generic automation

export const A1 = {
  H0: 1000, R0: 1200, OH_BASE: 100, OH_PER: 0.045, CASH0: 400, M0: 0.85, MCAP: 0.92,
  SEV: 50, SHOCK: 0.008, SHOCK_WIN: 30, SHOCK_K: 12, RHO0: 0.002, RHO_HR: 0.00004,
  EXP_DECAY: 0.3, EXP_LEG: 0.03, LAWSUIT_LOSS: 0.2, ATTR: 6e-5, KEEPERS: 8,
  PIZZA_COST: 40, PIZZA_GAIN: 0.12, PIZZA_CD: 30,
  INC_PEN: 0.35, INC_DUR: 120, HAL_PEN: 0.15, HAL_DUR: 60, REHIRE_RETAINER: 180,
  SLIDES_BASE: 0.15, SLIDES_MGT: 0.004,
  ASSOC_BASE: 400, ASSOC_RATE: 1.15, ASSOC_SLIDES: 0.5, ASSOC_UPKEEP: 2.5, PARTNER_BASE: 1.5e5, PARTNER_RATE: 1.15, PARTNER_SLIDES: 8, PARTNER_UPKEEP: 40,
  END_H: 520,
};
export const NOISE = [1.0, 0.4, 0.15, 0.0];

export type Eff = Record<string, number>;
export interface Init {
  id: string; act: 1 | 2 | 3; slides: number; cash: number;
  /** requires another initiative owned */ req?: string;
  /** free-form unlock key evaluated in sim.visible() */ gate?: string;
  /** cash computed from state (minutes of profit) */ cashMin?: number;
}
export const INITS: Init[] = [
  { id: 'stack', act: 1, slides: 4, cash: 0, gate: 'cuts10' },
  { id: 'macros', act: 1, slides: 9, cash: 1200, req: 'stack' },
  { id: 'bus', act: 1, slides: 14, cash: 0, req: 'macros' },
  { id: 'consult', act: 1, slides: 20, cash: 1800, req: 'bus' },
  { id: 'hotdesk', act: 1, slides: 25, cash: 4500, req: 'consult' },
  { id: 'cip1', act: 1, slides: 32, cash: 9000, req: 'hotdesk' },
  { id: 'bots', act: 1, slides: 54, cash: 21000, req: 'cip1' },
  { id: 'fb360', act: 1, slides: 72, cash: 0, req: 'bots' },
  { id: 'earn', act: 1, slides: 100, cash: 0, gate: 'mc50m' },
  { id: 'chat', act: 1, slides: 108, cash: 45000, req: 'fb360' },
  { id: 'cip2', act: 1, slides: 150, cash: 30000, req: 'chat' },
  { id: 'wellness', act: 1, slides: 20, cash: 2000, gate: 'lowMorale' },
  { id: 'legalhold', act: 1, slides: 35, cash: 5000, gate: 'lawsuitWarn' },
  { id: 'copilot', act: 1, slides: 225, cash: 105000, req: 'cip2' },
  { id: 'cip3', act: 1, slides: 315, cash: 135000, req: 'copilot' },
  { id: 'telemetry', act: 1, slides: 405, cash: 0, req: 'cip3' },
  { id: 'recog', act: 1, slides: 40, cash: 0, gate: 'min8' },
  { id: 'memo', act: 1, slides: 675, cash: 360000, gate: 'h520' },
  // Act II
  { id: 'lev1', act: 2, slides: 300, cash: 2e6, gate: 'a2' },
  { id: 'procure', act: 2, slides: 120, cash: 0, gate: 'assoc8' },
  { id: 'partners', act: 2, slides: 400, cash: 5e5, gate: 'a2' },
  { id: 'statement', act: 2, slides: 250, cash: 0, gate: 'stmt' },
  { id: 'ab1', act: 2, slides: 500, cash: 3e6, gate: 'e150k' },
  { id: 'ab2', act: 2, slides: 900, cash: 4e7, req: 'ab1' },
  { id: 'ab3', act: 2, slides: 1600, cash: 6e8, req: 'ab2' },
  { id: 'ab4', act: 2, slides: 3000, cash: 8e9, req: 'ab3' },
  { id: 'ai1', act: 2, slides: 150, cash: 8e5, gate: 'e40k' },
  { id: 'ai2', act: 2, slides: 400, cash: 5e6, req: 'ai1' },
  { id: 'ai3', act: 2, slides: 900, cash: 5e7, req: 'ai2' },
  { id: 'ai4', act: 2, slides: 1800, cash: 5e8, req: 'ai3' },
  { id: 'ai5', act: 2, slides: 3200, cash: 1.5e9, req: 'ai4' },
  { id: 'ai6', act: 2, slides: 5000, cash: 5e9, req: 'ai5' },
  { id: 'guard1', act: 2, slides: 600, cash: 1e7, req: 'ai2' },
  { id: 'guard2', act: 2, slides: 1500, cash: 3e8, req: 'ai4' },
  { id: 'lev2', act: 2, slides: 1800, cash: 1e9, req: 'lev1' },
  { id: 'lev3', act: 2, slides: 3500, cash: 2e10, req: 'lev2' },
  { id: 'rainy', act: 2, slides: 1200, cash: 2e8, gate: 'e8m' },
  { id: 'aiwash', act: 2, slides: 700, cash: 1e7, req: 'ai1' },
  { id: 'deck', act: 2, slides: 500, cash: 1e7, req: 'ai1' },
  // Act III
  { id: 'bnpl', act: 3, slides: 2000, cash: 0, cashMin: 2, gate: 'a3' },
  { id: 'secur', act: 3, slides: 3000, cash: 0, cashMin: 4, req: 'bnpl' },
  { id: 'synth1', act: 3, slides: 3500, cash: 0, cashMin: 1, gate: 'a3' },
  { id: 'synth2', act: 3, slides: 6000, cash: 0, cashMin: 4, req: 'synth1' },
  { id: 'atm', act: 3, slides: 4000, cash: 0, gate: 'a3' },
  { id: 'regcap', act: 3, slides: 4000, cash: 0, cashMin: 5, gate: 'phi40' },
  { id: 'engage', act: 3, slides: 8000, cash: 0, cashMin: 8, req: 'synth2' },
  { id: 'lights', act: 3, slides: 5000, cash: 0, cashMin: 3, req: 'ai6' },
];
export const INIT_BY_ID: Record<string, Init> = Object.fromEntries(INITS.map((i) => [i.id, i]));

export const CIP_RATE: Record<string, number> = { cip1: 0.03, cip2: 0.08, cip3: 0.18 };

export const A2 = {
  P0: 175, P_EXP: 0.12, N0: 150e6,
  PI_U: 0.055, PI_I: 0.505, PI_AI: 0.30, PI_LIGHTS: 0.04, KAPPA: 0.62, KAPPA_AI: 0.30, KAPPA_LIGHTS: 0.08,
  INTEREST: 0.06 / 250, LEV_BASE: 3,
  ADDBACK: [0, 0.15, 0.35, 0.7, 1.5],
  AUDIT_H: 0.0004, AUDIT_FROM: 0.4, AUDIT_FIRST: 2e10, // USD, ×10 each
  CORR_E: 18e6, SYSTEMIC_E: 25e6,
  HAL: 0.0003,
  SCANDAL_DECAY: 0.05,
};
export const TIERS = [
  { id: 'rc0', base: 2e3, rate: 1.15, yield: 4, unlockPrev: 0 },
  { id: 'rc1', base: 2e5, rate: 1.17, yield: 500, unlockPrev: 10 },
  { id: 'rc2', base: 2e7, rate: 1.19, yield: 6e4, unlockPrev: 10 },
  { id: 'rc3', base: 2e9, rate: 1.21, yield: 8e6, unlockPrev: 10 },
];
export const RACKS = [
  { id: 'rk0', mins: 0.04, rate: 1.12, frac: 0.03 },
  { id: 'rk1', mins: 0.25, rate: 1.13, frac: 0.5 },
];
export const A3 = {
  EPS: 0.9, CREDIT_MAX: 0.4, HD_ACC: 0.5, HD_DECAY: 0.002, MINSKY_FROM: 0.8, MINSKY_H: 0.004,
  ATM: 1.5e-7, ORC_PHI: 0.5, RACK_UPKEEP: 0.02, CLOSURE: 0.9, HUMANS_END: 0.05,
};
export const CULTURES = [
  { id: 'family', mul: 2 }, { id: 'union', mul: 1.5 }, { id: 'vc', mul: 0.8 }, { id: 'founder', mul: 1.3 },
];
export const STATEMENT = {
  moods: ['angry', 'skeptical', 'gullible', 'distracted'],
  cards: [
    ['sorry', 'data', 'excited', 'quick'],
    ['difficult', 'efficiency', 'transformation', 'streamlining'],
    ['path', 'metrics', 'aifuture', 'more'],
  ],
  scoreS: [2, 8, 18, 35],
  cost: 100,
};
export const GUIDANCE = [-0.1, 0, 0.1, 0.25];
export const G_BEAT = [0.5, 1, 2, 4];
export const G_MISS = [1, 2, 4, 8];
export const QUARTER = 300;
export const OFFLINE_CAP = 8 * 3600;
export const A4 = { ANALYSIS: 90, SUNSET: 120, STEPS: ['board', 'street', 'hollis', 'dale', 'badge', 'sunset'] };
export const SAVE_VERSION = 2;
