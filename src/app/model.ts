import {
  DEFAULT_ASSUMPTIONS, DEMO_FINANCE_INPUTS, JUDGE_PRESET, immutableCopy,
  type DecisionSheetModel, type FinanceInputs, type FinanceResult, type MeasurementRecord,
  type TrialAction, type TrialState,
} from '../shared';
import { compareQuotes } from '../community/finance';
import { createTrialState, transitionTrial } from '../trials';

export interface AppState {
  readonly trial: TrialState;
  readonly finance: { readonly inputs: FinanceInputs; readonly result: FinanceResult };
  readonly measurements: readonly MeasurementRecord[];
  readonly deformationScale: number;
}
export type AppAction =
  | { readonly type: 'trial'; readonly action: TrialAction }
  | { readonly type: 'finance'; readonly inputs: FinanceInputs };

function financialModel(inputs: FinanceInputs): AppState['finance'] {
  return immutableCopy({
    inputs,
    result: compareQuotes(inputs.quoteA, inputs.quoteB, inputs.budgetUSD, inputs.years, inputs.rate),
  });
}

export function createAppState(): AppState {
  const trial = createTrialState(JUDGE_PRESET.version);
  if (!('phase' in trial)) throw new Error('The built-in judge preset is unavailable.');
  return Object.freeze({
    trial, finance: financialModel(DEMO_FINANCE_INPUTS),
    measurements: Object.freeze([]), deformationScale: 100,
  });
}

/** Independent update branches guarantee quote edits never invoke or replace structural results. */
export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'trial':
      return Object.freeze({ ...state, trial: transitionTrial(state.trial, action.action) });
    case 'finance':
      return Object.freeze({ ...state, finance: financialModel(action.inputs) });
  }
}

export function decisionSheetModel(state: AppState): DecisionSheetModel {
  const { trial } = state;
  const originalLoad = trial.phase === 'committed' ? trial.committedTrial.loadCase : null;
  const isRetest = originalLoad !== null && (
    originalLoad.nodeId !== trial.currentLoad.nodeId || originalLoad.fxN !== trial.currentLoad.fxN || originalLoad.fyN !== trial.currentLoad.fyN
  );
  return {
    title: 'Forma — one-brace decision sheet',
    scenario: trial.phase === 'committed' ? {
      label: `${isRetest ? 'Retest of' : 'Prediction'} round ${trial.history.length}`,
      presetVersion: trial.presetVersion, loadCase: trial.currentLoad,
      panelId: trial.committedTrial.panelId, result: trial.currentResult,
    } : null,
    firstPrediction: trial.history[0] ?? null,
    measurements: state.measurements, finance: state.finance,
    deformationScale: state.deformationScale, assumptions: DEFAULT_ASSUMPTIONS,
  };
}
