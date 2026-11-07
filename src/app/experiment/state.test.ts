import { describe, expect, it } from 'vitest';
import { PRESET_VERSION, type AnalysisError, type Load, type RankedBraces, type Retest } from '../../shared';
import { createBridgePreset, rankBraces, SOLVER_VERSION } from '../../structures';
import { commitPrediction, createExperimentState, DEFAULT_LOAD, experimentDisplay, experimentReducer as reduce } from './state';

const loadB2: Load = { nodeId: 'B2', fxN: 0, fyN: -10 };
function ranking(load = DEFAULT_LOAD): RankedBraces {
  const result = rankBraces(createBridgePreset(), load);
  if (result.status === 'error') throw new Error(result.message);
  return result;
}
const resultsB1 = ranking();
const resultsB2 = ranking(loadB2);
const error: AnalysisError = { status: 'error', code: 'UNSTABLE', message: 'Test mechanism.', nodeIds: ['B1'], memberIds: [] };
const choose = () => reduce(createExperimentState('round-1'), { type: 'prediction/select-panel', panelId: 'P2' });
const commit = (state = choose(), id = 'trial-1', results = resultsB1) => reduce(state, { type: 'prediction/commit', roundId: state.round.roundId, trialId: id, results });
const retest = (sourceTrialId = 'trial-1'): Retest => ({ sourceTrialId, load: loadB2, chosenPanelId: 'P2', results: resultsB2 });

describe('prediction and history reducer', () => {
  it('keeps previews free of analysis until a legal panel is committed', () => {
    const initial = createExperimentState('round-1');
    expect(commit(initial)).toBe(initial);
    let state = reduce(initial, { type: 'prediction/move-load', load: loadB2 });
    state = reduce(state, { type: 'prediction/select-panel', panelId: 'P3' });
    expect(experimentDisplay(state)).toMatchObject({ load: loadB2, panelId: 'P3', results: null });
    expect(state.trials).toHaveLength(0);
  });

  it('captures one independent deep frozen trial even for repeated commits', () => {
    const mutable = structuredClone(resultsB1);
    const state = commit(choose(), 'trial-1', mutable);
    const trial = state.trials[0]!;
    expect(trial).toMatchObject({ id: 'trial-1', roundId: 'round-1', load: DEFAULT_LOAD, chosenPanelId: 'P2', presetVersion: PRESET_VERSION, solverVersion: SOLVER_VERSION });
    expect(trial.results).not.toBe(mutable);
    Reflect.set(mutable.candidates.P2.analysis, 'loadedJointDisplacementMm', 999);
    expect(trial.results.candidates.P2.analysis.loadedJointDisplacementMm).toBeCloseTo(0.043227, 6);
    expect(Object.isFrozen(trial.results.candidates.P2.analysis.displacementMmByNode.B1)).toBe(true);
    expect(commit(state, 'duplicate')).toBe(state);
    expect(reduce(state, { type: 'prediction/select-panel', panelId: 'P4' })).toBe(state);
    expect(reduce(state, { type: 'prediction/move-load', load: loadB2 })).toBe(state);
    expect(reduce(state, { type: 'prediction/fail', roundId: 'round-1', error })).toBe(state);
  });

  it('retests with the same brace and restores the exact original when selected', () => {
    const original = commit();
    const trial = original.trials[0]!;
    const state = reduce(original, { type: 'retest/show', value: retest() });
    expect(experimentDisplay(state)).toMatchObject({ load: loadB2, panelId: 'P2', results: resultsB2 });
    expect(state.trials[0]).toBe(trial);
    expect(trial.load.nodeId).toBe('B1');
    expect(trial.results.candidates.P2.change).toMatchObject({ kind: 'relative', reductionPercent: expect.closeTo(1.09, 2) });
    expect(state.retest.status === 'ready' && Object.isFrozen(state.retest.value.results)).toBe(true);
    const restored = reduce(state, { type: 'trial/select', trialId: trial.id });
    expect(restored.retest).toBe(state.retest);
    expect(restored.round).toBe(state.round);
    expect(reduce(restored, { type: 'trial/return' })).toEqual(state);
    expect(experimentDisplay(restored).results).toBe(trial.results);
    expect(experimentDisplay(restored).load).toBe(trial.load);
  });

  it('preserves history across rounds while clearing revealed and retest state', () => {
    const previous = reduce(commit(), { type: 'retest/show', value: retest() });
    let state = reduce(previous, { type: 'round/start', roundId: 'round-2', load: DEFAULT_LOAD });
    expect(state.trials).toBe(previous.trials);
    expect(state).toMatchObject({ selectedTrialId: null, retest: { status: 'idle' }, round: { phase: 'predicting', panelId: null } });
    expect(experimentDisplay(state).results).toBeNull();
    state = reduce(state, { type: 'prediction/select-panel', panelId: 'P1' });
    state = commit(state, 'trial-2');
    expect(state.trials).toHaveLength(2);
    state = reduce(state, { type: 'trial/select', trialId: 'trial-1' });
    expect(experimentDisplay(state).trial?.chosenPanelId).toBe('P2');
    expect(experimentDisplay(state).results).toBe(previous.trials[0]!.results);
  });

  it('inspects multiple trials without touching an unfinished draft, and blocks mutations', () => {
    const first = commit();
    let second = reduce(first, { type: 'round/start', roundId: 'round-2', load: DEFAULT_LOAD });
    second = reduce(second, { type: 'prediction/select-panel', panelId: 'P3' });
    second = commit(second, 'trial-2');
    let draft = reduce(second, { type: 'round/start', roundId: 'round-3', load: loadB2 });
    draft = reduce(draft, { type: 'prediction/select-panel', panelId: 'P4' });
    let inspected = reduce(draft, { type: 'trial/select', trialId: 'trial-1' });
    expect(inspected.round).toBe(draft.round);
    expect(inspected.trials).toBe(draft.trials);
    expect(experimentDisplay(inspected).trial?.id).toBe('trial-1');
    expect(reduce(inspected, { type: 'prediction/select-panel', panelId: 'P1' })).toBe(inspected);
    expect(reduce(inspected, { type: 'round/start', roundId: 'round-4', load: DEFAULT_LOAD })).toBe(inspected);
    inspected = reduce(inspected, { type: 'trial/select', trialId: 'trial-2' });
    expect(experimentDisplay(inspected).trial?.id).toBe('trial-2');
    const returned = reduce(inspected, { type: 'trial/return' });
    expect(returned).toEqual(draft);
    expect(experimentDisplay(returned)).toMatchObject({ panelId: 'P4', load: loadB2, results: null });
  });

  it('ignores stale events, reused IDs and mismatched load, preset or solver results', () => {
    const state = choose();
    expect(reduce(state, { type: 'prediction/commit', roundId: 'old-round', trialId: 'trial-1', results: resultsB1 })).toBe(state);
    expect(reduce(state, { type: 'prediction/fail', roundId: 'old-round', error })).toBe(state);
    expect(commit(state, 'trial-1', resultsB2)).toBe(state);
    for (const field of ['preset', 'solver', 'candidate-solver'] as const) {
      const changed = structuredClone(resultsB1);
      if (field === 'preset') Reflect.set(changed.baseline.design, 'presetVersion', 'wrong');
      else if (field === 'solver') Reflect.set(changed.baseline.analysis, 'solverVersion', 'wrong');
      else Reflect.set(changed.candidates.P3.analysis, 'solverVersion', 'wrong');
      expect(commit(state, 'trial-1', changed)).toBe(state);
    }
    let next = reduce(commit(), { type: 'round/start', roundId: 'round-2', load: DEFAULT_LOAD });
    next = reduce(next, { type: 'prediction/select-panel', panelId: 'P1' });
    expect(commit(next, 'trial-1')).toBe(next);
    expect(reduce(next, { type: 'trial/select', trialId: 'missing' })).toBe(next);
    expect(reduce(next, { type: 'round/start', roundId: 'round-1', load: DEFAULT_LOAD })).toBe(next);
  });

  it('rejects retests from another trial, with another brace, or mismatched results', () => {
    const state = commit();
    for (const value of [retest('missing'), { ...retest(), chosenPanelId: 'P1' as const }, { ...retest(), results: resultsB1 }]) {
      expect(reduce(state, { type: 'retest/show', value })).toBe(state);
    }
    const fresh = createExperimentState('round-2');
    expect(reduce(fresh, { type: 'retest/show', value: retest() })).toBe(fresh);
    expect(reduce(fresh, { type: 'retest/fail', load: loadB2, error })).toBe(fresh);
  });

  it('clears active results on failure and preserves earlier trials for recovery', () => {
    const original = commit();
    const successfulRetest = reduce(original, { type: 'retest/show', value: retest() });
    const failed = reduce(successfulRetest, { type: 'retest/fail', load: loadB2, error });
    expect(experimentDisplay(failed)).toMatchObject({ load: loadB2, panelId: 'P2', results: null, error });
    expect(failed.trials).toBe(original.trials);
    expect(failed.retest).not.toHaveProperty('value');
    let newRound = reduce(failed, { type: 'round/start', roundId: 'round-2', load: DEFAULT_LOAD });
    newRound = reduce(newRound, { type: 'prediction/select-panel', panelId: 'P3' });
    newRound = reduce(newRound, { type: 'prediction/fail', roundId: 'round-2', error });
    expect(experimentDisplay(newRound)).toMatchObject({ panelId: 'P3', results: null, error });
    expect(newRound.trials).toHaveLength(1);
    const recovered = commit(newRound, 'trial-2');
    expect(recovered.trials).toHaveLength(2);
    expect(experimentDisplay(recovered).error).toBeNull();
  });

  it('rejects invalid judging controls even if TypeScript is bypassed', () => {
    const state = choose();
    expect(reduce(state, { type: 'prediction/select-panel', panelId: 'P9' as 'P1' })).toBe(state);
    expect(reduce(state, { type: 'prediction/move-load', load: { ...DEFAULT_LOAD, fyN: -1 } as unknown as Load })).toBe(state);
  });
});

it('the commit adapter refuses associations from a different scenario', () => {
  expect(() => commitPrediction({ trialId: 'x', roundId: 'r', presetVersion: PRESET_VERSION, load: DEFAULT_LOAD, chosenPanelId: 'P2', results: resultsB2 })).toThrow(/must match/);
});
