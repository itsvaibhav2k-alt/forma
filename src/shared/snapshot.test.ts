import { describe, expect, expectTypeOf, it } from 'vitest';
import { snapshot } from './snapshot';

describe('plain-data snapshots', () => {
  it('preserves tuple length and element types for paired quote contracts', () => {
    const pair: [{ usd: number }, { note: string }] = [{ usd: 0 }, { note: 'Unknown' }];
    const frozen = snapshot(pair);
    expectTypeOf(frozen).toEqualTypeOf<readonly [{ readonly usd: number }, { readonly note: string }]>();
    expect(frozen).toHaveLength(2);
    expect(Object.isFrozen(frozen[0])).toBe(true);
  });
  it('isolates nested data from subsequent edits to its source', () => {
    const source = { load: { nodeId: 'B1' }, costs: [{ usd: 19000 }], winners: ['P1'] };
    const result = snapshot(source);
    source.load.nodeId = 'B2';
    source.costs[0]!.usd = 21000;
    source.winners.push('P2');
    expect(result).toEqual({ load: { nodeId: 'B1' }, costs: [{ usd: 19000 }], winners: ['P1'] });
  });

  it('rejects nested mutation, including when accessed from untyped callers', () => {
    const result = snapshot({ candidates: [{ change: { percent: 1.09 } }] });
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(() => Reflect.set(result.candidates[0]!.change, 'percent', 10.46)).not.toThrow();
    expect(Reflect.set(result.candidates[0]!.change, 'percent', 10.46)).toBe(false);
    expect(result.candidates[0]!.change.percent).toBe(1.09);
  });
});
