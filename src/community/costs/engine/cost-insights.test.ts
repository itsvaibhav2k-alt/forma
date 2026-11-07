import { expect, it } from 'vitest';
import type { AmountInput, QuoteInputs } from '../../../shared';
import { quotesFixture } from '../../../shared/fixtures/quotes';
import { compareQuotes } from './compareQuotes';
import { costInsights } from './cost-insights';

const known = (usd: number): AmountInput => ({ status: 'known', usd, source: { kind: 'user-estimate', label: 'Test assumption' } });
function scenario(a: Partial<QuoteInputs['packages'][0]> = {}, b: Partial<QuoteInputs['packages'][1]> = {}, settings: Partial<QuoteInputs> = {}) {
  const inputs: QuoteInputs = { ...quotesFixture.inputs, ...settings, packages: [{ ...quotesFixture.inputs.packages[0], ...a }, { ...quotesFixture.inputs.packages[1], ...b }] };
  const costs = compareQuotes(inputs);
  if (costs.status !== 'ok') throw new Error(JSON.stringify(costs));
  return { inputs, costs, insight: costInsights(inputs, costs) };
}
it('shows cheaper upkeep and discounted total even when upfront prices are equal', () => {
  const { costs, insight } = scenario({}, { materials: known(12000) });
  expect(costs.breakEven.status).toBe('equal-upfront');
  expect(insight.annualUpkeep).toMatchObject({ status: 'lower', lowerPackageId: 'package-b', differenceUsd: 450 });
  expect(insight.discountedTotal).toMatchObject({ status: 'lower', lowerPackageId: 'package-b' });
});
it('keeps upkeep comparison available when upfront prices and total costs are unknown', () => {
  const { insight } = scenario({ materials: { status: 'unknown', note: 'Quote pending' } });
  expect(insight.discountedTotal).toEqual({ status: 'unknown', missingPackageLabels: ['Package A (fictional)'] });
  expect(insight.annualUpkeep).toMatchObject({ status: 'lower', lowerPackageId: 'package-b', differenceUsd: 450 });
});
it('does not invent a winner when upkeep is unknown', () => {
  const { insight } = scenario({}, { annualUpkeep: { status: 'unknown', note: 'Estimate pending' } });
  expect(insight.annualUpkeep.status).toBe('unknown');
  expect(insight.discountedTotal.status).toBe('unknown');
});
it('treats explicit zero and equal totals as known ties', () => {
  const empty = { materials: known(0), freight: known(0), installation: known(0), cashContribution: known(0), annualUpkeep: known(0) };
  expect(scenario(empty, empty).insight).toEqual({ annualUpkeep: { status: 'equal' }, discountedTotal: { status: 'equal' } });
  const { insight } = scenario({ annualUpkeep: known(650) }, { annualUpkeep: known(450) }, { realRate: 0 });
  expect(insight.discountedTotal.status).toBe('equal');
});
it('identifies the cheaper maintenance option when the premium option also costs more to run', () => {
  const { costs, insight } = scenario({ label: 'Local option', annualUpkeep: known(400) }, { label: 'Premium option', annualUpkeep: known(500) });
  expect(costs.breakEven).toMatchObject({ status: 'premium', expectedAnnualSavings: { status: 'known', usd: -100 } });
  expect(insight.annualUpkeep).toMatchObject({ status: 'lower', lowerLabel: 'Local option', higherLabel: 'Premium option', differenceUsd: 100 });
  expect(insight.discountedTotal).toMatchObject({ status: 'lower', lowerPackageId: 'package-a' });
});
it('absorbs binary noise but does not create ties from currency display rounding', () => {
  const { inputs, costs } = scenario({ annualUpkeep: known(0.1 + 0.2) }, { annualUpkeep: known(0.3) });
  expect(costInsights(inputs, costs).annualUpkeep.status).toBe('equal');
  expect(scenario({ annualUpkeep: known(0.30001) }, { annualUpkeep: known(0.3) }).insight.annualUpkeep).toMatchObject({ status: 'lower', differenceUsd: expect.any(Number) });
});
