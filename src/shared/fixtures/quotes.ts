import type { AmountInput, QuoteInputs } from '../community';
import { snapshot } from '../snapshot';

const demo = (usd: number): AmountInput => ({
  status: 'known', usd,
  source: { kind: 'demo-assumption', label: 'Fictional equal-scope example from the Forma specification' },
});

export const quotesFixture = snapshot({
  source: 'Forma_Technical_Specification.docx / Community material package comparison',
  inputs: {
    packages: [
      {
        id: 'package-a', label: 'Package A (fictional)', scope: 'Equal-scope demonstration package',
        materials: demo(12_000), freight: demo(1_000), installation: demo(6_000),
        cashContribution: demo(0), annualUpkeep: demo(900), donationNote: '',
      },
      {
        id: 'package-b', label: 'Package B (fictional)', scope: 'Equal-scope demonstration package',
        materials: demo(14_000), freight: demo(4_000), installation: demo(3_000),
        cashContribution: demo(0), annualUpkeep: demo(450), donationNote: '',
      },
    ],
    budgetUsd: 20_000,
    years: 10,
    realRate: 0.03,
  } satisfies QuoteInputs,
  expectedAtThreePercent: {
    upfrontUsd: [19_000, 21_000], fundingGapUsd: [0, 1_000],
    presentCostRoundedUsd: [26_677.18, 24_838.59], breakEvenRoundedUsdPerYear: 234.46,
  },
  expectedAtZeroPercent: { breakEvenUsdPerYear: 200 },
  currencyToleranceUsd: 0.005,
});

export const unknownAmountFixture: AmountInput = snapshot({ status: 'unknown', note: 'No upkeep estimate entered' });
export const explicitZeroFixture: AmountInput = snapshot(demo(0));
