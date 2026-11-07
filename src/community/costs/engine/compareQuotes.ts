import type { BreakEven, CalculatedAmount, CompareQuotes, CostField, Costs, PackageCosts, QuotePackage } from '../../../shared';
import { arithmeticTolerance, validateQuoteInputs } from './validation';

const known = (usd: number): CalculatedAmount => ({ status: 'known', usd });
const missing = (pkg: QuotePackage, fields: readonly CostField[]) => fields.filter(field => pkg[field].status === 'unknown').map(field => ({ packageId: pkg.id, field }));
const usd = (pkg: QuotePackage, field: CostField) => {
  const amount = pkg[field];
  if (amount.status !== 'known') throw new Error('Resolve missing dependencies before calculating.');
  return amount.usd;
};
const UPFRONT_FIELDS = ['materials', 'freight', 'installation', 'cashContribution'] as const;

/** Constant, real, year-end cash flows; no display rounding enters the calculation. */
export const compareQuotes: CompareQuotes = inputs => {
  const invalid = validateQuoteInputs(inputs);
  if (invalid) return invalid;
  const { years, realRate, budgetUsd } = inputs;
  // log1p/expm1 avoid cancellation at tiny positive rates; zero has its exact limit.
  const annuityFactor = realRate === 0 ? years : -Math.expm1(-years * Math.log1p(realRate)) / realRate;
  const calculate = (pkg: QuotePackage): PackageCosts => {
    const absent = missing(pkg, UPFRONT_FIELDS);
    const upfront: CalculatedAmount = absent.length ? { status: 'unknown', missing: absent }
      : known(Math.max(0, usd(pkg, 'materials') + usd(pkg, 'freight') + usd(pkg, 'installation') - usd(pkg, 'cashContribution')));
    const presentMissing = [...absent, ...missing(pkg, ['annualUpkeep'])];
    return {
      packageId: pkg.id, upfront,
      fundingGap: upfront.status === 'known' ? known(Math.max(0, upfront.usd - budgetUsd)) : upfront,
      presentCost: presentMissing.length ? { status: 'unknown', missing: presentMissing }
        : known((upfront as Extract<CalculatedAmount, { status: 'known' }>).usd + usd(pkg, 'annualUpkeep') * annuityFactor),
    };
  };
  const packages = [calculate(inputs.packages[0]), calculate(inputs.packages[1])] as const;
  const [a, b] = packages;
  let breakEven: BreakEven;
  if (a.upfront.status === 'unknown' || b.upfront.status === 'unknown') {
    breakEven = { status: 'unknown', missing: [...(a.upfront.status === 'unknown' ? a.upfront.missing : []), ...(b.upfront.status === 'unknown' ? b.upfront.missing : [])] };
  } else if (Math.abs(a.upfront.usd - b.upfront.usd) <= arithmeticTolerance(a.upfront.usd, b.upfront.usd)) {
    breakEven = { status: 'equal-upfront', requiredAnnualSavingsUsd: 0 };
  } else {
    const higherIndex = a.upfront.usd > b.upfront.usd ? 0 : 1;
    const higher = inputs.packages[higherIndex];
    const lower = inputs.packages[higherIndex === 0 ? 1 : 0];
    const upfrontPremiumUsd = Math.abs(a.upfront.usd - b.upfront.usd);
    const absent = [...missing(lower, ['annualUpkeep']), ...missing(higher, ['annualUpkeep'])];
    breakEven = {
      status: 'premium', higherUpfrontPackageId: higher.id, upfrontPremiumUsd,
      requiredAnnualSavingsUsd: upfrontPremiumUsd / annuityFactor,
      expectedAnnualSavings: absent.length ? { status: 'unknown', missing: absent } : known(usd(lower, 'annualUpkeep') - usd(higher, 'annualUpkeep')),
    };
  }
  const amounts = packages.flatMap(pkg => [pkg.upfront, pkg.fundingGap, pkg.presentCost]).flatMap(amount => amount.status === 'known' ? [amount.usd] : []);
  if (breakEven.status === 'premium') {
    amounts.push(breakEven.upfrontPremiumUsd, breakEven.requiredAnnualSavingsUsd);
    if (breakEven.expectedAnnualSavings.status === 'known') amounts.push(breakEven.expectedAnnualSavings.usd);
  }
  if (!Number.isFinite(annuityFactor) || annuityFactor <= 0 || amounts.some(value => !Number.isFinite(value))) {
    return { status: 'error', issues: [{ field: 'calculation', message: 'These inputs exceed the supported numerical range. Reduce the amounts, horizon or rate.' }] };
  }
  return { status: 'ok', annuityFactor, packages, breakEven } satisfies Costs;
};

export function assessSavings(value: BreakEven): 'above' | 'at' | 'below' | 'unknown' | 'equal-upfront' {
  if (value.status !== 'premium') return value.status;
  if (value.expectedAnnualSavings.status === 'unknown') return 'unknown';
  const difference = value.expectedAnnualSavings.usd - value.requiredAnnualSavingsUsd;
  if (Math.abs(difference) <= arithmeticTolerance(value.expectedAnnualSavings.usd, value.requiredAnnualSavingsUsd)) return 'at';
  return difference > 0 ? 'above' : 'below';
}
