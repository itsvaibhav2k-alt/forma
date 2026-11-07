
import { describe, expect, it } from 'vitest';
import { compareQuotes } from '../src/community/finance';
import {
  DEMO_FINANCE_INPUTS,
  type Amount,
  type FinanceInputs,
  type FinanceResult,
  type FinanceSuccess,
  type Quote,
} from '../src/shared';

const { quoteA, quoteB } = DEMO_FINANCE_INPUTS;

const compare = (changes: Partial<FinanceInputs> = {}) => {
  const input = { ...DEMO_FINANCE_INPUTS, ...changes };

  return compareQuotes(
    input.quoteA,
    input.quoteB,
    input.budgetUSD,
    input.years,
    input.rate,
  );
};

function success(result: FinanceResult): FinanceSuccess {
  expect(result.status, JSON.stringify(result)).toBe('ok');

  if (result.status !== 'ok') {
    throw new Error(JSON.stringify(result));
  }

  return result;
}

function amount(result: Amount): number {
  expect(result.status).toBe('known');

  if (result.status !== 'known') {
    throw new Error('Expected known amount');
  }

  return result.amountUSD;
}

function premium(result: FinanceSuccess) {
  expect(result.breakEven.status).toBe('premium');

  if (result.breakEven.status !== 'premium') {
    throw new Error('Expected premium');
  }

  return result.breakEven;
}

function changePrice(
  quote: Quote,
  key:
    | 'purchase'
    | 'delivery'
    | 'installation'
    | 'donation'
    | 'annualUpkeep',
  amountUSD: number | null,
): Quote {
  return {
    ...quote,
    [key]: {
      ...quote[key],
      amountUSD,
    },
  };
}

describe('independent financial model', () => {
  it('reproduces upfront costs, funding gaps, discounted totals and 3% break-even from the brief', () => {
    const result = success(compare());

    expect(amount(result.quoteA.upfront)).toBe(19000);
    expect(amount(result.quoteB.upfront)).toBe(21000);
    expect(amount(result.quoteA.fundingGap)).toBe(0);
    expect(amount(result.quoteB.fundingGap)).toBe(1000);
    expect(amount(result.quoteA.discountedTotal)).toBeCloseTo(26677.18, 2);
    expect(amount(result.quoteB.discountedTotal)).toBeCloseTo(24838.59, 2);
    expect(premium(result).annualSavingsRequiredUSD).toBeCloseTo(234.46, 2);
    expect(premium(result).higherUpfrontQuoteId).toBe(quoteB.id);
    expect(premium(result).lowerUpfrontQuoteId).toBe(quoteA.id);
    expect(premium(result).premiumUSD).toBe(2000);
  });

  it('uses years as the annuity factor at zero rate', () => {
    const result = success(compare({ rate: 0 }));

    expect(result.annuityFactor).toBe(10);
    expect(premium(result).annualSavingsRequiredUSD).toBe(200);
    expect(amount(result.quoteA.discountedTotal)).toBe(28000);
    expect(amount(result.quoteB.discountedTotal)).toBe(25500);
  });

  it.each([0, 0.03, 1e-15])(
    'agrees with independently summed year-end discount factors at rate %s',
    (rate) => {
      const result = success(compare({ rate }));

      const expected = Array.from(
        { length: 10 },
        (_, i) => (1 + rate) ** -(i + 1),
      ).reduce((sum, value) => sum + value, 0);

      expect(result.annuityFactor).toBeCloseTo(expected, 11);
    },
  );

  it.each([0, 0.03])(
    'makes discounted totals equal at exactly break-even savings, rate %s',
    (rate) => {
      const first = success(compare({ rate }));
      const threshold = premium(first).annualSavingsRequiredUSD;

      const result = success(
        compare({
          rate,
          quoteB: changePrice(
            quoteB,
            'annualUpkeep',
            900 - threshold,
          ),
        }),
      );

      expect(amount(result.quoteA.discountedTotal)).toBeCloseTo(
        amount(result.quoteB.discountedTotal),
        9,
      );
    },
  );

  it('changes only the funding gap when the budget increases', () => {
    const original = success(compare());
    const updated = success(compare({ budgetUSD: 21000 }));

    expect(amount(updated.quoteB.fundingGap)).toBe(0);
    expect(updated.quoteA).toEqual(original.quoteA);

    expect({
      ...updated.quoteB,
      fundingGap: original.quoteB.fundingGap,
    }).toEqual(original.quoteB);

    expect(updated.breakEven).toEqual(original.breakEven);
    expect(updated.annuityFactor).toBe(original.annuityFactor);
  });

  it('recalculates totals and threshold when horizon changes', () => {
    const ten = success(compare());
    const five = success(compare({ years: 5 }));

    expect(
      premium(five).annualSavingsRequiredUSD,
    ).toBeGreaterThan(premium(ten).annualSavingsRequiredUSD);

    expect(amount(five.quoteA.discountedTotal)).toBeLessThan(
      amount(ten.quoteA.discountedTotal),
    );

    expect(five.quoteA.upfront).toEqual(ten.quoteA.upfront);
    expect(five.quoteB.fundingGap).toEqual(ten.quoteB.fundingGap);
  });

  it('identifies the actual higher-upfront package after quotes are swapped', () => {
    const result = success(
      compare({ quoteA: quoteB, quoteB: quoteA }),
    );

    expect(premium(result).higherUpfrontQuoteId).toBe(quoteB.id);
    expect(premium(result).annualSavingsRequiredUSD).toBeCloseTo(
      234.46,
      2,
    );
  });

  it('reports zero threshold for equal upfront costs', () => {
    const result = success(
      compare({
        quoteB: changePrice(quoteB, 'purchase', 18000),
      }),
    );

    expect(result.breakEven).toEqual({
      status: 'equal-upfront',
      premiumUSD: 0,
      annualSavingsRequiredUSD: 0,
    });
  });

  it('subtracts cash donations once, without using the budget to discount total cost', () => {
    const result = success(
      compare({
        quoteB: changePrice(quoteB, 'donation', 1000),
      }),
    );

    expect(amount(result.quoteB.grossUpfront)).toBe(21000);
    expect(amount(result.quoteB.donationApplied)).toBe(1000);
    expect(amount(result.quoteB.upfront)).toBe(20000);
    expect(amount(result.quoteB.fundingGap)).toBe(0);

    expect(amount(result.quoteB.discountedTotal)).toBeCloseTo(
      amount(success(compare()).quoteB.discountedTotal) - 1000,
      10,
    );

    expect(premium(result).premiumUSD).toBe(1000);
  });

  it('accepts a contribution below the total initial package cost', () => {
    const result = success(
      compare({
        quoteB: changePrice(quoteB, 'donation', 20000),
      }),
    );

    expect(amount(result.quoteB.grossUpfront)).toBe(21000);
    expect(amount(result.quoteB.donationApplied)).toBe(20000);
    expect(amount(result.quoteB.upfront)).toBe(1000);
  });

  it('accepts a contribution exactly equal to the total initial package cost', () => {
    const result = success(
      compare({
        quoteB: changePrice(quoteB, 'donation', 21000),
      }),
    );

    expect(amount(result.quoteB.grossUpfront)).toBe(21000);
    expect(amount(result.quoteB.donationApplied)).toBe(21000);
    expect(amount(result.quoteB.upfront)).toBe(0);
  });

  it('rejects a contribution exceeding the total initial package cost', () => {
    const result = compare({
      quoteB: changePrice(quoteB, 'donation', 21000.01),
    });

    expect(result.status).toBe('invalid');

    if (result.status === 'invalid') {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: 'quoteB.donation',
          message:
            'Cash contribution cannot exceed the total initial package cost.',
        }),
      );
    }
  });

  it('does not prematurely reject a contribution when an initial cost is unknown', () => {
    const result = success(
      compare({
        quoteB: changePrice(
          changePrice(quoteB, 'purchase', null),
          'donation',
          30000,
        ),
      }),
    );

    expect(result.quoteB.upfront.status).toBe('unknown');
    expect(result.quoteB.fundingGap.status).toBe('unknown');
  });

  it.each([
    'purchase',
    'delivery',
    'installation',
    'donation',
  ] as const)(
    'keeps missing %s unknown, with dependent totals and threshold unknown',
    (key) => {
      const result = success(
        compare({
          quoteA: changePrice(quoteA, key, null),
        }),
      );

      expect(result.quoteA.upfront.status).toBe('unknown');
      expect(result.quoteA.fundingGap.status).toBe('unknown');
      expect(result.quoteA.discountedTotal.status).toBe('unknown');

      expect(result.breakEven).toEqual({
        status: 'unknown',
        missingFields: [`quoteA.${key}`],
      });

      expect(amount(result.quoteA.annualUpkeep)).toBe(900);
      expect(amount(result.quoteB.upfront)).toBe(21000);
    },
  );

  it('keeps known upfront results and break-even when only upkeep is missing', () => {
    const result = success(
      compare({
        quoteA: changePrice(quoteA, 'annualUpkeep', null),
      }),
    );

    expect(amount(result.quoteA.upfront)).toBe(19000);
    expect(amount(result.quoteA.fundingGap)).toBe(0);

    expect(result.quoteA.discountedTotal).toEqual({
      status: 'unknown',
      missingFields: ['quoteA.annualUpkeep'],
    });

    expect(premium(result).annualSavingsRequiredUSD).toBeCloseTo(
      234.46,
      2,
    );
  });

  it('treats explicit zero as known rather than missing', () => {
    const result = success(
      compare({
        quoteA: changePrice(quoteA, 'annualUpkeep', 0),
      }),
    );

    expect(amount(result.quoteA.discountedTotal)).toBe(19000);
  });

  it.each([0, -1, 2.5, NaN, Infinity])(
    'rejects horizon %s and exports no stale totals',
    (years) => {
      const result = compare({ years });

      expect(result.status).toBe('invalid');
      expect(JSON.stringify(result)).toContain('invalid-horizon');
      expect(Object.keys(result).sort()).toEqual([
        'issues',
        'status',
      ]);
    },
  );

  it.each([-0.01, NaN, Infinity])(
    'rejects invalid rate %s',
    (rate) => {
      expect(compare({ rate }).status).toBe('invalid');
    },
  );

  it.each([-1, NaN, Infinity])(
    'rejects invalid budget %s',
    (budgetUSD) => {
      expect(compare({ budgetUSD }).status).toBe('invalid');
    },
  );

  it.each([-1, NaN, Infinity])(
    'rejects invalid known price %s',
    (value) => {
      expect(
        compare({
          quoteA: changePrice(quoteA, 'delivery', value),
        }).status,
      ).toBe('invalid');
    },
  );

  it('requires distinct package IDs, matching scope and source labels', () => {
    expect(
      compare({
        quoteB: { ...quoteB, id: quoteA.id },
      }).status,
    ).toBe('invalid');

    expect(
      compare({
        quoteB: { ...quoteB, scopeId: 'different-service' },
      }).status,
    ).toBe('invalid');

    expect(
      compare({
        quoteA: { ...quoteA, scopeLabel: '' },
      }).status,
    ).toBe('invalid');

    expect(
      compare({
        quoteA: {
          ...quoteA,
          purchase: {
            ...quoteA.purchase,
            source: {
              kind: 'unknown',
              label: '',
            },
          },
        },
      }).status,
    ).toBe('invalid');
  });

  it('returns numerical failure rather than infinite totals', () => {
    const huge = changePrice(
      changePrice(quoteA, 'purchase', 1e308),
      'installation',
      1e308,
    );

    expect(compare({ quoteA: huge }).status).toBe('invalid');

    expect(
      compare({
        quoteA: changePrice(quoteA, 'annualUpkeep', 1e308),
      }).status,
    ).toBe('invalid');
  });

  it('does not mutate frozen inputs and returns deterministic results', () => {
    const before = JSON.stringify(DEMO_FINANCE_INPUTS);

    expect(compare()).toEqual(compare());
    expect(JSON.stringify(DEMO_FINANCE_INPUTS)).toBe(before);
  });
});
