import type { CostResult, QuoteInputs, Reading } from './community';
import type { Retest, Trial } from './structures';

export interface ReportInputs {
  readonly trial: Trial;
  readonly retest: Retest | null;
  readonly quotes: QuoteInputs;
  readonly costs: CostResult;
  readonly readings: readonly Reading[];
  readonly assumptions: readonly string[];
}

/** Phase 5 clones and freezes this entire payload, including costs and readings. */
export interface ReportPayload extends ReportInputs {
  readonly schemaVersion: 1;
  readonly reportId: string;
  readonly createdAtIso: string;
}
