import type { Load, Retest } from '../shared';
import { createBridgePreset, rankBraces } from '../structures';
import { commitPrediction, DEFAULT_LOAD } from '../app/experiment/state';

/** Production snapshots for association tests; numerical expected values remain independent. */
export function physicalCases() {
  const baseline = createBridgePreset();
  const results = rankBraces(baseline, DEFAULT_LOAD);
  if (results.status !== 'ok') throw new Error(results.message);
  const trial = commitPrediction({ trialId: 'physical-trial', roundId: 'physical-round', presetVersion: baseline.presetVersion, load: DEFAULT_LOAD, chosenPanelId: 'P2', results });
  const load: Load = { ...DEFAULT_LOAD, nodeId: 'B2' };
  const retested = rankBraces(baseline, load);
  if (retested.status !== 'ok') throw new Error(retested.message);
  const retest: Retest = { sourceTrialId: trial.id, chosenPanelId: trial.chosenPanelId, load, results: retested };
  return { trial, retest };
}
