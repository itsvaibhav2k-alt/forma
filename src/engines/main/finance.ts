import type { Amount, BreakEven, CompareQuotes, FinanceSuccess, PriceInput, Quote, QuoteSummary, ValidationIssue } from './types';

const PRICE_KEYS = ['purchase', 'delivery', 'installation', 'donation', 'annualUpkeep'] as const;
const SOURCE_KINDS = ['quoted', 'user-entered', 'demonstration', 'unknown'];
const textPresent = (value: string): boolean => typeof value === 'string' && value.trim().length > 0;
const known = (amountUSD: number): Amount => ({ status: 'known', amountUSD });
const price = (input: PriceInput, path: string): Amount => input.amountUSD === null
  ? { status: 'unknown', missingFields: [path] } : known(input.amountUSD);

function combine(values: readonly Amount[], calculate: (values: readonly number[]) => number): Amount {
  const missingFields = [...new Set(values.flatMap((value) => value.status === 'unknown' ? value.missingFields : []))];
  if (missingFields.length) return { status: 'unknown', missingFields };
  return known(calculate(values.map((value) => value.status === 'known' ? value.amountUSD : 0)));
}

function summarize(quote: Quote, path: string, budget: number, annuityFactor: number): QuoteSummary {
  const grossUpfront = combine([
    price(quote.purchase, `${path}.purchase`), price(quote.delivery, `${path}.delivery`), price(quote.installation, `${path}.installation`),
  ], (values) => values.reduce((sum, value) => sum + value, 0));
  const donationApplied = combine([grossUpfront, price(quote.donation, `${path}.donation`)], ([gross, donation]) => Math.min(gross!, donation!));
  const upfront = combine([grossUpfront, donationApplied], ([gross, donation]) => Math.max(0, gross! - donation!));
  const fundingGap = combine([upfront], ([cost]) => Math.max(0, cost! - budget));
  const annualUpkeep = price(quote.annualUpkeep, `${path}.annualUpkeep`);
  const discountedTotal = combine([upfront, annualUpkeep], ([cost, upkeep]) => cost! + upkeep! * annuityFactor);
  return { quoteId: quote.id, grossUpfront, donationApplied, upfront, fundingGap, annualUpkeep, discountedTotal };
}

export const compareQuotes: CompareQuotes = (quoteA, quoteB, budget, years, rate) => {
  const issues: ValidationIssue[] = [];
  const add = (code: ValidationIssue['code'], message: string, path: string) => { issues.push({ code, message, path }); };
  if (!Number.isFinite(budget) || budget < 0) add('invalid-budget', 'Budget must be a finite nonnegative USD amount.', 'budget');
  if (!Number.isFinite(years) || !Number.isInteger(years) || years <= 0) add('invalid-horizon', 'Choose a positive whole number of years.', 'years');
  if (!Number.isFinite(rate) || rate < 0) add('invalid-rate', 'Rate must be a finite nonnegative real decimal (0.03 = 3%).', 'rate');
  for (const [path, quote] of [['quoteA', quoteA], ['quoteB', quoteB]] as const) {
    if (!textPresent(quote.id) || !textPresent(quote.label) || !textPresent(quote.scopeId) || !textPresent(quote.scopeLabel)) {
      add('invalid-quote', 'Quotes need nonempty IDs, labels, and equal-scope descriptions.', path);
    }
    for (const key of PRICE_KEYS) {
      const input = quote[key];
      if (input.amountUSD !== null && (!Number.isFinite(input.amountUSD) || input.amountUSD < 0)) {
        add('invalid-quote', 'Enter a finite nonnegative USD amount, or leave it unknown.', `${path}.${key}`);
      }
      if (!SOURCE_KINDS.includes(input.source.kind) || !textPresent(input.source.label)) add('invalid-quote', 'Each price needs a source kind and label.', `${path}.${key}.source`);
    }
  }
  if (quoteA.id === quoteB.id) add('invalid-quote', 'The two packages must have distinct IDs.', 'quoteB.id');
  if (quoteA.scopeId !== quoteB.scopeId) add('invalid-quote', 'Compare packages with matching scope and service level.', 'quoteB.scopeId');
  if (issues.length) return { status: 'invalid', issues };
  // log1p/expm1 retain accuracy when the discount rate is close to zero.
  const annuityFactor = rate === 0 ? years : -Math.expm1(-years * Math.log1p(rate)) / rate;
  const a = summarize(quoteA, 'quoteA', budget, annuityFactor);
  const b = summarize(quoteB, 'quoteB', budget, annuityFactor);
  let breakEven: BreakEven;
  if (a.upfront.status === 'unknown' || b.upfront.status === 'unknown') {
    breakEven = { status: 'unknown', missingFields: [...new Set([
      ...(a.upfront.status === 'unknown' ? a.upfront.missingFields : []),
      ...(b.upfront.status === 'unknown' ? b.upfront.missingFields : []),
    ])] };
  } else {
    const premiumUSD = Math.abs(a.upfront.amountUSD - b.upfront.amountUSD);
    breakEven = premiumUSD === 0 ? { status: 'equal-upfront', premiumUSD: 0, annualSavingsRequiredUSD: 0 } : {
      status: 'premium',
      higherUpfrontQuoteId: a.upfront.amountUSD > b.upfront.amountUSD ? quoteA.id : quoteB.id,
      lowerUpfrontQuoteId: a.upfront.amountUSD > b.upfront.amountUSD ? quoteB.id : quoteA.id,
      premiumUSD, annualSavingsRequiredUSD: premiumUSD / annuityFactor,
    };
  }
  const output: FinanceSuccess = { status: 'ok', annuityFactor, quoteA: a, quoteB: b, breakEven };
  const values = [annuityFactor, ...[a, b].flatMap((summary) =>
    [summary.grossUpfront, summary.donationApplied, summary.upfront, summary.fundingGap, summary.annualUpkeep, summary.discountedTotal]
      .flatMap((amount) => amount.status === 'known' ? [amount.amountUSD] : [])),
  ...(breakEven.status === 'premium' ? [breakEven.premiumUSD, breakEven.annualSavingsRequiredUSD] : [])];
  if (annuityFactor <= 0 || values.some((value) => !Number.isFinite(value))) return {
    status: 'invalid', issues: [{ code: 'numerical-failure', message: 'Financial inputs exceed reliable numerical range.', path: 'finance' }],
  };
  return output;
};
