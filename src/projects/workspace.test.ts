import { describe, expect, it } from 'vitest';
import { parseWorkspace, workspaceSignature } from './workspace';
import { savedWorkspace } from '../test/workspace';

describe('persisted workspace boundary', () => {
  it('round-trips and freezes the complete workspace without losing report precision', () => {
    const original = savedWorkspace();
    const restored = parseWorkspace(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual(original);
    expect(Object.isFrozen(restored.experiment.trials[0]?.results)).toBe(true);
    expect(restored.report?.readings[0]?.rawReadings).toEqual([0.04, 0.041, 0.039]);
  });
  it('keeps unfinished quote and measurement draft strings as entered', () => {
    const original = savedWorkspace();
    const restored = parseWorkspace({ ...original, quotes: { ...original.quotes, budget: '-', scope: '' }, measurements: { ...original.measurements, drafts: { case: { measuredNodeId: 'B1', units: 'mm', raw: 'unfinished', resolution: '', method: '', notes: '' } } } });
    expect(restored.quotes.budget).toBe('-');
    expect(restored.measurements.drafts.case?.raw).toBe('unfinished');
  });
  it.each([null, {}, { schemaVersion: 2 }, { ...savedWorkspace(), schemaVersion: 2 }, { ...savedWorkspace(), unexpected: true }])('rejects malformed or unsupported content', value => {
    expect(() => parseWorkspace(value)).toThrow();
  });
  it('rejects broken associations, geometry and non-finite data before hydration', () => {
    const original = savedWorkspace();
    expect(() => parseWorkspace({ ...original, experiment: { ...original.experiment, selectedTrialId: 'absent' } })).toThrow('selected');
    expect(() => parseWorkspace({ ...original, pattern: { ...original.pattern, spanMm: 200 } })).toThrow('pattern');
    expect(() => parseWorkspace({ ...original, pattern: { ...original.pattern, spanMm: Infinity } })).toThrow();
    const broken = structuredClone(original) as any;
    delete broken.experiment.trials[0].results.baseline.analysis.displacementMmByNode.B1;
    expect(() => parseWorkspace(broken)).toThrow('displacement');
  });
  it('rejects duplicate trials and oversized documents', () => {
    const original = savedWorkspace();
    expect(() => parseWorkspace({ ...original, experiment: { ...original.experiment, trials: [...original.experiment.trials, ...original.experiment.trials] } })).toThrow('Duplicate');
    expect(() => parseWorkspace({ ...original, extra: 'x'.repeat(2_000_000) })).toThrow('2 MB');
  });
  it('compares JSONB documents independently of property order', () => {
    const original = savedWorkspace();
    const reordered = JSON.parse(JSON.stringify(original, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).reverse()) : item));
    expect(workspaceSignature(reordered)).toBe(workspaceSignature(original));
  });
  it('validates historical retest observations even when that retest is no longer active', () => {
    const original = savedWorkspace();
    const historical = { ...original.measurements.readings[0]!, appliedLoad: { nodeId: 'B3', fxN: 0, fyN: -10 } };
    expect(() => parseWorkspace({ ...original, measurements: { ...original.measurements, readings: [historical] } })).not.toThrow();
    expect(() => parseWorkspace({ ...original, measurements: { ...original.measurements, readings: [{ ...historical, displacement: 999 }] } })).toThrow('mean');
  });
});
