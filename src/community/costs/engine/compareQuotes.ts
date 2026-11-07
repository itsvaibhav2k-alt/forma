import type { AmountInput, BreakEven, CalculatedAmount, CompareQuotes, CostValidationError, MissingCostInput, PackageCosts, QuoteInputs, QuotePackage } from '../../../shared';
import { compareQuotes as mainCompareQuotes } from '../../../engines/main/finance';
import type { Amount, InvalidResult, PriceInput, Quote, QuoteSummary } from '../../../engines/main/types';
import { arithmeticTolerance, validateQuoteInputs } from './validation';

const APP_FIELD = { purchase: 'materials', delivery: 'freight', installation: 'installation', donation: 'cashContribution', annualUpkeep: 'annualUpkeep' } as const;
const SOURCE = { 'supplier-quote': 'quoted', 'user-estimate': 'user-entered', 'demo-assumption': 'demonstration' } as const;
function price(input: AmountInput): PriceInput {
  return input.status === 'unknown'
    ? { amountUSD: null, source: { kind: 'unknown', label: input.note.trim() || 'No amount entered' } }
    : { amountUSD: input.usd, source: { kind: SOURCE[input.source.kind], label: input.source.label } };
}
export function toEngineQuote(pkg: QuotePackage): Quote {
  return { id: pkg.id, label: pkg.label, scopeId: pkg.scope.trim(), scopeLabel: pkg.scope,
    purchase: price(pkg.materials), delivery: price(pkg.freight), installation: price(pkg.installation),
    donation: price(pkg.cashContribution), annualUpkeep: price(pkg.annualUpkeep) };
}
function missingFields(paths: readonly string[], inputs: QuoteInputs): MissingCostInput[] {
  return paths.map(path => {
    const [quote, key] = path.split('.');
    const field = APP_FIELD[key as keyof typeof APP_FIELD];
    if (!field || (quote !== 'quoteA' && quote !== 'quoteB')) throw new Error(`Unknown main-engine amount path: ${path}`);
    return { packageId: inputs.packages[quote === 'quoteA' ? 0 : 1].id, field };
  });
}
function amount(value: Amount, inputs: QuoteInputs): CalculatedAmount {
  return value.status === 'known' ? { status: 'known', usd: value.amountUSD }
    : { status: 'unknown', missing: missingFields(value.missingFields, inputs) };
}
function failure(result: InvalidResult, inputs: QuoteInputs): CostValidationError {
  return { status: 'error', issues: result.issues.map(issue => {
    const [root, key, ...rest] = issue.path.split('.');
    if (root === 'quoteA' || root === 'quoteB') {
      const field = APP_FIELD[key as keyof typeof APP_FIELD] ?? key ?? 'packages';
      return { packageId: inputs.packages[root === 'quoteA' ? 0 : 1].id, field: [field, ...rest].join('.'), message: issue.message };
    }
    return { field: root === 'budget' ? 'budgetUsd' : root === 'rate' ? 'realRate' : root === 'years' ? 'years' : 'calculation', message: issue.message };
  }) };
}

/** Main owns upfront costs, contribution capping, annuity, totals and break-even. */
export const compareQuotes: CompareQuotes = inputs => {
  const invalid = validateQuoteInputs(inputs);
  if (invalid) return invalid;
  const result = mainCompareQuotes(toEngineQuote(inputs.packages[0]), toEngineQuote(inputs.packages[1]), inputs.budgetUsd, inputs.years, inputs.realRate);
  if (result.status === 'invalid') return failure(result, inputs);
  const summaries = [result.quoteA, result.quoteB] as const;
  const packageCosts = (summary: QuoteSummary): PackageCosts => ({ packageId: summary.quoteId, upfront: amount(summary.upfront, inputs), fundingGap: amount(summary.fundingGap, inputs), presentCost: amount(summary.discountedTotal, inputs) });
  const packages = [packageCosts(result.quoteA), packageCosts(result.quoteB)] as const;
  let breakEven: BreakEven;
  const value = result.breakEven;
  if (value.status === 'unknown') breakEven = { status: 'unknown', missing: missingFields(value.missingFields, inputs) };
  else if (value.status === 'equal-upfront') breakEven = { status: 'equal-upfront', requiredAnnualSavingsUsd: 0 };
  else {
    // The existing view also shows expected savings; derive it from main's
    // returned upkeep amounts, without recomputing totals or the threshold.
    const higher = summaries.find(summary => summary.quoteId === value.higherUpfrontQuoteId)!;
    const lower = summaries.find(summary => summary.quoteId === value.lowerUpfrontQuoteId)!;
    const absent = [lower.annualUpkeep, higher.annualUpkeep].flatMap(upkeep => upkeep.status === 'unknown' ? upkeep.missingFields : []);
    const expectedAnnualSavings: CalculatedAmount = lower.annualUpkeep.status === 'known' && higher.annualUpkeep.status === 'known'
      ? { status: 'known', usd: lower.annualUpkeep.amountUSD - higher.annualUpkeep.amountUSD }
      : { status: 'unknown', missing: missingFields(absent, inputs) };
    breakEven = { status: 'premium', higherUpfrontPackageId: value.higherUpfrontQuoteId, upfrontPremiumUsd: value.premiumUSD, requiredAnnualSavingsUsd: value.annualSavingsRequiredUSD, expectedAnnualSavings };
  }
  return { status: 'ok', annuityFactor: result.annuityFactor, packages, breakEven };
};
export function assessSavings(value: BreakEven): 'above' | 'at' | 'below' | 'unknown' | 'equal-upfront' {
  if (value.status !== 'premium') return value.status;
  if (value.expectedAnnualSavings.status === 'unknown') return 'unknown';
  const difference = value.expectedAnnualSavings.usd - value.requiredAnnualSavingsUsd;
  if (Math.abs(difference) <= arithmeticTolerance(value.expectedAnnualSavings.usd, value.requiredAnnualSavingsUsd)) return 'at';
  return difference > 0 ? 'above' : 'below';
}
