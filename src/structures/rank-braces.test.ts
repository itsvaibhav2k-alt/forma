import { describe, expect, it } from 'vitest';
import { LOAD_NODE_IDS, PANEL_IDS, type Design, type Load, type RankedBraces } from '../shared';
import { bridgeFixture } from '../shared/fixtures/bridge';
import { expectEquilibrium } from '../test/structure-assertions';
import { analyze } from './analyze';
import { createBraceMember, createBridgePreset } from './preset';
import { rankBraces } from './rank-braces';

function ranked(baseline: Design, load: Load): RankedBraces {
  const result = rankBraces(baseline, load);
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status !== 'ok') throw new Error(result.message);
  return result;
}

describe('independent four-panel regression matrix', () => {
  for (const nodeId of LOAD_NODE_IDS) {
    for (const panel of ['baseline', ...PANEL_IDS] as const) {
      it(`${nodeId} / ${panel} matches the specification within 1e-6 mm and balances all forces`, () => {
        const baseline = createBridgePreset();
        const design = panel === 'baseline' ? baseline : { ...baseline, members: [...baseline.members, createBraceMember(panel)] };
        const load: Load = { nodeId, fxN: 0, fyN: -10 };
        const result = analyze(design, load);
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') throw new Error(result.message);
        expect(Math.abs(result.loadedJointDisplacementMm - bridgeFixture.downwardDisplacementMm[nodeId][panel])).toBeLessThanOrEqual(bridgeFixture.absoluteToleranceMm);
        expect(result.displacementMmByNode[nodeId]!.y).toBeLessThan(0);
        expect(Object.keys(result.displacementMmByNode)).toHaveLength(10);
        expect(Object.keys(result.axialForceNByMember)).toHaveLength(panel === 'baseline' ? 17 : 18);
        expect(result.reactionNByNode.B0!.x).toBeCloseTo(0, 9);
        expect(result.reactionNByNode.B0!.y).toBeCloseTo(bridgeFixture.verticalReactionsN[nodeId].B0, 9);
        expect(result.reactionNByNode.B4!.y).toBeCloseTo(bridgeFixture.verticalReactionsN[nodeId].B4, 9);
        expectEquilibrium(design, load, result);
      });
    }
  }
});

describe('independent brace ranking', () => {
  it.each(LOAD_NODE_IDS)('ranks %s using fresh single additions, full precision and the expected ties', nodeId => {
    const baseline = createBridgePreset();
    const load: Load = { nodeId, fxN: 0, fyN: -10 };
    const result = ranked(baseline, load);
    expect(result.bestIds).toEqual(bridgeFixture.bestIds[nodeId]);
    expect(Object.keys(result.candidates)).toEqual([...PANEL_IDS]);
    expect(result.baseline.design.members).toHaveLength(17);
    for (const panel of PANEL_IDS) {
      const candidate = result.candidates[panel];
      expect(candidate.design.members).toHaveLength(18);
      expect(candidate.design.members.filter(member => member.id.startsWith('brace-')).map(member => member.id)).toEqual([`brace-${panel}`]);
      expect(candidate.analysis).toEqual(analyze(candidate.design, load));
      expect(candidate.analysis.loadedJointDisplacementMm).toBeLessThan(result.baseline.analysis.loadedJointDisplacementMm);
      expect(candidate.analysis.loadedJointDisplacementMm).not.toBe(bridgeFixture.downwardDisplacementMm[nodeId][panel]);
      expect(candidate.change).toEqual({
        kind: 'relative',
        reductionMm: result.baseline.analysis.loadedJointDisplacementMm - candidate.analysis.loadedJointDisplacementMm,
        reductionPercent: 100 * ((result.baseline.analysis.loadedJointDisplacementMm - candidate.analysis.loadedJointDisplacementMm) / result.baseline.analysis.loadedJointDisplacementMm),
      });
    }
    expect(baseline.members).toHaveLength(17);
  });

  it('returns deep immutable snapshots independent of caller and future ranking inputs', () => {
    const baseline = structuredClone(createBridgePreset());
    const load: Load = { nodeId: 'B1', fxN: 0, fyN: -10 };
    const first = ranked(baseline, load);
    Reflect.set(baseline.nodes[0]!, 'xMm', 999);
    Reflect.set(load, 'nodeId', 'B3');
    const second = ranked(createBridgePreset(), load);
    expect(first.load.nodeId).toBe('B1');
    expect(first.baseline.design.nodes[0]!.xMm).toBe(0);
    expect(first.bestIds).toEqual(['P1']);
    expect(second.bestIds).toEqual(['P4']);
    expect(Reflect.set(first.candidates.P1.analysis.displacementMmByNode.B1!, 'y', 123)).toBe(false);
    expect(Object.isFrozen(first.candidates.P2.design.members)).toBe(true);
    expect(first.candidates.P1.design).not.toBe(first.candidates.P2.design);
  });

  it('allows reordered nodes, reversed member directions and a different baseline ID', () => {
    const baseline = createBridgePreset();
    const reordered = {
      ...baseline, id: 'baseline-copy', nodes: [...baseline.nodes].reverse(),
      members: [...baseline.members].reverse().map(member => ({ ...member, startNodeId: member.endNodeId, endNodeId: member.startNodeId })),
    };
    expect(ranked(reordered, { nodeId: 'B2', fxN: 0, fyN: -10 }).bestIds).toEqual(['P2', 'P3']);
  });

  it.each([
    null, { nodeId: 'B0', fxN: 0, fyN: -10 }, { nodeId: 'T2', fxN: 0, fyN: -10 },
    { nodeId: 'B2', fxN: 1, fyN: -10 }, { nodeId: 'B2', fxN: 0, fyN: -1 },
    { nodeId: 'B2', fxN: 0, fyN: NaN },
  ])('enforces the judging load boundary for %j', load => {
    expect(rankBraces(createBridgePreset(), load as Load)).toMatchObject({ status: 'error', code: 'INVALID_INPUT' });
  });

  it('rejects edited, pre-braced or invalid baselines without leaking partial or stale rankings', () => {
    const baseline = createBridgePreset();
    const load: Load = { nodeId: 'B2', fxN: 0, fyN: -10 };
    ranked(baseline, load);
    const invalid = [
      { ...baseline, presetVersion: 'unknown' },
      { ...baseline, members: [...baseline.members, createBraceMember('P1')] },
      { ...baseline, members: baseline.members.slice(1) },
      { ...baseline, stocks: [{ ...baseline.stocks[0]!, areaMm2: 1 }] },
      { ...baseline, nodes: baseline.nodes.map(node => ({ ...node, restrained: { x: false, y: false } })) },
      { ...baseline, nodes: baseline.nodes.map(node => node.id === 'T2' ? { ...node, yMm: 60 } : node) },
    ];
    for (const design of invalid) {
      const result = rankBraces(design, load);
      expect(result).toMatchObject({ status: 'error', code: 'INVALID_INPUT' });
      expect(Object.keys(result).sort()).toEqual(['code', 'memberIds', 'message', 'nodeIds', 'status']);
    }
    expect(rankBraces({ ...baseline, members: [...baseline.members, baseline.members[0]!] }, load)).toMatchObject({ status: 'error', code: 'DUPLICATE_MEMBER' });
  });
});
