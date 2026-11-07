import { describe, expect, it } from 'vitest';
import { commitPrediction, createTrialState, transitionTrial } from '../src/trials';
import { JUDGE_PRESET, type CommittedState, type PanelId, type TrialState } from '../src/shared';

const version = JUDGE_PRESET.version;
function initial(): TrialState {
  const state = createTrialState(version);
  if (!('phase' in state)) throw new Error('Expected known preset');
  return state;
}
function committed(state: TrialState): CommittedState {
  expect(state.phase).toBe('committed');
  if (state.phase !== 'committed') throw new Error('Expected commitment');
  return state;
}

describe('immutable prediction snapshots', () => {
  it('captures copied inputs and deep-frozen original results without retaining mutable caller objects', () => {
    const load = { ...JUDGE_PRESET.defaultLoad };
    const result = commitPrediction(version, load, 'panel-1');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected commitment');
    load.nodeId = 'b3'; load.fyN = -9;
    const trial = result.trial;
    expect(trial.loadCase).toEqual(JUDGE_PRESET.defaultLoad);
    expect(trial.originalResult.loadCase).toEqual(JUDGE_PRESET.defaultLoad);
    expect(trial.originalResult.baselineDesign).not.toBe(JUDGE_PRESET.design);
    expect(trial.originalResult.baselineDesign.nodes[0]).not.toBe(JUDGE_PRESET.design.nodes[0]);
    expect(() => Object.assign(trial.loadCase, { fyN: -5 })).toThrow(TypeError);
    expect(() => Object.assign(trial.originalResult.baseline.displacementsMm.b1!, { y: 9 })).toThrow(TypeError);
    expect(() => Object.assign(trial.originalResult.alternatives[0]!.analysis.memberForcesN, { 'added-brace-1': 99 })).toThrow(TypeError);
    expect(Object.isFrozen(trial.originalResult.alternatives)).toBe(true);
  });

  it('is deterministic for identical commits without clocks, random IDs or global history', () => {
    expect(commitPrediction(version, JUDGE_PRESET.defaultLoad, 'panel-1')).toEqual(commitPrediction(version, JUDGE_PRESET.defaultLoad, 'panel-1'));
    expect(initial().history).toEqual([]);
  });

  it('rejects an unknown preset without exposing a trial', () => {
    expect(createTrialState('unknown')).toMatchObject({ status: 'invalid' });
    const result = commitPrediction('unknown', JUDGE_PRESET.defaultLoad, 'panel-1');
    expect(result).toMatchObject({ status: 'invalid' });
    expect(result).not.toHaveProperty('trial');
  });

  it.each([
    { nodeId: 'b0', fxN: 0, fyN: -1 }, { nodeId: 't2', fxN: 0, fyN: -1 },
    { nodeId: 'missing', fxN: 0, fyN: -1 }, { nodeId: 'b1', fxN: 1, fyN: -1 },
    { nodeId: 'b1', fxN: 0, fyN: 0 }, { nodeId: 'b1', fxN: 0, fyN: 1 },
    { nodeId: 'b1', fxN: 0, fyN: -Infinity },
  ])('rejects illegal judging load %j', (load) => {
    expect(commitPrediction(version, load, 'panel-1').status).toBe('invalid');
  });

  it('rejects a panel outside the preset', () => {
    expect(commitPrediction(version, JUDGE_PRESET.defaultLoad, 'invalid' as PanelId).status).toBe('invalid');
  });
});

describe('trial transitions with the real solver', () => {
  it('starts hidden, accepts draft controls, and reveals only after commit', () => {
    let state = initial();
    expect(state.phase).toBe('predicting');
    expect(state).not.toHaveProperty('currentResult');
    state = transitionTrial(state, { type: 'select-panel', panelId: 'panel-3' });
    state = transitionTrial(state, { type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: -2 } });
    expect(state).not.toHaveProperty('currentResult');
    expect(state.history).toHaveLength(0);
    const result = committed(transitionTrial(state, { type: 'commit' }));
    expect(result.history).toHaveLength(1);
    expect(result.committedTrial.panelId).toBe('panel-3');
    expect(result.currentResult).toMatchObject({ status: 'ok', bestPanelIds: ['panel-2', 'panel-3'] });
    expect(result.committedTrial.loadCase.fyN).toBe(-2);
  });

  it('retests the same brace at new positions and magnitudes while preserving the first prediction exactly', () => {
    const first = committed(transitionTrial(initial(), { type: 'commit' }));
    const before = JSON.stringify(first.history[0]);
    const originalState = JSON.stringify(first);
    const second = committed(transitionTrial(first, { type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: -3 } }));
    expect(second.selectedPanelId).toBe('panel-1');
    expect(second.committedTrial.panelId).toBe('panel-1');
    expect(second.currentResult).toMatchObject({ status: 'ok', loadCase: { nodeId: 'b2', fxN: 0, fyN: -3 }, bestPanelIds: ['panel-2', 'panel-3'] });
    expect(JSON.stringify(second.history[0])).toBe(before);
    expect(second.history).toHaveLength(1);
    expect(second.committedTrial.originalResult).toEqual(first.currentResult);
    expect(JSON.stringify(first)).toBe(originalState);
  });

  it('cannot switch braces or commit again while in the committed phase', () => {
    const first = committed(transitionTrial(initial(), { type: 'commit' }));
    expect(transitionTrial(first, { type: 'select-panel', panelId: 'panel-4' })).toBe(first);
    expect(transitionTrial(first, { type: 'commit' })).toBe(first);
    expect(first.history).toHaveLength(1);
  });

  it('hides a new round until commit and appends it without changing the first trial', () => {
    const first = committed(transitionTrial(initial(), { type: 'commit' }));
    const firstSnapshot = JSON.stringify(first.history[0]);
    const retested = transitionTrial(first, { type: 'set-load', loadCase: { nodeId: 'b3', fxN: 0, fyN: -1 } });
    let next = transitionTrial(retested, { type: 'new-round' });
    expect(next.phase).toBe('predicting');
    expect(next).not.toHaveProperty('currentResult');
    expect(next).not.toHaveProperty('committedTrial');
    expect(next.currentLoad.nodeId).toBe('b3');
    expect(next.history).toHaveLength(1);
    next = transitionTrial(next, { type: 'select-panel', panelId: 'panel-4' });
    next = transitionTrial(next, { type: 'commit' });
    expect(next.history).toHaveLength(2);
    expect(next.history[1]!.panelId).toBe('panel-4');
    expect(next.history[1]!.loadCase.nodeId).toBe('b3');
    expect(JSON.stringify(next.history[0])).toBe(firstSnapshot);
    expect(Object.isFrozen(next.history)).toBe(true);
  });

  it('clears current performance on an invalid retest while retaining labeled history, then recovers', () => {
    const first = committed(transitionTrial(initial(), { type: 'commit' }));
    let state = committed(transitionTrial(first, { type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: NaN } }));
    expect(state.currentResult.status).toBe('invalid');
    expect(Object.keys(state.currentResult).sort()).toEqual(['issues', 'status']);
    expect(state.history).toEqual(first.history);
    state = committed(transitionTrial(state, { type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: -1 } }));
    expect(state.currentResult.status).toBe('ok');
    expect(state.history).toEqual(first.history);
  });

  it('cannot commit an invalid draft or reveal rankings by starting a new round from an invalid retest', () => {
    const invalidDraft = transitionTrial(initial(), { type: 'set-load', loadCase: { nodeId: 'b0', fxN: 0, fyN: -1 } });
    const rejected = transitionTrial(invalidDraft, { type: 'commit' });
    expect(rejected.phase).toBe('predicting');
    expect(rejected.history).toEqual([]);
    expect(rejected).not.toHaveProperty('currentResult');
    const first = transitionTrial(initial(), { type: 'commit' });
    const invalid = transitionTrial(first, { type: 'set-load', loadCase: { nodeId: 'b0', fxN: 0, fyN: -1 } });
    const newRound = transitionTrial(invalid, { type: 'new-round' });
    expect(newRound.phase).toBe('predicting');
    expect(newRound).not.toHaveProperty('currentResult');
    expect(transitionTrial(newRound, { type: 'commit' }).history).toHaveLength(1);
  });

  it('rejects an invalid selection without changing the legal panel', () => {
    const state = transitionTrial(initial(), { type: 'select-panel', panelId: 'bad' as PanelId });
    expect(state.selectedPanelId).toBe('panel-1');
    expect(state).toMatchObject({ phase: 'predicting', issues: [{ code: 'invalid-panel' }] });
  });

  it('does not retain a live reference to a load-change action', () => {
    const load = { nodeId: 'b2', fxN: 0, fyN: -1 };
    const state = transitionTrial(initial(), { type: 'set-load', loadCase: load });
    load.nodeId = 'b3';
    expect(state.currentLoad.nodeId).toBe('b2');
    expect(Object.isFrozen(state.currentLoad)).toBe(true);
  });
});
