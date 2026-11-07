import { LOAD_NODE_IDS, PANEL_IDS, PRESET_VERSION, type CommitPrediction, type ExperimentEvent, type ExperimentState, type Load, type RankedBraces, type Trial } from '../../shared';
import { snapshot } from '../../shared/snapshot';
import { SOLVER_VERSION } from '../../structures';

export const DEFAULT_LOAD: Load = Object.freeze({ nodeId: 'B1', fxN: 0, fyN: -10 });
const legalLoad = (load: Load) => LOAD_NODE_IDS.includes(load.nodeId) && load.fxN === 0 && load.fyN === -10;
const sameLoad = (a: Load, b: Load) => a.nodeId === b.nodeId && a.fxN === b.fxN && a.fyN === b.fyN;

/** Results come from the trusted solver port; verify their association before storing. */
function matches(results: RankedBraces, load: Load, presetVersion: string): boolean {
  return results.status === 'ok' && legalLoad(load) && sameLoad(results.load, load) &&
    results.baseline.design.presetVersion === presetVersion && results.baseline.analysis.solverVersion === SOLVER_VERSION &&
    PANEL_IDS.every(id => results.candidates[id].panelId === id &&
      results.candidates[id].design.presetVersion === presetVersion && results.candidates[id].analysis.solverVersion === SOLVER_VERSION);
}

export const commitPrediction: CommitPrediction = input => {
  if (!input.trialId.trim() || !input.roundId.trim() || input.presetVersion !== PRESET_VERSION ||
      !PANEL_IDS.includes(input.chosenPanelId) || !matches(input.results, input.load, input.presetVersion)) {
    throw new Error('A trial must match its active load, preset, solver and legal brace choice.');
  }
  return snapshot({
    id: input.trialId, roundId: input.roundId, presetVersion: input.presetVersion,
    solverVersion: SOLVER_VERSION, load: input.load, chosenPanelId: input.chosenPanelId, results: input.results,
  });
};

export function createExperimentState(roundId: string): ExperimentState {
  return { round: { phase: 'predicting', roundId, load: DEFAULT_LOAD, panelId: null }, trials: [], selectedTrialId: null, retest: { status: 'idle' } };
}

export function selectedTrial(state: ExperimentState): Trial | undefined {
  return state.trials.find(trial => trial.id === state.selectedTrialId);
}

export function experimentReducer(state: ExperimentState, event: ExperimentEvent): ExperimentState {
  const { round } = state;
  switch (event.type) {
    case 'round/start':
      if (!event.roundId.trim() || event.roundId === round.roundId || state.trials.some(trial => trial.roundId === event.roundId) || !legalLoad(event.load)) return state;
      return { ...state, round: { phase: 'predicting', roundId: event.roundId, load: snapshot(event.load), panelId: null }, selectedTrialId: null, retest: { status: 'idle' } };
    case 'prediction/select-panel':
      if (round.phase === 'revealed' || !PANEL_IDS.includes(event.panelId)) return state;
      return { ...state, round: { phase: 'predicting', roundId: round.roundId, load: round.load, panelId: event.panelId } };
    case 'prediction/move-load':
      if (round.phase === 'revealed' || !legalLoad(event.load)) return state;
      return { ...state, round: { phase: 'predicting', roundId: round.roundId, load: snapshot(event.load), panelId: round.panelId } };
    case 'prediction/commit': {
      if (round.phase === 'revealed' || event.roundId !== round.roundId || !round.panelId || !event.trialId.trim() ||
          state.trials.some(trial => trial.id === event.trialId || trial.roundId === round.roundId) || !matches(event.results, round.load, PRESET_VERSION)) return state;
      const trial = commitPrediction({ trialId: event.trialId, roundId: round.roundId, presetVersion: PRESET_VERSION, load: round.load, chosenPanelId: round.panelId, results: event.results });
      return { round: { phase: 'revealed', roundId: round.roundId, trialId: trial.id }, trials: [...state.trials, trial], selectedTrialId: trial.id, retest: { status: 'idle' } };
    }
    case 'prediction/fail':
      if (round.phase === 'revealed' || event.roundId !== round.roundId) return state;
      return { ...state, round: { phase: 'error', roundId: round.roundId, load: round.load, panelId: round.panelId, error: snapshot(event.error) }, retest: { status: 'idle' } };
    case 'retest/show': {
      const trial = selectedTrial(state);
      const value = event.value;
      if (round.phase !== 'revealed' || !trial || round.trialId !== trial.id || value.sourceTrialId !== trial.id ||
          value.chosenPanelId !== trial.chosenPanelId || !matches(value.results, value.load, trial.presetVersion)) return state;
      return { ...state, retest: { status: 'ready', value: snapshot(value) } };
    }
    case 'retest/fail':
      if (round.phase !== 'revealed' || !selectedTrial(state) || !legalLoad(event.load)) return state;
      return { ...state, retest: { status: 'error', load: snapshot(event.load), error: snapshot(event.error) } };
    case 'trial/select': {
      const trial = state.trials.find(item => item.id === event.trialId);
      if (!trial) return state;
      return { ...state, round: { phase: 'revealed', roundId: trial.roundId, trialId: trial.id }, selectedTrialId: trial.id, retest: { status: 'idle' } };
    }
  }
}

/** A failed active scenario exposes no previous analysis, even with saved history. */
export function experimentDisplay(state: ExperimentState) {
  const trial = selectedTrial(state);
  if (state.round.phase !== 'revealed') return {
    load: state.round.load, panelId: state.round.panelId, results: null,
    error: state.round.phase === 'error' ? state.round.error : null, trial: undefined,
  };
  if (!trial) throw new Error('A revealed round must reference a stored trial.');
  return {
    load: state.retest.status === 'ready' ? state.retest.value.load : state.retest.status === 'error' ? state.retest.load : trial.load,
    panelId: trial.chosenPanelId,
    results: state.retest.status === 'ready' ? state.retest.value.results : state.retest.status === 'error' ? null : trial.results,
    error: state.retest.status === 'error' ? state.retest.error : null, trial,
  };
}
