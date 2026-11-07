import {
  immutableCopy, JUDGE_PRESET,
  type CommitPrediction, type CreateTrialState, type LoadCase, type PanelId,
  type Preset, type PresetVersion, type TransitionTrial, type ValidationIssue,
} from '../shared';
import { rankBraces } from '../structures';

const presets = new Map<PresetVersion, Preset>([[JUDGE_PRESET.version, JUDGE_PRESET]]);
const unknownPreset = (version: PresetVersion): ValidationIssue => ({
  code: 'unknown-preset', message: `Unknown preset version: ${version}.`, path: 'presetVersion',
});
function validatePrediction(preset: Preset, load: LoadCase, panel: PanelId): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!preset.loadNodeIds.includes(load.nodeId) || load.fxN !== 0 || !Number.isFinite(load.fyN) || load.fyN >= 0) {
    issues.push({ code: 'invalid-load', message: 'Choose an interior deck joint and a finite positive downward load magnitude.', path: 'loadCase' });
  }
  if (!preset.design.braceOptions.some(({ panelId }) => panelId === panel)) {
    issues.push({ code: 'invalid-panel', message: 'Choose one of the four available brace panels.', path: 'panelId' });
  }
  return issues;
}

export const commitPrediction: CommitPrediction = (presetVersion, loadCase, panelId) => {
  const preset = presets.get(presetVersion);
  if (!preset) return { status: 'invalid', issues: [unknownPreset(presetVersion)] };
  const issues = validatePrediction(preset, loadCase, panelId);
  if (issues.length) return { status: 'invalid', issues };
  const result = rankBraces(preset.design, loadCase);
  if (result.status === 'invalid') return result;
  return immutableCopy({ status: 'ok', trial: { presetVersion, loadCase, panelId, originalResult: result } });
};

export const createTrialState: CreateTrialState = (presetVersion) => {
  const preset = presets.get(presetVersion);
  if (!preset) return { status: 'invalid', issues: [unknownPreset(presetVersion)] };
  return immutableCopy({
    phase: 'predicting', presetVersion, currentLoad: preset.defaultLoad,
    selectedPanelId: preset.design.braceOptions[0]!.panelId, history: [], issues: [],
  });
};

export const transitionTrial: TransitionTrial = (state, action) => {
  const preset = presets.get(state.presetVersion);
  const validate = (load: LoadCase, panel: PanelId): ValidationIssue[] => preset
    ? validatePrediction(preset, load, panel) : [unknownPreset(state.presetVersion)];
  switch (action.type) {
    case 'set-load': {
      const issues = validate(action.loadCase, state.selectedPanelId);
      if (state.phase === 'predicting') return immutableCopy({ ...state, currentLoad: action.loadCase, issues });
      return immutableCopy({
        ...state, currentLoad: action.loadCase,
        currentResult: issues.length ? { status: 'invalid', issues } : rankBraces(preset!.design, action.loadCase),
      });
    }
    case 'select-panel': {
      if (state.phase === 'committed') return state;
      const issues = validate(state.currentLoad, action.panelId);
      if (issues.some(({ code }) => code === 'invalid-panel' || code === 'unknown-preset')) return immutableCopy({ ...state, issues });
      return immutableCopy({ ...state, selectedPanelId: action.panelId, issues });
    }
    case 'commit': {
      if (state.phase === 'committed') return state;
      const result = commitPrediction(state.presetVersion, state.currentLoad, state.selectedPanelId);
      if (result.status === 'invalid') return immutableCopy({ ...state, issues: result.issues });
      return immutableCopy({
        phase: 'committed', presetVersion: state.presetVersion, currentLoad: state.currentLoad,
        selectedPanelId: state.selectedPanelId, history: [...state.history, result.trial],
        committedTrial: result.trial, currentResult: result.trial.originalResult,
      });
    }
    case 'new-round':
      return immutableCopy({
        phase: 'predicting', presetVersion: state.presetVersion, currentLoad: state.currentLoad,
        selectedPanelId: state.selectedPanelId, history: state.history,
        issues: validate(state.currentLoad, state.selectedPanelId),
      });
  }
};
