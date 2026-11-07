// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppController } from '../src/app/useAppController';
import type { CommittedState } from '../src/shared';

afterEach(cleanup);
function requireCommitted(state: ReturnType<typeof useAppController>['studio']['state']): CommittedState {
  expect(state.phase).toBe('committed');
  if (state.phase !== 'committed') throw new Error('Expected committed state');
  return state;
}

describe('React app controller with real engines (UI component integration still pending)', () => {
  it('runs commit → reveal → same-brace retest → first-result retrieval → new hidden round through actual callbacks', () => {
    const { result } = renderHook(useAppController);
    expect(result.current.studio.engineStatus).toBe('ready');
    expect(result.current.studio.state).not.toHaveProperty('currentResult');
    expect(result.current.decisionSheet.model.scenario).toBeNull();
    act(() => result.current.studio.onAction({ type: 'select-panel', panelId: 'panel-1' }));
    act(() => result.current.studio.onAction({ type: 'commit' }));
    const first = requireCommitted(result.current.studio.state);
    expect(first.currentResult).toMatchObject({ status: 'ok', bestPanelIds: ['panel-1'] });
    const firstJSON = JSON.stringify(first.history[0]);
    expect(result.current.decisionSheet.model.scenario?.result).toBe(first.currentResult);
    expect(result.current.decisionSheet.model.scenario?.label).toBe('Prediction round 1');
    act(() => result.current.studio.onAction({ type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: -1 } }));
    const retest = requireCommitted(result.current.studio.state);
    expect(retest.currentResult).toMatchObject({ status: 'ok', bestPanelIds: ['panel-2', 'panel-3'] });
    expect(retest.selectedPanelId).toBe('panel-1');
    expect(result.current.decisionSheet.model.scenario?.label).toBe('Retest of round 1');
    expect(result.current.decisionSheet.model.scenario?.loadCase.nodeId).toBe('b2');
    expect(JSON.stringify(result.current.decisionSheet.model.firstPrediction)).toBe(firstJSON);
    expect(JSON.stringify(result.current.studio.state.history[0])).toBe(firstJSON);
    act(() => result.current.studio.onAction({ type: 'new-round' }));
    expect(result.current.studio.state.phase).toBe('predicting');
    expect(result.current.studio.state).not.toHaveProperty('currentResult');
    expect(result.current.decisionSheet.model.scenario).toBeNull();
    expect(JSON.stringify(result.current.decisionSheet.model.firstPrediction)).toBe(firstJSON);
    act(() => result.current.studio.onAction({ type: 'select-panel', panelId: 'panel-3' }));
    act(() => result.current.studio.onAction({ type: 'commit' }));
    expect(result.current.studio.state.history).toHaveLength(2);
    expect(result.current.decisionSheet.model.scenario?.label).toBe('Prediction round 2');
    expect(JSON.stringify(result.current.studio.state.history[0])).toBe(firstJSON);
  });

  it('keeps all structural output and history untouched when budget, horizon or a quote changes', () => {
    const { result } = renderHook(useAppController);
    act(() => result.current.studio.onAction({ type: 'commit' }));
    const originalTrialState = result.current.studio.state;
    const originalJSON = JSON.stringify(originalTrialState);
    const originalFinance = result.current.community.model.result;
    act(() => result.current.community.onInputsChange({ ...result.current.community.model.inputs, budgetUSD: 21000 }));
    expect(result.current.studio.state).toBe(originalTrialState);
    expect(result.current.community.model.result).toMatchObject({ status: 'ok', quoteB: { fundingGap: { status: 'known', amountUSD: 0 } } });
    act(() => result.current.community.onInputsChange({ ...result.current.community.model.inputs, years: 5 }));
    expect(result.current.studio.state).toBe(originalTrialState);
    expect(result.current.community.model.result).not.toEqual(originalFinance);
    const quote = result.current.community.model.inputs.quoteB;
    act(() => result.current.community.onInputsChange({
      ...result.current.community.model.inputs,
      quoteB: { ...quote, purchase: { amountUSD: 25000, source: { kind: 'user-entered', label: 'Local price entry' } } },
    }));
    expect(result.current.studio.state).toBe(originalTrialState);
    expect(JSON.stringify(result.current.studio.state)).toBe(originalJSON);
    expect(result.current.decisionSheet.model.finance).toBe(result.current.community.model);
    expect(result.current.decisionSheet.model.scenario?.result).toBe(requireCommitted(originalTrialState).currentResult);
  });

  it('does not recalculate finances when moving the structural load', () => {
    const { result } = renderHook(useAppController);
    const originalFinance = result.current.community.model;
    act(() => result.current.studio.onAction({ type: 'commit' }));
    act(() => result.current.studio.onAction({ type: 'set-load', loadCase: { nodeId: 'b3', fxN: 0, fyN: -2 } }));
    expect(result.current.community.model).toBe(originalFinance);
  });

  it('passes invalid current performance to the report without substituting a previous result', () => {
    const { result } = renderHook(useAppController);
    act(() => result.current.studio.onAction({ type: 'commit' }));
    act(() => result.current.studio.onAction({ type: 'set-load', loadCase: { nodeId: 'b2', fxN: 0, fyN: NaN } }));
    expect(result.current.decisionSheet.model.scenario?.result.status).toBe('invalid');
    expect(result.current.decisionSheet.model.scenario?.result).not.toHaveProperty('alternatives');
    expect(result.current.decisionSheet.model.firstPrediction?.originalResult.status).toBe('ok');
    expect(result.current.decisionSheet.model.measurements).toEqual([]);
  });

  it('clears financial totals on invalid inputs without disturbing engineering outputs', () => {
    const { result } = renderHook(useAppController);
    act(() => result.current.studio.onAction({ type: 'commit' }));
    const original = result.current.studio.state;
    act(() => result.current.community.onInputsChange({ ...result.current.community.model.inputs, years: 0 }));
    expect(result.current.community.model.result.status).toBe('invalid');
    expect(result.current.community.model.result).not.toHaveProperty('quoteA');
    expect(result.current.studio.state).toBe(original);
    expect(result.current.decisionSheet.model.finance.result.status).toBe('invalid');
  });

  it('calls the browser print dialog only through the supplied callback', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    try {
      const { result } = renderHook(useAppController);
      expect(print).not.toHaveBeenCalled();
      result.current.decisionSheet.onPrint();
      expect(print).toHaveBeenCalledOnce();
    } finally { print.mockRestore(); }
  });
});
