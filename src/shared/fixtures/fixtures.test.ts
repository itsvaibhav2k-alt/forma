import { describe, expect, it } from 'vitest';
import { bridgeFixture } from './bridge';
import { triangleFixture } from './triangle';
import { explicitZeroFixture, quotesFixture, unknownAmountFixture } from './quotes';
import { developmentTrialFixture } from './trial';
import { unstableSquareFixture, zeroLengthFixture } from './invalid';
import { LOAD_NODE_IDS, PANEL_IDS, PRESET_DEFAULTS, PRESET_VERSION } from '../constants';

describe('independent fixture integrity (not solver validation)', () => {
  it('preserves the prescribed bridge topology and restraints', () => {
    const design = bridgeFixture.design;
    expect(design.presetVersion).toBe(PRESET_VERSION);
    expect(design.nodes).toHaveLength(10);
    expect(design.members).toHaveLength(17);
    const nodes = new Map(design.nodes.map(node => [node.id, node]));
    const endpoints = design.members.map(member => {
      expect(nodes.has(member.startNodeId)).toBe(true);
      expect(nodes.has(member.endNodeId)).toBe(true);
      return [member.startNodeId, member.endNodeId].sort().join(':');
    });
    expect(new Set(endpoints).size).toBe(17);
    expect(design.nodes.filter(node => node.restrained.x || node.restrained.y).map(node => node.id)).toEqual(['B0', 'B4']);
    expect(nodes.get('B0')!.restrained).toEqual({ x: true, y: true });
    expect(nodes.get('B4')!.restrained).toEqual({ x: false, y: true });
    expect(design.stocks[0]!.elasticModulusNPerMm2).toBe(PRESET_DEFAULTS.elasticModulusNPerMm2);
    expect(design.stocks[0]!.areaMm2).toBe(PRESET_DEFAULTS.areaMm2);

    for (const panel of PANEL_IDS) {
      const member = bridgeFixture.additions[panel];
      expect(endpoints).not.toContain([member.startNodeId, member.endNodeId].sort().join(':'));
      const start = nodes.get(member.startNodeId)!;
      const end = nodes.get(member.endNodeId)!;
      expect(Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm)).toBeCloseTo(Math.sqrt(5200), 10);
    }
  });

  it('retains all 15 displacement references and the center tie', () => {
    expect(LOAD_NODE_IDS.flatMap(id => Object.values(bridgeFixture.downwardDisplacementMm[id]))).toHaveLength(15);
    expect(bridgeFixture.downwardDisplacementMm.B1).toEqual({ baseline: 0.043702, P1: 0.032189, P2: 0.043227, P3: 0.042423, P4: 0.042423 });
    expect(bridgeFixture.downwardDisplacementMm.B2.P2).toBe(0.062624);
    expect(bridgeFixture.downwardDisplacementMm.B2.P3).toBe(0.062624);
    expect(bridgeFixture.bestIds.B2).toEqual(['P2', 'P3']);
    expect(bridgeFixture.downwardDisplacementMm.B3.P4).toBe(bridgeFixture.downwardDisplacementMm.B1.P1);
  });

  it('keeps the triangle EA distinct from the bridge material', () => {
    const stock = triangleFixture.design.stocks[0]!;
    expect(stock.elasticModulusNPerMm2 * stock.areaMm2).toBe(1000);
    expect(triangleFixture.load.fyN).toBe(-1);
    expect(triangleFixture.expected.axialForceNByMember).toEqual({ AB: 0.5, AC: -0.7071, BC: -0.7071 });
    expect(triangleFixture.expected.apexUyMm).toBe(-0.1914);
  });

  it('provides an unbraced mechanism and a truly zero-length member for future validation', () => {
    expect(unstableSquareFixture.design.members).toHaveLength(4);
    expect(unstableSquareFixture.expectedCode).toBe('UNSTABLE');
    const member = zeroLengthFixture.design.members[0]!;
    expect(member.startNodeId).toBe(member.endNodeId);
    expect(zeroLengthFixture.expectedCode).toBe('ZERO_LENGTH_MEMBER');
  });

  it('labels every sample amount as fictional and preserves unknown versus zero', () => {
    const fields = ['materials', 'freight', 'installation', 'cashContribution', 'annualUpkeep'] as const;
    for (const quote of quotesFixture.inputs.packages) {
      for (const field of fields) {
        const input = quote[field];
        expect(input.status).toBe('known');
        if (input.status === 'known') expect(input.source.kind).toBe('demo-assumption');
      }
    }
    expect(unknownAmountFixture).not.toHaveProperty('usd');
    expect(explicitZeroFixture).toMatchObject({ status: 'known', usd: 0 });
    expect(quotesFixture.expectedAtThreePercent.presentCostRoundedUsd).toEqual([26677.18, 24838.59]);
  });

  it('provides a deeply immutable, summary-only trial with independent one-brace alternatives', () => {
    const { trial } = developmentTrialFixture;
    expect(developmentTrialFixture.fixtureOnly).toBe(true);
    expect(trial.load).toEqual({ nodeId: 'B1', fxN: 0, fyN: -10 });
    expect(trial.chosenPanelId).toBe('P2');
    expect(trial.results.candidates.P2.change).toMatchObject({ kind: 'relative', reductionPercent: expect.closeTo(1.09, 2) });
    expect(Object.isFrozen(trial.results.candidates.P2.design.members)).toBe(true);
    expect(trial.results.baseline.design.members).toHaveLength(17);
    for (const panel of PANEL_IDS) {
      const candidate = trial.results.candidates[panel];
      expect(candidate.design.members).toHaveLength(18);
      expect(candidate.design.members.filter(member => member.id.startsWith('brace-')).map(member => member.id)).toEqual([`brace-${panel}`]);
      expect(candidate.analysis.axialForceNByMember).toEqual({});
    }
  });
});
