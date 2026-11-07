import type { AmountInput, AmountSource, CostField, QuoteInputs, QuotePackage } from '../../shared';
import { COST_FIELDS } from './engine/validation';

export interface AmountDraft {
  readonly raw: string;
  readonly sourceKind: AmountSource['kind'];
  readonly sourceLabel: string;
}
export interface PackageDraft {
  readonly id: string;
  readonly label: string;
  readonly amounts: Readonly<Record<CostField, AmountDraft>>;
  readonly donationNote: string;
}
export interface QuoteDraft {
  readonly packages: readonly [PackageDraft, PackageDraft];
  readonly scope: string;
  readonly budget: string;
  readonly years: string;
  readonly ratePercent: string;
}

export function blankQuoteDraft(): QuoteDraft {
  const makePackage = (suffix: 'a' | 'b'): PackageDraft => ({
    id: `package-${suffix}`, label: `Package ${suffix.toUpperCase()}`, donationNote: '',
    amounts: Object.fromEntries(COST_FIELDS.map(field => [field, { raw: '', sourceKind: 'user-estimate', sourceLabel: 'User entry' }])) as Record<CostField, AmountDraft>,
  });
  return { packages: [makePackage('a'), makePackage('b')], scope: '', budget: '20000', years: '10', ratePercent: '3' };
}

/** Example inputs only: calculated totals always come from compareQuotes. */
export function fictionalQuoteDraft(): QuoteDraft {
  const initial = blankQuoteDraft();
  const values = [[12000, 1000, 6000, 0, 900], [14000, 4000, 3000, 0, 450]];
  return {
    ...initial, scope: 'Fictional equal-scope material package; same service for the full horizon',
    packages: initial.packages.map((pkg, index) => ({
      ...pkg, label: `Package ${index === 0 ? 'A' : 'B'} (fictional)`,
      amounts: Object.fromEntries(COST_FIELDS.map((field, i) => [field, { raw: String(values[index]![i]), sourceKind: 'demo-assumption', sourceLabel: 'Fictional example from the Forma specification' }])) as Record<CostField, AmountDraft>,
    })) as unknown as QuoteDraft['packages'],
  };
}

/** Keep malformed/incomplete input distinct from a genuinely blank amount. */
export function parseNumber(raw: string): number {
  const value = raw.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? Number(value) : NaN;
}

export function quoteInputsFromDraft(draft: QuoteDraft): QuoteInputs {
  const amount = (value: AmountDraft): AmountInput => value.raw.trim() === ''
    ? { status: 'unknown', note: 'No amount entered' }
    : { status: 'known', usd: parseNumber(value.raw), source: { kind: value.sourceKind, label: value.sourceLabel.trim() } };
  const pkg = (value: PackageDraft): QuotePackage => ({
    id: value.id, label: value.label.trim(), scope: draft.scope.trim(), donationNote: value.donationNote,
    materials: amount(value.amounts.materials), freight: amount(value.amounts.freight), installation: amount(value.amounts.installation),
    cashContribution: amount(value.amounts.cashContribution), annualUpkeep: amount(value.amounts.annualUpkeep),
  });
  const rate = parseNumber(draft.ratePercent);
  return {
    packages: [pkg(draft.packages[0]), pkg(draft.packages[1])], budgetUsd: parseNumber(draft.budget), years: parseNumber(draft.years),
    realRate: rate !== 0 && rate / 100 === 0 ? NaN : rate / 100,
  };
}

export function editAmount(draft: AmountDraft, raw: string): AmountDraft {
  // An edited example is no longer the original demonstration assumption.
  return draft.sourceKind === 'demo-assumption' && raw !== draft.raw
    ? { raw, sourceKind: 'user-estimate', sourceLabel: 'User estimate edited from the fictional example' }
    : { ...draft, raw };
}
