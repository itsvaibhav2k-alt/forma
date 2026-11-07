import { expect, it } from 'vitest';
import { rankBraces, createBridgePreset } from '../structures';
import { PANEL_IDS } from '../shared';
import { panelRank, verdictLead } from './format';

it('uses main’s unrounded tie tolerance for displayed ranks instead of the previous wider tolerance', () => {
  const original = rankBraces(createBridgePreset(), { nodeId: 'B2', fxN: 0, fyN: -10 });
  if (original.status !== 'ok') throw new Error(original.message);
  const result = structuredClone(original);
  // Synthetic display-boundary values: P2 is within main's 1e-8 tolerance;
  // P3 would have tied under the retired 1e-6 rule, but must now rank third.
  [1, 1 + 0.9e-8, 1 + 0.9e-6, 2].forEach((value, i) => {
    Reflect.set(result.candidates[PANEL_IDS[i]!].analysis, 'loadedJointDisplacementMm', value);
  });
  expect(PANEL_IDS.map(panel => panelRank(result, panel))).toEqual([1, 1, 3, 4]);
});

it('states the verdict as best, tied best or rank of four', () => {
  const baseline = createBridgePreset();
  const atB1 = rankBraces(baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  const atB2 = rankBraces(baseline, { nodeId: 'B2', fxN: 0, fyN: -10 });
  if (atB1.status === 'error' || atB2.status === 'error') throw new Error('fixture solve failed');
  expect(verdictLead(atB1, 'P1', 'B1')).toBe('P1 is the best placement at B1: 26.34% less deflection.');
  expect(verdictLead(atB1, 'P2', 'B1')).toBe('P2 ranks 4th of 4 at B1: 1.09% less deflection.');
  expect(verdictLead(atB2, 'P3', 'B2')).toBe('P2 and P3 tie for best at B2: 10.46% less deflection.');
});
