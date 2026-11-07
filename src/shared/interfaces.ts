import type { CostResult, QuoteInputs } from './community';
import type { ReportInputs, ReportPayload } from './report';
import type { AnalysisResult, Design, Load, LoadCase, PanelId, RankedBraces, RankingResult, Trial } from './structures';

export type Analyze = (design: Design, load: LoadCase) => AnalysisResult;
export type RankBraces = (baseline: Design, load: Load) => RankingResult;
export type CompareQuotes = (inputs: QuoteInputs) => CostResult;

/** Explicit result injection keeps snapshot creation pure; reducer enforces one commit per round. */
export interface CommitPredictionInput {
  readonly trialId: string;
  readonly roundId: string;
  readonly presetVersion: string;
  readonly load: Load;
  readonly chosenPanelId: PanelId;
  readonly results: RankedBraces;
}

export type CommitPrediction = (input: CommitPredictionInput) => Trial;
export type BuildDecisionSheet = (inputs: ReportInputs, reportId: string, createdAtIso: string) => ReportPayload;
