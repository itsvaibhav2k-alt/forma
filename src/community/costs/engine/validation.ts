import type { CostField, CostValidationError } from '../../../shared';

export const COST_FIELDS = ['materials', 'freight', 'installation', 'cashContribution', 'annualUpkeep'] as const satisfies readonly CostField[];
export const SOURCE_KINDS = ['supplier-quote', 'user-estimate', 'demo-assumption'] as const;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** Only absorbs binary floating-point noise, never currency/display rounding. */
export const arithmeticTolerance = (...values: number[]) => 8 * Number.EPSILON * Math.max(1, ...values.map(Math.abs));

export function validateQuoteInputs(input: unknown): CostValidationError | null {
  const issues: { field: string; message: string; packageId?: string }[] = [];
  if (!record(input)) return { status: 'error', issues: [{ field: 'inputs', message: 'Provide two packages and comparison settings.' }] };
  if (!nonnegative(input.budgetUsd)) issues.push({ field: 'budgetUsd', message: 'Enter a finite, nonnegative upfront budget.' });
  if (typeof input.years !== 'number' || !Number.isSafeInteger(input.years) || input.years <= 0) issues.push({ field: 'years', message: 'Enter a positive whole number of years within the safe integer range.' });
  if (!nonnegative(input.realRate)) issues.push({ field: 'realRate', message: 'Enter a finite, nonnegative real discount rate.' });
  if (!Array.isArray(input.packages) || input.packages.length !== 2) {
    issues.push({ field: 'packages', message: 'Compare exactly two packages.' });
    return { status: 'error', issues };
  }
  const ids = new Set<string>();
  const scopes: string[] = [];
  for (const item of input.packages) {
    if (!record(item)) { issues.push({ field: 'packages', message: 'Each package must be an object.' }); continue; }
    const packageId = typeof item.id === 'string' ? item.id : '';
    const issue = (field: string, message: string) => issues.push({ field, message, packageId });
    if (!text(item.id) || ids.has(item.id)) issue('id', 'Package IDs must be nonempty and unique.');
    else ids.add(item.id);
    if (!text(item.label)) issue('label', 'Enter a package name.');
    if (!text(item.scope)) issue('scope', 'Describe the common scope and level of service.');
    else scopes.push(item.scope.trim());
    if (typeof item.donationNote !== 'string') issue('donationNote', 'Donation notes must be text.');
    const known = new Map<string, number>();
    for (const field of COST_FIELDS) {
      const amount = item[field];
      if (!record(amount)) { issue(field, 'Enter an amount or explicitly mark it unknown.'); continue; }
      if (amount.status === 'unknown') {
        if (typeof amount.note !== 'string') issue(field, 'An unknown amount needs a text note.');
      } else if (amount.status === 'known') {
        if (!nonnegative(amount.usd)) issue(field, 'Enter a finite, nonnegative USD amount, or leave it blank for unknown.');
        else known.set(field, amount.usd);
        if (!record(amount.source) || !(SOURCE_KINDS as readonly unknown[]).includes(amount.source.kind) || !text(amount.source.label)) {
          issue(`${field}.source`, 'Choose a source type and enter its reference or estimate basis.');
        }
      } else issue(field, 'Amount status must be known or unknown.');
    }
    if (['materials', 'freight', 'installation'].every(field => known.has(field))) {
      const initial = known.get('materials')! + known.get('freight')! + known.get('installation')!;
      if (!Number.isFinite(initial)) issue('materials', 'Combined initial costs exceed the supported numerical range.');
      else if (known.has('cashContribution') && known.get('cashContribution')! - initial > arithmeticTolerance(initial, known.get('cashContribution')!)) {
        issue('cashContribution', 'Cash contributions cannot exceed materials, freight and installation combined.');
      }
    }
  }
  if (scopes.length === 2 && scopes[0] !== scopes[1]) issues.push({ field: 'scope', message: 'Use one common scope and level-of-service description for both packages.' });
  return issues.length ? { status: 'error', issues } : null;
}
