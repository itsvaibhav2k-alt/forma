import { useReducer, useState } from 'react';
import type { LoadNodeId, RankBraces } from '../../shared';
import { createBridgePreset } from '../../structures';
import { createExperimentState, DEFAULT_LOAD, experimentReducer, selectedTrial } from './state';

export function useExperiment(ranker: RankBraces) {
  const [baseline] = useState(createBridgePreset);
  const [state, dispatch] = useReducer(experimentReducer, undefined, () => createExperimentState(crypto.randomUUID()));
  function commit() {
    if (state.inspectedTrialId || state.round.phase === 'revealed' || !state.round.panelId) return;
    const results = ranker(baseline, state.round.load);
    dispatch(results.status === 'error'
      ? { type: 'prediction/fail', roundId: state.round.roundId, error: results }
      : { type: 'prediction/commit', roundId: state.round.roundId, trialId: crypto.randomUUID(), results });
  }
  function moveLoad(nodeId: LoadNodeId) {
    if (state.inspectedTrialId) return;
    const load = { ...DEFAULT_LOAD, nodeId };
    if (state.round.phase !== 'revealed') {
      dispatch({ type: 'prediction/move-load', load });
      return;
    }
    const trial = selectedTrial(state);
    if (!trial) return;
    const results = ranker(trial.results.baseline.design, load);
    dispatch(results.status === 'error'
      ? { type: 'retest/fail', load, error: results }
      : { type: 'retest/show', value: { sourceTrialId: trial.id, load, chosenPanelId: trial.chosenPanelId, results } });
  }
  return { baseline, state, dispatch, commit, moveLoad, startRound: () => dispatch({ type: 'round/start', roundId: crypto.randomUUID(), load: DEFAULT_LOAD }) };
}
