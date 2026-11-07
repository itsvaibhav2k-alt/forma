import { describe, expect, it } from 'vitest';
import { analyze, rankBraces } from '../src/structures';
import {
  JUDGE_PRESET, TRIANGLE_DESIGN, TRIANGLE_LOAD, TRIANGLE_EXPECTED,
  UNSTABLE_SQUARE_DESIGN, UNSTABLE_SQUARE_LOAD,
  type AnalysisResult, type AnalysisSuccess, type BraceRankingResult, type BraceRankingSuccess,
  type Design, type LoadCase,
} from '../src/shared';

function success(result: AnalysisResult): AnalysisSuccess {
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status !== 'ok') throw new Error(JSON.stringify(result));
  return result;
}
function ranked(result: BraceRankingResult): BraceRankingSuccess {
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status !== 'ok') throw new Error(JSON.stringify(result));
  return result;
}
const loadAt = (nodeId: string, magnitude = 1): LoadCase => ({ nodeId, fxN: 0, fyN: -magnitude });

function checkEquilibrium(design: Design, load: LoadCase, result: AnalysisSuccess) {
  const forces = Object.fromEntries(design.nodes.map(({ id }) => [id, { x: 0, y: 0 }]));
  forces[load.nodeId]!.x += load.fxN;
  forces[load.nodeId]!.y += load.fyN;
  for (const [id, reaction] of Object.entries(result.reactionsN)) {
    forces[id]!.x += reaction.x;
    forces[id]!.y += reaction.y;
  }
  for (const member of design.members) {
    const a = design.nodes.find(({ id }) => id === member.startNodeId)!;
    const b = design.nodes.find(({ id }) => id === member.endNodeId)!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const axial = result.memberForcesN[member.id]!;
    const fx = axial * (b.x - a.x) / length;
    const fy = axial * (b.y - a.y) / length;
    forces[a.id]!.x += fx; forces[a.id]!.y += fy;
    forces[b.id]!.x -= fx; forces[b.id]!.y -= fy;
  }
  for (const value of Object.values(forces)) {
    expect(value.x).toBeCloseTo(0, 9);
    expect(value.y).toBeCloseTo(0, 9);
  }
  const loadNode = design.nodes.find(({ id }) => id === load.nodeId)!;
  const reactionMoment = Object.entries(result.reactionsN).reduce((sum, [id, force]) => {
    const node = design.nodes.find((node) => node.id === id)!;
    return sum + node.x * force.y - node.y * force.x;
  }, 0);
  expect(reactionMoment + loadNode.x * load.fyN - loadNode.y * load.fxN).toBeCloseTo(0, 8);
}

describe('direct stiffness solver', () => {
  it('matches the analytic triangle displacement, tension/compression and reactions well within 1%', () => {
    const result = success(analyze(TRIANGLE_DESIGN, TRIANGLE_LOAD));
    expect(result.reactionsN.left!.y).toBeCloseTo(TRIANGLE_EXPECTED.reactionYEachN, 10);
    expect(result.reactionsN.right!.y).toBeCloseTo(0.5, 10);
    expect(result.reactionsN.left!.x).toBeCloseTo(0, 10);
    expect(result.reactionsN.right!.x).toBe(0);
    expect(result.memberForcesN['left-incline']).toBeCloseTo(TRIANGLE_EXPECTED.inclinedForceN, 10);
    expect(result.memberForcesN['right-incline']).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(result.memberForcesN['bottom-tie']).toBeCloseTo(0.5, 10);
    expect(-result.displacementsMm.apex!.y).toBeCloseTo(TRIANGLE_EXPECTED.apexDownwardMm, 10);
    expect(result.displacementsMm.left).toEqual({ x: 0, y: 0 });
    expect(result.displacementsMm.right!.y).toBe(0);
    expect(result.displacementsMm.right!.x).toBeCloseTo(0.1, 10);
    checkEquilibrium(TRIANGLE_DESIGN, TRIANGLE_LOAD, result);
  });

  it('solves a horizontal axial bar in N/mm and permits arbitrary finite point loads', () => {
    const design: Design = { ...TRIANGLE_DESIGN, nodes: TRIANGLE_DESIGN.nodes.slice(0, 2), members: [TRIANGLE_DESIGN.members[0]!] };
    const result = success(analyze(design, { nodeId: 'right', fxN: 1, fyN: 0 }));
    expect(result.displacementsMm.right!.x).toBeCloseTo(0.2, 12);
    expect(result.memberForcesN['bottom-tie']).toBeCloseTo(1, 12);
    expect(result.reactionsN.left!.x).toBeCloseTo(-1, 12);
  });

  it('scales displacement and force linearly with load', () => {
    const single = success(analyze(TRIANGLE_DESIGN, TRIANGLE_LOAD));
    const triple = success(analyze(TRIANGLE_DESIGN, { ...TRIANGLE_LOAD, fyN: -3 }));
    expect(triple.displacementsMm.apex!.y).toBeCloseTo(single.displacementsMm.apex!.y * 3, 12);
    expect(triple.memberForcesN['left-incline']).toBeCloseTo(single.memberForcesN['left-incline']! * 3, 12);
  });

  it.each([1e-12, 1e12])('is scale-aware when EA changes by %s', (factor) => {
    const design = { ...TRIANGLE_DESIGN, stocks: TRIANGLE_DESIGN.stocks.map((stock) => ({ ...stock, elasticModulusNPerMm2: stock.elasticModulusNPerMm2 * factor })) };
    const result = success(analyze(design, TRIANGLE_LOAD));
    expect(-result.displacementsMm.apex!.y * factor).toBeCloseTo(TRIANGLE_EXPECTED.apexDownwardMm, 10);
    expect(result.memberForcesN['bottom-tie']).toBeCloseTo(0.5, 10);
  });

  it('retains tension signs when member endpoint order is reversed', () => {
    const reversed = { ...TRIANGLE_DESIGN, members: TRIANGLE_DESIGN.members.map((member) => ({ ...member, startNodeId: member.endNodeId, endNodeId: member.startNodeId })) };
    const original = success(analyze(TRIANGLE_DESIGN, TRIANGLE_LOAD));
    const result = success(analyze(reversed, TRIANGLE_LOAD));
    for (const member of TRIANGLE_DESIGN.members) expect(result.memberForcesN[member.id]).toBeCloseTo(original.memberForcesN[member.id]!, 12);
  });

  it('is invariant to translating the geometry', () => {
    const moved = { ...TRIANGLE_DESIGN, nodes: TRIANGLE_DESIGN.nodes.map((node) => ({ ...node, x: node.x + 200, y: node.y - 300 })) };
    expect(analyze(moved, TRIANGLE_LOAD)).toEqual(analyze(TRIANGLE_DESIGN, TRIANGLE_LOAD));
  });

  it('returns zero deflections/forces for a zero load on a stable structure', () => {
    const result = success(analyze(TRIANGLE_DESIGN, { ...TRIANGLE_LOAD, fyN: 0 }));
    expect(Object.values(result.memberForcesN).every((value) => value === 0)).toBe(true);
    expect(Object.values(result.displacementsMm).every(({ x, y }) => x === 0 && y === 0)).toBe(true);
  });

  it.each([
    ['unbraced square', UNSTABLE_SQUARE_DESIGN, UNSTABLE_SQUARE_LOAD],
    ['no supports', { ...TRIANGLE_DESIGN, supports: [] }, TRIANGLE_LOAD],
    ['unconnected node', { ...TRIANGLE_DESIGN, nodes: [...TRIANGLE_DESIGN.nodes, { id: 'isolated', x: 20, y: 20 }] }, TRIANGLE_LOAD],
  ] as const)('rejects %s without stale performance data', (_, design, load) => {
    const result = analyze(design, load);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('Expected invalid');
    expect(result.issues.some(({ code }) => code === 'singular-system')).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['issues', 'status']);
  });

  it.each([
    ['zero length', { ...TRIANGLE_DESIGN, nodes: TRIANGLE_DESIGN.nodes.map((node) => node.id === 'apex' ? { ...node, x: 0, y: 0 } : node) }],
    ['missing stock', { ...TRIANGLE_DESIGN, stocks: [] }],
    ['missing endpoint', { ...TRIANGLE_DESIGN, nodes: TRIANGLE_DESIGN.nodes.slice(0, 2) }],
    ['nonfinite geometry', { ...TRIANGLE_DESIGN, nodes: TRIANGLE_DESIGN.nodes.map((node) => ({ ...node, x: Infinity })) }],
    ['negative area', { ...TRIANGLE_DESIGN, stocks: [{ ...TRIANGLE_DESIGN.stocks[0]!, areaMm2: -1 }] }],
    ['zero modulus', { ...TRIANGLE_DESIGN, stocks: [{ ...TRIANGLE_DESIGN.stocks[0]!, elasticModulusNPerMm2: 0 }] }],
    ['duplicate node', { ...TRIANGLE_DESIGN, nodes: [...TRIANGLE_DESIGN.nodes, TRIANGLE_DESIGN.nodes[0]!] }],
    ['duplicate member', { ...TRIANGLE_DESIGN, members: [...TRIANGLE_DESIGN.members, TRIANGLE_DESIGN.members[0]!] }],
    ['duplicate stock', { ...TRIANGLE_DESIGN, stocks: [...TRIANGLE_DESIGN.stocks, TRIANGLE_DESIGN.stocks[0]!] }],
    ['missing support node', { ...TRIANGLE_DESIGN, supports: [{ nodeId: 'missing', fixedX: true, fixedY: true }] }],
    ['empty restraint', { ...TRIANGLE_DESIGN, supports: [{ nodeId: 'left', fixedX: false, fixedY: false }] }],
    ['duplicate support', { ...TRIANGLE_DESIGN, supports: [...TRIANGLE_DESIGN.supports, TRIANGLE_DESIGN.supports[0]!] }],
  ] as const)('rejects %s', (_, design) => {
    expect(analyze(design, TRIANGLE_LOAD).status).toBe('invalid');
  });

  it.each([{ ...TRIANGLE_LOAD, fyN: NaN }, { ...TRIANGLE_LOAD, fxN: Infinity }, { ...TRIANGLE_LOAD, nodeId: 'missing' }])('rejects invalid loads: %j', (load) => {
    expect(analyze(TRIANGLE_DESIGN, load).status).toBe('invalid');
  });

  it('reports numerical overflow as invalid rather than exporting infinity', () => {
    const result = analyze({ ...TRIANGLE_DESIGN, stocks: [{ ...TRIANGLE_DESIGN.stocks[0]!, areaMm2: 1e308, elasticModulusNPerMm2: 1e308 }] }, TRIANGLE_LOAD);
    expect(result.status).toBe('invalid');
    expect(JSON.stringify(result)).toContain('numerical-failure');
  });
});

describe('one-brace ranking', () => {
  it('reproduces the first-load 26% versus 1% comparison', () => {
    const result = ranked(rankBraces(JUDGE_PRESET.design, loadAt('b1')));
    expect(result.bestPanelIds).toEqual(['panel-1']);
    expect(result.alternatives[0]!.deflection.reductionPercent).toBeCloseTo(26, 0);
    expect(result.alternatives[1]!.deflection.reductionPercent).toBeCloseTo(1, 0);
  });

  it('preserves both central best placements near 10.5%', () => {
    const result = ranked(rankBraces(JUDGE_PRESET.design, loadAt('b2')));
    expect(result.bestPanelIds).toEqual(['panel-2', 'panel-3']);
    expect(result.alternatives[1]!.deflection.reductionPercent).toBeCloseTo(10.5, 1);
    expect(result.alternatives[2]!.deflection.reductionPercent).toBeCloseTo(10.5, 1);
  });

  it.each(['b1', 'b2', 'b3'])('checks equilibrium for baseline and every one-brace alternative at %s', (nodeId) => {
    const load = loadAt(nodeId);
    const result = ranked(rankBraces(JUDGE_PRESET.design, load));
    expect(result.alternatives).toHaveLength(4);
    expect(result.baselineDesign.members).toHaveLength(17);
    checkEquilibrium(result.baselineDesign, load, result.baseline);
    for (const alternative of result.alternatives) {
      expect(alternative.design.members).toHaveLength(18);
      expect(alternative.design.id).toBe(`${JUDGE_PRESET.design.id}+${alternative.panelId}`);
      expect(alternative.deflection.revisedMm).toBeLessThanOrEqual(result.baselineDeflectionMm + 1e-10);
      checkEquilibrium(alternative.design, load, alternative.analysis);
    }
  });

  it('mirrors first and third joint rankings and deflections', () => {
    const left = ranked(rankBraces(JUDGE_PRESET.design, loadAt('b1')));
    const right = ranked(rankBraces(JUDGE_PRESET.design, loadAt('b3')));
    expect(right.bestPanelIds).toEqual(['panel-4']);
    expect(right.baselineDeflectionMm).toBeCloseTo(left.baselineDeflectionMm, 10);
    left.alternatives.forEach((option, i) => expect(option.deflection.revisedMm).toBeCloseTo(right.alternatives[3 - i]!.deflection.revisedMm, 10));
  });

  it('uses absolute change with no division by zero for a fully restrained load joint', () => {
    const result = ranked(rankBraces(JUDGE_PRESET.design, loadAt('b0')));
    expect(result.baselineDeflectionMm).toBe(0);
    expect(result.bestPanelIds).toEqual(['panel-1', 'panel-2', 'panel-3', 'panel-4']);
    for (const { deflection } of result.alternatives) {
      expect(deflection.reductionPercent).toBeNull();
      expect(deflection.reductionMm).toBe(0);
    }
  });

  it('ranks unrounded movement rather than manufacturing ties from displayed percentages', () => {
    const design = {
      ...JUDGE_PRESET.design,
      stocks: [...JUDGE_PRESET.design.stocks, { id: 'slightly-stiffer', areaMm2: 1, elasticModulusNPerMm2: 1000.1 }],
      braceOptions: JUDGE_PRESET.design.braceOptions.map((option) => option.panelId === 'panel-2'
        ? { ...option, member: { ...option.member, stockId: 'slightly-stiffer' } } : option),
    };
    const result = ranked(rankBraces(design, loadAt('b2')));
    expect(result.bestPanelIds).toEqual(['panel-2']);
    expect(result.alternatives[1]!.deflection.reductionPercent!.toFixed(1)).toBe(result.alternatives[2]!.deflection.reductionPercent!.toFixed(1));
  });

  it('rejects candidate edges already in the bridge or repeated under different member IDs', () => {
    const existing = JUDGE_PRESET.design.members.find(({ id }) => id === 'diagonal-1')!;
    const duplicateExisting = { ...JUDGE_PRESET.design, braceOptions: JUDGE_PRESET.design.braceOptions.map((option, i) => i === 0
      ? { ...option, member: { ...existing, id: option.member.id } } : option) };
    expect(rankBraces(duplicateExisting, loadAt('b1')).status).toBe('invalid');
    const duplicateAdded = { ...JUDGE_PRESET.design, braceOptions: JUDGE_PRESET.design.braceOptions.map((option, i) => i === 1
      ? { ...option, member: { ...JUDGE_PRESET.design.braceOptions[0]!.member, id: option.member.id } } : option) };
    expect(rankBraces(duplicateAdded, loadAt('b1')).status).toBe('invalid');
  });

  it('is deterministic, does not mutate frozen inputs, and preserves panel order', () => {
    const original = JSON.stringify(JUDGE_PRESET);
    const result = rankBraces(JUDGE_PRESET.design, JUDGE_PRESET.defaultLoad);
    expect(rankBraces(JUDGE_PRESET.design, JUDGE_PRESET.defaultLoad)).toEqual(result);
    expect(JSON.stringify(JUDGE_PRESET)).toBe(original);
    const reversed = ranked(rankBraces({ ...JUDGE_PRESET.design, braceOptions: [...JUDGE_PRESET.design.braceOptions].reverse() }, JUDGE_PRESET.defaultLoad));
    expect(reversed.alternatives.map(({ panelId }) => panelId)).toEqual(['panel-1', 'panel-2', 'panel-3', 'panel-4']);
  });

  it.each([
    { ...JUDGE_PRESET.defaultLoad, fyN: 0 }, { ...JUDGE_PRESET.defaultLoad, fyN: 1 },
    { ...JUDGE_PRESET.defaultLoad, fxN: 1 }, { ...JUDGE_PRESET.defaultLoad, fyN: NaN },
  ])('rejects unsupported comparison loads %j', (load) => {
    expect(rankBraces(JUDGE_PRESET.design, load).status).toBe('invalid');
  });

  it('rejects incomplete panel options and clears the whole ranking on any invalid alternative', () => {
    expect(rankBraces({ ...JUDGE_PRESET.design, braceOptions: JUDGE_PRESET.design.braceOptions.slice(0, 3) }, JUDGE_PRESET.defaultLoad).status).toBe('invalid');
    const result = rankBraces({ ...JUDGE_PRESET.design, braceOptions: JUDGE_PRESET.design.braceOptions.map((option, i) => i === 2 ? { ...option, member: { ...option.member, stockId: 'missing' } } : option) }, JUDGE_PRESET.defaultLoad);
    expect(result.status).toBe('invalid');
    expect(Object.keys(result).sort()).toEqual(['issues', 'status']);
  });
});
