import { describe, expect, it } from 'vitest';
import { PANEL_IDS, type Design } from '../shared';
import { bridgeFixture } from '../shared/fixtures/bridge';
import { zeroLengthFixture } from '../shared/fixtures/invalid';
import { createBraceMember, createBridgePreset } from './preset';
import { validateDesign, validateLoadCase } from './validation';

describe('production bridge preset', () => {
  it('matches the independently transcribed nodes, stocks, restraints and all 17 members', () => {
    expect(createBridgePreset()).toEqual(bridgeFixture.design);
    expect(validateDesign(createBridgePreset())).toBeNull();
  });

  it('provides four independent, equal-length legal additions without crossing joints', () => {
    const baseline = createBridgePreset();
    for (const panel of PANEL_IDS) {
      const brace = createBraceMember(panel);
      expect(brace).toEqual(bridgeFixture.additions[panel]);
      const candidate = { ...baseline, members: [...baseline.members, brace] };
      expect(candidate.nodes).toHaveLength(10);
      expect(candidate.members).toHaveLength(18);
      expect(validateDesign(candidate)).toBeNull();
      const start = candidate.nodes.find(node => node.id === brace.startNodeId)!;
      const end = candidate.nodes.find(node => node.id === brace.endNodeId)!;
      expect(Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm)).toBeCloseTo(Math.sqrt(5200), 12);
    }
    expect(baseline.members).toHaveLength(17);
  });

  it('returns fresh frozen geometry and keeps later callers independent', () => {
    const first = createBridgePreset();
    const second = createBridgePreset();
    expect(first).not.toBe(second);
    expect(first.nodes).not.toBe(second.nodes);
    expect(Object.isFrozen(first.nodes[0]!.restrained)).toBe(true);
    expect(Reflect.set(first.nodes[0]!, 'xMm', 999)).toBe(false);
  });
});

describe('structural input validation', () => {
  const base = createBridgePreset();
  const cases: readonly [string, unknown, string][] = [
    ['null design', null, 'INVALID_INPUT'],
    ['missing nodes', { ...base, nodes: undefined }, 'INVALID_INPUT'],
    ['empty members', { ...base, members: [] }, 'INVALID_INPUT'],
    ['duplicate node', { ...base, nodes: [...base.nodes, base.nodes[0]] }, 'INVALID_INPUT'],
    ['nonfinite coordinate', { ...base, nodes: base.nodes.map((node, i) => i === 0 ? { ...node, xMm: Infinity } : node) }, 'INVALID_INPUT'],
    ['invalid restraint', { ...base, nodes: base.nodes.map((node, i) => i === 0 ? { ...node, restrained: { x: 1, y: true } } : node) }, 'INVALID_INPUT'],
    ['zero modulus', { ...base, stocks: [{ ...base.stocks[0], elasticModulusNPerMm2: 0 }] }, 'INVALID_STOCK'],
    ['negative area', { ...base, stocks: [{ ...base.stocks[0], areaMm2: -1 }] }, 'INVALID_STOCK'],
    ['nonfinite stock', { ...base, stocks: [{ ...base.stocks[0], areaMm2: NaN }] }, 'INVALID_STOCK'],
    ['duplicate stock', { ...base, stocks: [...base.stocks, base.stocks[0]] }, 'INVALID_STOCK'],
    ['missing stock', { ...base, members: base.members.map((member, i) => i === 0 ? { ...member, stockId: 'missing' } : member) }, 'INVALID_STOCK'],
    ['duplicate member ID', { ...base, members: [...base.members, base.members[0]] }, 'DUPLICATE_MEMBER'],
    ['same edge with a new ID', { ...base, members: [...base.members, { ...base.members[0], id: 'duplicate-edge' }] }, 'DUPLICATE_MEMBER'],
    ['reversed duplicate edge', { ...base, members: [...base.members, { ...base.members[0], id: 'reverse', startNodeId: base.members[0]!.endNodeId, endNodeId: base.members[0]!.startNodeId }] }, 'DUPLICATE_MEMBER'],
    ['missing endpoint', { ...base, members: [{ ...base.members[0], startNodeId: 'missing' }] }, 'MISSING_ENDPOINT'],
    ['zero length', zeroLengthFixture.design, 'ZERO_LENGTH_MEMBER'],
  ];
  it.each(cases)('rejects %s with a typed error and no performance payload', (_, design, code) => {
    const result = validateDesign(design);
    expect(result).toMatchObject({ status: 'error', code });
    expect(Object.keys(result!).sort()).toEqual(['code', 'memberIds', 'message', 'nodeIds', 'status']);
  });

  it('includes available affected IDs', () => {
    expect(validateDesign({ ...base, members: [{ ...base.members[0], startNodeId: 'absent' }] })).toMatchObject({ nodeIds: ['absent'], memberIds: ['bottom-01'] });
  });

  it('detects coincident distinct endpoints and overflowing geometric differences', () => {
    const coincident: Design = { ...base, nodes: base.nodes.map(node => node.id === 'B1' ? { ...node, xMm: 0 } : node) };
    expect(validateDesign(coincident)?.code).toBe('ZERO_LENGTH_MEMBER');
    const overflow: Design = { ...base, nodes: base.nodes.map(node => ({ ...node, xMm: node.id === 'B0' ? -1e308 : 1e308 })) };
    expect(validateDesign(overflow)?.code).toBe('NUMERICAL_FAILURE');
  });

  it.each([null, { nodeId: 'B1', fxN: 0, fyN: NaN }, { nodeId: 'B1', fxN: Infinity, fyN: -10 }, { nodeId: 'missing', fxN: 0, fyN: -10 }])('rejects invalid point load %j', load => {
    expect(validateLoadCase(base, load)?.code).toBe('INVALID_INPUT');
  });

  it('allows general finite loads at the analyzer boundary', () => {
    for (const [fxN, fyN] of [[0, 0], [1, 0], [0, 1]]) expect(validateLoadCase(base, { nodeId: 'B1', fxN, fyN })).toBeNull();
  });
});
