import { describe, expect, it } from 'vitest';
import type { AmountInput, CalculatedAmount, Costs, QuoteInputs, QuotePackage } from '../../../shared';
import { quotesFixture } from '../../../shared/fixtures/quotes';
import { compareQuotes, assessSavings } from './compareQuotes';
import { createCostSnapshot } from './snapshot';
import { COST_FIELDS, validateQuoteInputs } from './validation';

const known = (usd: number): AmountInput => ({ status: 'known', usd, source: { kind: 'user-estimate', label: 'Test estimate' } });
const unknown: AmountInput = { status: 'unknown', note: 'No estimate entered' };
const base = quotesFixture.inputs;
function change(index: 0 | 1, patch: Partial<QuotePackage>, inputs: QuoteInputs = base): QuoteInputs {
  return { ...inputs, packages: index === 0 ? [{ ...inputs.packages[0], ...patch }, inputs.packages[1]] : [inputs.packages[0], { ...inputs.packages[1], ...patch }] };
}
function success(inputs: QuoteInputs = base): Costs {
  const result = compareQuotes(inputs);
  expect(result.status, JSON.stringify(result)).toBe('ok');
  if (result.status === 'error') throw new Error(JSON.stringify(result.issues));
  return result;
}
function value(amount: CalculatedAmount): number {
  if (amount.status === 'unknown') throw new Error('Expected a known amount.');
  return amount.usd;
}

describe('independent financial reference checks', () => {
  it('matches the 3% specification, without rounding internal values', () => {
    const result = success();
    const expected = quotesFixture.expectedAtThreePercent;
    for (const [index, pkg] of result.packages.entries()) {
      expect(value(pkg.upfront)).toBe(expected.upfrontUsd[index]);
      expect(value(pkg.fundingGap)).toBe(expected.fundingGapUsd[index]);
      expect(Math.abs(value(pkg.presentCost) - expected.presentCostRoundedUsd[index]!)).toBeLessThan(quotesFixture.currencyToleranceUsd);
    }
    expect(result.breakEven).toMatchObject({ status: 'premium', higherUpfrontPackageId: 'package-b', upfrontPremiumUsd: 2000, expectedAnnualSavings: { status: 'known', usd: 450 } });
    if (result.breakEven.status !== 'premium') throw new Error('Missing premium');
    expect(Math.abs(result.breakEven.requiredAnnualSavingsUsd - expected.breakEvenRoundedUsdPerYear)).toBeLessThan(0.005);
    expect(result.breakEven.requiredAnnualSavingsUsd).not.toBe(expected.breakEvenRoundedUsdPerYear);
    expect(assessSavings(result.breakEven)).toBe('above');
    // Independent sum of the ten individually discounted year-end payments.
    const factor = Array.from({ length: 10 }, (_, i) => 1 / 1.03 ** (i + 1)).reduce((a, b) => a + b, 0);
    expect(result.annuityFactor).toBeCloseTo(factor, 12);
  });

  it('handles a zero discount rate and the near-zero limit', () => {
    const zero = success({ ...base, realRate: 0 });
    expect(zero.annuityFactor).toBe(10);
    expect(zero.breakEven).toMatchObject({ requiredAnnualSavingsUsd: 200 });
    expect(value(zero.packages[0].presentCost)).toBe(28000);
    expect(value(zero.packages[1].presentCost)).toBe(25500);
    expect(success({ ...base, realRate: 1e-15 }).annuityFactor).toBeCloseTo(10, 11);
  });

  it.each([0, 0.03])('agrees at exact break-even and changes sides around it at rate %s', realRate => {
    const inputs = { ...base, realRate };
    const factor = realRate === 0 ? 10 : Array.from({ length: 10 }, (_, i) => 1 / (1 + realRate) ** (i + 1)).reduce((a, b) => a + b, 0);
    const threshold = 2000 / factor;
    const at = success(change(1, { annualUpkeep: known(900 - threshold) }, inputs));
    expect(value(at.packages[0].presentCost)).toBeCloseTo(value(at.packages[1].presentCost), 9);
    expect(assessSavings(at.breakEven)).toBe('at');
    const above = success(change(1, { annualUpkeep: known(900 - threshold - 0.0001) }, inputs));
    const below = success(change(1, { annualUpkeep: known(900 - threshold + 0.0001) }, inputs));
    expect(assessSavings(above.breakEven)).toBe('above');
    expect(assessSavings(below.breakEven)).toBe('below');
    expect(value(above.packages[1].presentCost)).toBeLessThan(value(above.packages[0].presentCost));
    expect(value(below.packages[1].presentCost)).toBeGreaterThan(value(below.packages[0].presentCost));
  });

  it('changing budget affects only funding gaps; horizon affects discounted totals and threshold', () => {
    const first = success();
    const raised = success({ ...base, budgetUsd: 21000 });
    expect(raised.packages.map(pkg => value(pkg.fundingGap))).toEqual([0, 0]);
    expect(raised.packages.map(pkg => pkg.presentCost)).toEqual(first.packages.map(pkg => pkg.presentCost));
    expect(raised.breakEven).toEqual(first.breakEven);
    expect(raised.annuityFactor).toBe(first.annuityFactor);
    const shorter = success({ ...base, years: 5 });
    expect(shorter.packages.map(pkg => pkg.upfront)).toEqual(first.packages.map(pkg => pkg.upfront));
    expect(shorter.annuityFactor).toBeLessThan(first.annuityFactor);
    expect(shorter.breakEven).not.toEqual(first.breakEven);
    expect(shorter.packages[0].presentCost).not.toEqual(first.packages[0].presentCost);
  });

  it('is invariant to package order and identifies A when its upfront cost is higher', () => {
    const first = success();
    const reversed = success({ ...base, packages: [base.packages[1], base.packages[0]] });
    expect(reversed.breakEven).toEqual(first.breakEven);
    expect(reversed.packages).toEqual([...first.packages].reverse());
    expect(success(change(0, { materials: known(20000) })).breakEven).toMatchObject({ status: 'premium', higherUpfrontPackageId: 'package-a', expectedAnnualSavings: { status: 'known', usd: -450 } });
  });
});

describe('unknowns, contributions and source data', () => {
  it.each(COST_FIELDS)('preserves missing dependencies for %s', field => {
    const result = success(change(1, { [field]: unknown }));
    expect(result.packages[1].presentCost).toEqual({ status: 'unknown', missing: [{ packageId: 'package-b', field }] });
    if (field === 'annualUpkeep') {
      expect(result.packages[1].upfront).toEqual({ status: 'known', usd: 21000 });
      expect(result.packages[1].fundingGap).toEqual({ status: 'known', usd: 1000 });
      expect(result.breakEven).toMatchObject({ status: 'premium', expectedAnnualSavings: { status: 'unknown' } });
      expect(assessSavings(result.breakEven)).toBe('unknown');
    } else {
      expect(result.packages[1].upfront.status).toBe('unknown');
      expect(result.packages[1].fundingGap.status).toBe('unknown');
      expect(result.breakEven).toEqual({ status: 'unknown', missing: [{ packageId: 'package-b', field }] });
    }
    expect(result.packages[0]).toEqual(success().packages[0]);
  });

  it('keeps explicit zero known and allows equal upfront costs with unknown upkeep', () => {
    const result = success(change(1, { annualUpkeep: known(0) }));
    expect(value(result.packages[1].presentCost)).toBe(21000);
    const equal = success(change(1, { cashContribution: known(2000), annualUpkeep: unknown }));
    expect(equal.breakEven).toEqual({ status: 'equal-upfront', requiredAnnualSavingsUsd: 0 });
    expect(assessSavings(equal.breakEven)).toBe('equal-upfront');
  });

  it('subtracts cash once and never subtracts donated materials again', () => {
    const result = success(change(1, { materials: known(0), cashContribution: known(1000), donationNote: 'Materials donated; actual purchase cost is zero.' }));
    expect(value(result.packages[1].upfront)).toBe(6000);
    expect(value(success(change(1, { cashContribution: known(21000) })).packages[1].upfront)).toBe(0);
    const excess = success(change(1, { cashContribution: known(30000) }));
    expect(value(excess.packages[1].upfront)).toBe(0);
    expect(value(excess.packages[1].presentCost)).toBeCloseTo(450 * excess.annuityFactor, 10);
  });

  it('does not reject equivalent decimal credits because of binary rounding', () => {
    const result = success(change(1, { materials: known(0.1), freight: known(0.7), installation: known(0), cashContribution: known(0.8) }));
    expect(value(result.packages[1].upfront)).toBe(0);
  });

  it('does not change calculations when source labels or donation notes change', () => {
    const result = success(change(1, { materials: { status: 'known', usd: 14000, source: { kind: 'supplier-quote', label: 'Supplier #42' } }, donationNote: 'No donations.' }));
    expect(result).toEqual(success());
  });
});

describe('runtime validation and numerical range', () => {
  it.each([
    ['null', null], ['missing package', { ...base, packages: [base.packages[0]] }],
    ['duplicate IDs', change(1, { id: 'package-a' })], ['blank name', change(0, { label: ' ' })],
    ['different scopes', change(0, { scope: 'A different service' })],
    ['negative budget', { ...base, budgetUsd: -1 }], ['blank budget parsed as NaN', { ...base, budgetUsd: NaN }],
    ['zero years', { ...base, years: 0 }], ['fractional years', { ...base, years: 1.5 }], ['unsafe years', { ...base, years: 1e20 }],
    ['negative rate', { ...base, realRate: -0.01 }], ['infinite rate', { ...base, realRate: Infinity }],
    ['negative price', change(0, { materials: known(-1) })], ['nonfinite price', change(1, { annualUpkeep: known(Infinity) })],
    ['missing source', change(0, { materials: { status: 'known', usd: 10 } as AmountInput })],
    ['blank reference', change(0, { freight: { status: 'known', usd: 10, source: { kind: 'supplier-quote', label: '' } } })],
  ])('rejects %s with no stale totals', (_, input) => {
    success();
    expect(validateQuoteInputs(input)).toMatchObject({ status: 'error', issues: expect.any(Array) });
    const result = compareQuotes(input as QuoteInputs);
    expect(result.status).toBe('error');
    expect(result).not.toHaveProperty('packages');
    expect(result).not.toHaveProperty('breakEven');
  });

  it('rejects overflowing initial totals, present costs and thresholds', () => {
    expect(compareQuotes(change(0, { materials: known(1e308), freight: known(1e308) })).status).toBe('error');
    expect(compareQuotes(change(0, { annualUpkeep: known(1e308) })).status).toBe('error');
    expect(compareQuotes({ ...base, realRate: 1e308 }).status).toBe('error');
  });
});

it('exports a deep immutable serializable input/result snapshot, including unknowns', () => {
  const source = structuredClone(change(1, { annualUpkeep: unknown }));
  const result = createCostSnapshot(source);
  if (result.status === 'error') throw new Error('Expected a snapshot');
  Reflect.set(source, 'budgetUsd', 0);
  Reflect.set(source.packages[1], 'donationNote', 'Changed later');
  expect(result.quotes.budgetUsd).toBe(20000);
  expect(result.quotes.packages[1].donationNote).toBe('');
  expect(Object.isFrozen(result.quotes.packages[0].materials)).toBe(true);
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  expect(result.costs.packages[1].presentCost.status).toBe('unknown');
  expect(createCostSnapshot({ ...source, years: 0 }).status).toBe('error');
});
