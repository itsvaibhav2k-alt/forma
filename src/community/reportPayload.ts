
import type {
  FinanceViewModel,
  ReportPayload,
} from '../shared/types';

/**
 * Creates a detached, JSON-serializable snapshot of the
 * community finance comparison.
 *
 * Does not recalculate financial results or modify
 * the original finance model.
 */
export function createReportPayload(
  model: FinanceViewModel,
): ReportPayload {
  const payload: ReportPayload = {
    schemaVersion: 1,
    generatedFor: 'community-cost-comparison',
    inputs: model.inputs,
    result: model.result,
  };

  return JSON.parse(JSON.stringify(payload)) as ReportPayload;
}
