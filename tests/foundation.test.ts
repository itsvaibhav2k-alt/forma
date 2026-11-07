import { describe, expect, it } from 'vitest';
import {
  DEMO_FINANCE_INPUTS, FOUNDATION_FINANCE_MODEL, FOUNDATION_TRIAL_STATE,
  JUDGE_PRESET, TRIANGLE_DESIGN, UNSTABLE_SQUARE_DESIGN, immutableCopy,
} from '../src/shared';

describe('canonical fixtures', () => {
  it('provides the fixed four-panel geometry, supports, and three legal load joints', () => {
    const { design } = JUDGE_PRESET;
    expect(design.nodes).toHaveLength(10);
    expect(design.members).toHaveLength(17);
    expect(design.nodes.filter((node) => node.id.startsWith('b')).map(({ x, y }) => [x, y]))
      .toEqual([[0, 0], [60, 0], [120, 0], [180, 0], [240, 0]]);
    expect(design.nodes.filter((node) => node.id.startsWith('t')).map(({ x, y }) => [x, y]))
      .toEqual([[0, 40], [60, 40], [120, 40], [180, 40], [240, 40]]);
    expect(design.supports).toEqual([
      { nodeId: 'b0', fixedX: true, fixedY: true },
      { nodeId: 'b4', fixedX: false, fixedY: true },
    ]);
    expect(JUDGE_PRESET.loadNodeIds).toEqual(['b1', 'b2', 'b3']);
    expect(JUDGE_PRESET.defaultLoad).toEqual({ nodeId: 'b1', fxN: 0, fyN: -1 });
  });

  it('has two rising then two falling diagonals, with four distinct opposite additions', () => {
    const { design } = JUDGE_PRESET;
    const endpoints = (item: { startNodeId: string; endNodeId: string }) => [item.startNodeId, item.endNodeId];
    expect(design.members.filter(({ id }) => id.startsWith('diagonal-')).map(endpoints))
      .toEqual([['b0', 't1'], ['b1', 't2'], ['t2', 'b3'], ['t3', 'b4']]);
    expect(design.braceOptions.map(({ member }) => endpoints(member)))
      .toEqual([['t0', 'b1'], ['t1', 'b2'], ['b2', 't3'], ['b3', 't4']]);
    for (const { member } of design.braceOptions) {
      const start = design.nodes.find(({ id }) => id === member.startNodeId)!;
      const end = design.nodes.find(({ id }) => id === member.endNodeId)!;
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(Math.sqrt(5200), 12);
    }
  });

  it.each([JUDGE_PRESET.design, TRIANGLE_DESIGN, UNSTABLE_SQUARE_DESIGN])(
    'keeps $id references valid, member IDs unique, and EA at the declared 1,000 N', (design) => {
      const nodeIds = new Set(design.nodes.map(({ id }) => id));
      const stockIds = new Set(design.stocks.map(({ id }) => id));
      const allMembers = [...design.members, ...design.braceOptions.map(({ member }) => member)];
      expect(new Set(allMembers.map(({ id }) => id)).size).toBe(allMembers.length);
      for (const member of allMembers) {
        expect(nodeIds.has(member.startNodeId)).toBe(true);
        expect(nodeIds.has(member.endNodeId)).toBe(true);
        expect(member.startNodeId).not.toBe(member.endNodeId);
        expect(stockIds.has(member.stockId)).toBe(true);
      }
      for (const stock of design.stocks) expect(stock.areaMm2 * stock.elasticModulusNPerMm2).toBe(1000);
    },
  );

  it('labels every seeded financial input as fictional, including explicit zero donations', () => {
    const { quoteA, quoteB } = DEMO_FINANCE_INPUTS;
    expect(quoteA.scopeId).toBe(quoteB.scopeId);
    for (const quote of [quoteA, quoteB]) {
      for (const key of ['purchase', 'delivery', 'installation', 'donation', 'annualUpkeep'] as const) {
        expect(quote[key].source.kind).toBe('demonstration');
        expect(quote[key].source.label).toContain('Fictional');
      }
      expect(quote.donation.amountUSD).toBe(0);
    }
    expect(quoteA.purchase.amountUSD! + quoteA.delivery.amountUSD! + quoteA.installation.amountUSD!).toBe(19000);
    expect(quoteB.purchase.amountUSD! + quoteB.delivery.amountUSD! + quoteB.installation.amountUSD!).toBe(21000);
  });

  it('does not substitute reference numbers for live calculation results', () => {
    expect(FOUNDATION_TRIAL_STATE.phase).toBe('predicting');
    expect(FOUNDATION_TRIAL_STATE.history).toEqual([]);
    expect(FOUNDATION_TRIAL_STATE).not.toHaveProperty('currentResult');
    expect(FOUNDATION_FINANCE_MODEL.result.status).toBe('pending');
  });
});

describe('immutable data boundary', () => {
  it('detaches nested snapshots from the input and rejects writes at every level', () => {
    const input = { load: { nodeId: 'b1', fyN: -1 }, results: [{ displacementMm: 0.2 }] };
    const snapshot = immutableCopy(input);
    input.load.fyN = -2;
    input.results[0]!.displacementMm = 0.4;
    expect(snapshot.load.fyN).toBe(-1);
    expect(snapshot.results[0]!.displacementMm).toBe(0.2);
    expect(Object.isFrozen(snapshot.results)).toBe(true);
    expect(() => Object.assign(snapshot.load, { fyN: -3 })).toThrow(TypeError);
    expect(() => Object.assign(snapshot.results[0]!, { displacementMm: 9 })).toThrow(TypeError);
    expect(input.load.fyN).toBe(-2);
  });

  it('protects exported shared fixtures from accidental cross-lane edits', () => {
    expect(Object.isFrozen(JUDGE_PRESET.design.nodes[0])).toBe(true);
    expect(Object.isFrozen(DEMO_FINANCE_INPUTS.quoteA.purchase.source)).toBe(true);
    expect(() => Object.assign(JUDGE_PRESET.design.nodes[0]!, { x: 999 })).toThrow(TypeError);
  });
});
