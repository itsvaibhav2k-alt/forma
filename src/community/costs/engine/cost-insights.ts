import type { AmountInput, CalculatedAmount, Costs, QuoteInputs } from '../../../shared';
import { arithmeticTolerance } from './validation';

export type CostComparison =
  | { readonly status: 'unknown'; readonly missingPackageLabels: readonly string[] }
  | { readonly status: 'equal' }
  | { readonly status: 'lower'; readonly lowerPackageId: string; readonly lowerLabel: string; readonly higherLabel: string; readonly differenceUsd: number };

type Amount = AmountInput | CalculatedAmount | undefined;
function compare(inputs: QuoteInputs, amounts: readonly [Amount, Amount]): CostComparison {
  const missing = inputs.packages.filter((_pkg, index) => {
    const amount = amounts[index];
    return !amount || amount.status !== 'known' || !Number.isFinite(amount.usd);
  });
  if (missing.length) return { status: 'unknown', missingPackageLabels: missing.map(pkg => pkg.label) };
  const first = amounts[0], second = amounts[1];
  if (first?.status !== 'known' || second?.status !== 'known') throw new Error('Known comparison amounts required.');
  const difference = first.usd - second.usd;
  if (Math.abs(difference) <= arithmeticTolerance(first.usd, second.usd)) return { status: 'equal' };
  const lower = inputs.packages[difference < 0 ? 0 : 1], higher = inputs.packages[difference < 0 ? 1 : 0];
  return { status: 'lower', lowerPackageId: lower.id, lowerLabel: lower.label, higherLabel: higher.label, differenceUsd: Math.abs(difference) };
}

/** Explain existing outputs without recalculating totals or treating missing prices as zero. */
export function costInsights(inputs: QuoteInputs, costs: Costs) {
  return {
    annualUpkeep: compare(inputs, [inputs.packages[0].annualUpkeep, inputs.packages[1].annualUpkeep]),
    discountedTotal: compare(inputs, [
      costs.packages.find(pkg => pkg.packageId === inputs.packages[0].id)?.presentCost,
      costs.packages.find(pkg => pkg.packageId === inputs.packages[1].id)?.presentCost,
    ]),
  };
}
