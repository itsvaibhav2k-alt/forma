import { describe, expect, it } from 'vitest';
import { parseWorkspace, workspaceSignature } from './workspace';
import { savedWorkspace } from '../test/workspace';
import legacyWorkspace from '../test/legacy-workspace.json';

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
  it('preserves history inspection independently of the active draft and defaults old documents to no inspection', () => {
    const original = savedWorkspace();
    const inspected = {
      ...original,
      experiment: {
        ...original.experiment,
        round: { phase: 'predicting', roundId: 'draft-round', load: { nodeId: 'B3', fxN: 0, fyN: -10 }, panelId: 'P4' },
        selectedTrialId: null,
        inspectedTrialId: original.experiment.trials[0]!.id,
        retest: { status: 'idle' },
      },
    };
    const restored = parseWorkspace(inspected);
    expect(restored.experiment).toEqual(inspected.experiment);
    expect(() => parseWorkspace({ ...inspected, experiment: { ...inspected.experiment, inspectedTrialId: 'absent' } })).toThrow('inspected trial');
    const legacy = structuredClone(original);
    Reflect.deleteProperty(legacy.experiment, 'inspectedTrialId');
    expect(parseWorkspace(legacy).experiment.inspectedTrialId).toBeNull();
  });
  it('rejects mixed solver versions within a trial or a retest before hydration', () => {
    const trialMismatch = structuredClone(savedWorkspace());
    Reflect.set(trialMismatch.experiment.trials[0]!.results.candidates.P2.analysis, 'solverVersion', 'forma-truss-2d-v1');
    expect(() => parseWorkspace(trialMismatch)).toThrow('Saved trial results must use the trial solver version');
    const retestMismatch = structuredClone(savedWorkspace());
    if (retestMismatch.experiment.retest.status !== 'ready') throw new Error('Expected retest fixture');
    Reflect.set(retestMismatch.experiment.retest.value.results.baseline.analysis, 'solverVersion', 'forma-truss-2d-v1');
    expect(() => parseWorkspace(retestMismatch)).toThrow('Retest results must use the source trial solver version');
    const reportMismatch = structuredClone(savedWorkspace());
    Reflect.set(reportMismatch.report!.trial.results.baseline.analysis, 'solverVersion', 'forma-truss-2d-v1');
    expect(() => parseWorkspace(reportMismatch)).toThrow('preset and solver versions');
  });
  it('rejects unknown solver versions instead of relabeling stored results', () => {
    const original = structuredClone(savedWorkspace());
    Reflect.set(original.experiment.trials[0]!, 'solverVersion', 'unknown-solver');
    expect(() => parseWorkspace(original)).toThrow('unsupported or invalid');
  });
  it('restores an authentic phases project without changing its legacy calculations, retest or frozen artifacts', () => {
    // Generated by the original bd3cc5a phases modules, not by relabeling current results.
    const restored = parseWorkspace(legacyWorkspace);
    expect(restored.experiment.inspectedTrialId).toBeNull();
    expect(restored.experiment.trials).toEqual(legacyWorkspace.experiment.trials);
    expect(restored.experiment.retest).toEqual(legacyWorkspace.experiment.retest);
    expect(restored.report).toEqual(legacyWorkspace.report);
    expect(restored.pattern).toEqual(legacyWorkspace.pattern);
    expect(restored.experiment.trials[0]!.solverVersion).toBe('forma-truss-2d-v1');
    expect(Object.isFrozen(restored.report)).toBe(true);
    expect(parseWorkspace(JSON.parse(JSON.stringify(restored)))).toEqual(restored);
  });
  it('keeps old and current trials together while preserving each solver provenance', () => {
    const current = savedWorkspace();
    const legacy = parseWorkspace(legacyWorkspace).experiment.trials[0]!;
    const legacyTrial = { ...legacy, id: 'legacy-trial', roundId: 'legacy-round' };
    const combined = { ...current, experiment: { ...current.experiment, trials: [...current.experiment.trials, legacyTrial], inspectedTrialId: legacyTrial.id } };
    const restored = parseWorkspace(combined);
    expect(restored).toEqual(combined);
    expect(restored.experiment.trials.map(item => item.solverVersion)).toEqual(['astra-truss-main-9a9c2d8', 'forma-truss-2d-v1']);
  });
  it('validates historical retest observations even when that retest is no longer active', () => {
    const original = savedWorkspace();
    const historical = { ...original.measurements.readings[0]!, appliedLoad: { nodeId: 'B3', fxN: 0, fyN: -10 } };
    expect(() => parseWorkspace({ ...original, measurements: { ...original.measurements, readings: [historical] } })).not.toThrow();
    expect(() => parseWorkspace({ ...original, measurements: { ...original.measurements, readings: [{ ...historical, displacement: 999 }] } })).toThrow('mean');
  });
});
