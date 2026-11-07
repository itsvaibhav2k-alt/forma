import type { Costs, CostValidationError, QuoteInputs } from '../../../shared';
import { snapshot } from '../../../shared/snapshot';
import { compareQuotes } from './compareQuotes';

export interface CostSnapshot {
  readonly status: 'ok';
  readonly quotes: QuoteInputs;
  readonly costs: Costs;
}

/** Phase 5 can embed this plain, serializable snapshot. Unknown amounts are valid. */
export function createCostSnapshot(quotes: QuoteInputs): CostSnapshot | CostValidationError {
  const costs = compareQuotes(quotes);
  return costs.status === 'error' ? costs : snapshot({ status: 'ok', quotes, costs });
}
