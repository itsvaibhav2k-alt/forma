import { useReducer } from 'react';
import { JUDGE_PRESET, type BridgeStudioProps, type CompareBuildOptionsProps, type DecisionSheetProps } from '../shared';
import { createAppState, decisionSheetModel, reduceAppState } from './model';

/** Ready-to-wire props for Claude's three components; no duplicate presentation calculations. */
export function useAppController(): {
  readonly studio: BridgeStudioProps;
  readonly community: CompareBuildOptionsProps;
  readonly decisionSheet: DecisionSheetProps;
} {
  const [state, dispatch] = useReducer(reduceAppState, undefined, createAppState);
  return {
    studio: {
      preset: JUDGE_PRESET, state: state.trial, engineStatus: 'ready',
      deformationScale: state.deformationScale,
      onAction: (action) => dispatch({ type: 'trial', action }),
    },
    community: {
      model: state.finance,
      onInputsChange: (inputs) => dispatch({ type: 'finance', inputs }),
    },
    decisionSheet: {
      model: decisionSheetModel(state),
      onPrint: () => window.print(),
    },
  };
}
