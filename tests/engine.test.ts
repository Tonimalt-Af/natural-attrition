import { describe, expect, it } from 'vitest';
import { initState } from '../src/engine/state.ts';
import * as S from '../src/engine/sim.ts';
import { TICK } from '../src/engine/data.ts';

describe('engine determinism', () => {
  it('same seed + same inputs => identical state', () => {
    const a = initState(7, 'Test'), b = initState(7, 'Test');
    for (let i = 0; i < 2000; i++) { S.step(a, TICK); S.step(b, TICK); if (i === 300) { S.wave(a, -1, 5, 600); S.wave(b, -1, 5, 600); } }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('starts with 1000 humans and a badge', () => {
    const s = initState(1);
    expect(S.humansAlive(s)).toBe(1000);
  });
});
