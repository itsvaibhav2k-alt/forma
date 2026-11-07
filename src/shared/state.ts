import type { QuoteInputs, Reading } from './community';
import type { AnalysisError, Load, PanelId, RankedBraces, Retest, Trial } from './structures';

/** No rankings exist in a predicting round, even if the engine precomputes elsewhere. */
export type PredictionRound =
  | { readonly phase: 'predicting'; readonly roundId: string; readonly load: Load; readonly panelId: PanelId | null }
  | { readonly phase: 'revealed'; readonly roundId: string; readonly trialId: string }
  | { readonly phase: 'error'; readonly roundId: string; readonly load: Load; readonly panelId: PanelId | null; readonly error: AnalysisError };

export type ActiveRetest =
  | { readonly status: 'idle' }
  | { readonly status: 'ready'; readonly value: Retest }
  | { readonly status: 'error'; readonly load: Load; readonly error: AnalysisError };

export interface ExperimentState {
  readonly round: PredictionRound;
  readonly trials: readonly Trial[];
  readonly selectedTrialId: string | null;
  /** Read-only history selection; never replaces the active round or retest. */
  readonly inspectedTrialId: string | null;
  readonly retest: ActiveRetest;
}

export interface CommunityState {
  readonly quotes: QuoteInputs;
  readonly readings: readonly Reading[];
}

/** Integration implements these transitions in src/app/experiment. */
export type ExperimentEvent =
  | { readonly type: 'round/start'; readonly roundId: string; readonly load: Load }
  | { readonly type: 'prediction/select-panel'; readonly panelId: PanelId }
  | { readonly type: 'prediction/move-load'; readonly load: Load }
  | { readonly type: 'prediction/commit'; readonly roundId: string; readonly trialId: string; readonly results: RankedBraces }
  | { readonly type: 'prediction/fail'; readonly roundId: string; readonly error: AnalysisError }
  | { readonly type: 'retest/show'; readonly value: Retest }
  | { readonly type: 'retest/fail'; readonly load: Load; readonly error: AnalysisError }
  | { readonly type: 'trial/select'; readonly trialId: string }
  | { readonly type: 'trial/return' };

export type CommunityEvent =
  | { readonly type: 'quotes/replace'; readonly quotes: QuoteInputs }
  | { readonly type: 'reading/add'; readonly reading: Reading }
  | { readonly type: 'reading/remove'; readonly readingId: string };
