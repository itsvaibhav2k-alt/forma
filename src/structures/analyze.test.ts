import { describe, expect, it } from 'vitest';
import type { Analysis, Design, LoadCase } from '../shared';
import { triangleFixture } from '../shared/fixtures/triangle';
import { unstableSquareFixture, zeroLengthFixture } from '../shared/fixtures/invalid';
import { analyze, SOLVER_VERSION } from './analyze';
import { createBridgePreset } from './preset';
import { expectEquilibrium } from '../test/structure-assertions';

function successful(design: Design, load: LoadCase): Analysis {
  const result = analyze(design, load);
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status !== 'ok') throw new Error(result.message);
  return result;
}

describe('direct stiffness analysis', () => {
  const { design, load, expected } = triangleFixture;

  it('passes the independent triangle reference and returns complete signed fields', () => {
    const result = successful(design, load);
    expect(result.solverVersion).toBe(SOLVER_VERSION);
    expect(Object.keys(result.displacementMmByNode).sort()).toEqual(['A', 'B', 'C']);
    expect(Object.keys(result.axialForceNByMember).sort()).toEqual(['AB', 'AC', 'BC']);
    expect(Object.keys(result.reactionNByNode).sort()).toEqual(['A', 'B']);
    for (const [id, force] of Object.entries(expected.axialForceNByMember)) {
      expect(Math.abs(result.axialForceNByMember[id]! - force)).toBeLessThan(Math.abs(force) * triangleFixture.relativeTolerance);
    }
    expect(result.reactionNByNode.A!.y).toBeCloseTo(0.5, 12);
    expect(result.reactionNByNode.B!.y).toBeCloseTo(0.5, 12);
    expect(result.displacementMmByNode.C!.y).toBeCloseTo(-(0.05 + Math.SQRT2 / 10), 12);
    expect(Math.abs(result.displacementMmByNode.C!.y - expected.apexUyMm)).toBeLessThan(Math.abs(expected.apexUyMm) * triangleFixture.relativeTolerance);
    expect(result.loadedJointDisplacementMm).toBe(-result.displacementMmByNode.C!.y);
    expect(result.displacementMmByNode.A).toEqual({ x: 0, y: 0 });
    expect(result.displacementMmByNode.B!.y).toBe(0);
    expectEquilibrium(design, load, result);
  });

  it('obeys force scaling and load reversal without losing force signs', () => {
    const reference = successful(design, load);
    for (const factor of [-3, 0, 7]) {
      const result = successful(design, { ...load, fyN: load.fyN * factor });
      for (const node of design.nodes) {
        expect(result.displacementMmByNode[node.id]!.x).toBeCloseTo(reference.displacementMmByNode[node.id]!.x * factor, 12);
        expect(result.displacementMmByNode[node.id]!.y).toBeCloseTo(reference.displacementMmByNode[node.id]!.y * factor, 12);
      }
      for (const member of design.members) expect(result.axialForceNByMember[member.id]!).toBeCloseTo(reference.axialForceNByMember[member.id]! * factor, 12);
    }
  });

  it('is independent of node/member ordering, endpoint direction, translation and design ID', () => {
    const reference = successful(design, load);
    const transformed: Design = {
      ...design, id: 'arbitrary', nodes: [...design.nodes].reverse().map(node => ({ ...node, xMm: node.xMm + 172, yMm: node.yMm - 83 })),
      members: [...design.members].reverse().map(member => ({ ...member, startNodeId: member.endNodeId, endNodeId: member.startNodeId })),
    };
    const result = successful(transformed, load);
    for (const node of design.nodes) {
      expect(result.displacementMmByNode[node.id]!.x).toBeCloseTo(reference.displacementMmByNode[node.id]!.x, 12);
      expect(result.displacementMmByNode[node.id]!.y).toBeCloseTo(reference.displacementMmByNode[node.id]!.y, 12);
    }
    for (const member of design.members) expect(result.axialForceNByMember[member.id]!).toBeCloseTo(reference.axialForceNByMember[member.id]!, 12);
    expectEquilibrium(transformed, load, result);
  });

  it('equilibrates stiffness across many absolute scales without declaring a stable truss singular', () => {
    const reference = successful(design, load);
    for (const factor of [1e-18, 1e18]) {
      const scaled = { ...design, stocks: design.stocks.map(stock => ({ ...stock, elasticModulusNPerMm2: stock.elasticModulusNPerMm2 * factor })) };
      const result = successful(scaled, load);
      expect(result.loadedJointDisplacementMm * factor).toBeCloseTo(reference.loadedJointDisplacementMm, 12);
      expect(result.axialForceNByMember.AC!).toBeCloseTo(reference.axialForceNByMember.AC!, 12);
    }
  });

  it('uses each member stock: doubling only the bottom chord stiffness matches virtual work', () => {
    const differentStocks = {
      ...design,
      stocks: [...design.stocks, { ...design.stocks[0]!, id: 'stiffer', areaMm2: 2 }],
      members: design.members.map(member => member.id === 'AB' ? { ...member, stockId: 'stiffer' } : member),
    };
    const result = successful(differentStocks, load);
    expect(result.loadedJointDisplacementMm).toBeCloseTo(0.025 + Math.SQRT2 / 10, 12);
    expectEquilibrium(differentStocks, load, result);
  });

  it('solves a horizontal bar and accounts for loads applied directly at supports', () => {
    const bar: Design = { ...design, nodes: design.nodes.slice(0, 2), members: design.members.slice(0, 1) };
    const result = successful(bar, { nodeId: 'B', fxN: 5, fyN: -3 });
    expect(result.displacementMmByNode.B).toEqual({ x: 1, y: 0 });
    expect(result.loadedJointDisplacementMm).toBe(0);
    expect(result.axialForceNByMember.AB).toBe(5);
    expect(result.reactionNByNode.A!.x).toBe(-5);
    expect(result.reactionNByNode.B!.y).toBe(3);
    expectEquilibrium(bar, { nodeId: 'B', fxN: 5, fyN: -3 }, result);
  });

  it('handles a fully restrained system with no free degrees of freedom', () => {
    const fixed = { ...design, nodes: design.nodes.map(node => ({ ...node, restrained: { x: true, y: true } })) };
    const result = successful(fixed, load);
    expect(result.loadedJointDisplacementMm).toBe(0);
    expect(result.reactionNByNode.C).toEqual({ x: 0, y: 1 });
    expect(Object.values(result.axialForceNByMember)).toEqual([0, 0, 0]);
  });

  it('handles prototype-like IDs as ordinary IDs', () => {
    const rename = (id: string) => id === 'C' ? '__proto__' : id;
    const renamed: Design = {
      ...design, nodes: design.nodes.map(node => ({ ...node, id: rename(node.id) })),
      members: design.members.map(member => ({ ...member, id: member.id === 'AB' ? '__proto__' : member.id, startNodeId: rename(member.startNodeId), endNodeId: rename(member.endNodeId) })),
    };
    const result = successful(renamed, { ...load, nodeId: '__proto__' });
    expect(Object.hasOwn(result.displacementMmByNode, '__proto__')).toBe(true);
    expect(result.axialForceNByMember.__proto__).toBeCloseTo(0.5, 12);
  });

  it('balances a general oblique load and does not mutate caller inputs', () => {
    const baseline = structuredClone(createBridgePreset());
    const before = structuredClone(baseline);
    const generalLoad = { nodeId: 'T3', fxN: 4, fyN: 6 };
    expectEquilibrium(baseline, generalLoad, successful(baseline, generalLoad));
    expect(baseline).toEqual(before);
  });
});

describe('analysis failures', () => {
  it.each([unstableSquareFixture, zeroLengthFixture])('rejects $design.id without returning numeric payloads', fixture => {
    const result = analyze(fixture.design, fixture.load);
    expect(result).toMatchObject({ status: 'error', code: fixture.expectedCode });
    expect(Object.keys(result).sort()).toEqual(['code', 'memberIds', 'message', 'nodeIds', 'status']);
  });

  it('rejects a mechanism even when the applied force is zero', () => {
    expect(analyze(unstableSquareFixture.design, { ...unstableSquareFixture.load, fyN: 0 })).toMatchObject({ status: 'error', code: 'UNSTABLE' });
  });

  it('detects missing restraints and isolated free nodes', () => {
    const design = createBridgePreset();
    for (const nodes of [
      design.nodes.map(node => ({ ...node, restrained: { x: false, y: false } })),
      [...design.nodes, { id: 'isolated', xMm: 300, yMm: 100, restrained: { x: false, y: false } }],
    ]) expect(analyze({ ...design, nodes }, { nodeId: 'B1', fxN: 0, fyN: -10 })).toMatchObject({ status: 'error', code: 'UNSTABLE' });
  });

  it('rejects a near mechanism with an extremely weak stabilizing diagonal', () => {
    const { design, load } = unstableSquareFixture;
    const weak: Design = {
      ...design, stocks: [...design.stocks, { id: 'weak', elasticModulusNPerMm2: 1e-11, areaMm2: 1 }],
      members: [...design.members, { id: 'AC', startNodeId: 'A', endNodeId: 'C', stockId: 'weak' }],
    };
    expect(analyze(weak, load)).toMatchObject({ status: 'error', code: 'UNSTABLE' });
    const stable = { ...weak, stocks: weak.stocks.map(stock => ({ ...stock, elasticModulusNPerMm2: 1000 })) };
    expectEquilibrium(stable, load, successful(stable, load));
  });

  it.each([1e308, Number.MIN_VALUE])('rejects overflow/underflow in member stiffness (%s)', modulus => {
    const design = createBridgePreset();
    const changed = { ...design, stocks: [{ ...design.stocks[0]!, elasticModulusNPerMm2: modulus, areaMm2: modulus }] };
    expect(analyze(changed, { nodeId: 'B1', fxN: 0, fyN: -10 })).toMatchObject({ status: 'error', code: 'NUMERICAL_FAILURE' });
  });

  it('validates runtime inputs and never reuses a previous successful result', () => {
    const design = createBridgePreset();
    successful(design, { nodeId: 'B1', fxN: 0, fyN: -10 });
    expect(analyze(null as unknown as Design, { nodeId: 'B1', fxN: 0, fyN: -10 })).toMatchObject({ status: 'error', code: 'INVALID_INPUT' });
    expect(analyze(design, { nodeId: 'B1', fxN: 0, fyN: NaN })).toMatchObject({ status: 'error', code: 'INVALID_INPUT' });
    expect(analyze(zeroLengthFixture.design, zeroLengthFixture.load)).toMatchObject({ status: 'error', code: 'ZERO_LENGTH_MEMBER' });
  });
});
