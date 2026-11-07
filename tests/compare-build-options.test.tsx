
// @vitest-environment jsdom
import { useState } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { App } from '../src/app/App';
import { CompareBuildOptions } from '../src/community/components/CompareBuildOptions';
import { compareQuotes } from '../src/community/finance';
import {
  DEMO_FINANCE_INPUTS,
  type FinanceInputs,
} from '../src/shared';

afterEach(cleanup);

/** Safely retrieve an item from a test query result. */
function first<T>(items: readonly T[], description: string): T {
  const item = items[0];

  if (item === undefined) {
    throw new Error(`Expected to find ${description}.`);
  }

  return item;
}

function price(amountUSD: number | null, label: string) {
  return {
    amountUSD,
    source: {
      kind: amountUSD === null ? 'unknown' as const : 'user-entered' as const,
      label,
    },
  };
}

const TEST_INPUTS: FinanceInputs = {
  ...DEMO_FINANCE_INPUTS,
  budgetUSD: 0,
  years: 3,
  rate: 0.03,
  quoteA: {
    ...DEMO_FINANCE_INPUTS.quoteA,
    purchase: price(10000, 'Test purchase A'),
    delivery: price(1000, 'Test freight A'),
    installation: price(1000, 'Test installation A'),
    donation: price(0, 'Test contribution A'),
    annualUpkeep: price(500, 'Test upkeep A'),
  },
  quoteB: {
    ...DEMO_FINANCE_INPUTS.quoteB,
    purchase: price(12000, 'Test purchase B'),
    delivery: price(1000, 'Test freight B'),
    installation: price(1000, 'Test installation B'),
    donation: price(0, 'Test contribution B'),
    annualUpkeep: price(200, 'Test upkeep B'),
  },
};

function ComparisonHarness() {
  const [inputs, setInputs] = useState(TEST_INPUTS);

  const model = {
    inputs,
    result: compareQuotes(
      inputs.quoteA,
      inputs.quoteB,
      inputs.budgetUSD,
      inputs.years,
      inputs.rate,
    ),
  };

  return (
    <CompareBuildOptions
      model={model}
      onInputsChange={setInputs}
    />
  );
}

describe('CompareBuildOptions component', () => {
  it('closes funding gaps when the budget increases without changing present costs', () => {
    render(<ComparisonHarness />);

    const originalTotals = screen
      .getAllByText(/^Discounted total/)
      .map((element) => element.textContent);

    expect(
      first(screen.getAllByText(/^Funding gap:/), 'funding gap').textContent,
    ).toContain('$12,000.00');

    fireEvent.change(
      screen.getByLabelText('Upfront budget ($):'),
      { target: { value: '1000000' } },
    );

    expect(
      first(screen.getAllByText(/^Funding gap:/), 'funding gap').textContent,
    ).toContain('$0.00');

    const updatedTotals = screen
      .getAllByText(/^Discounted total/)
      .map((element) => element.textContent);

    expect(updatedTotals).toEqual(originalTotals);
  });

  it('updates discounted totals when the maintenance horizon changes', () => {
    render(<ComparisonHarness />);

    const originalTotal = first(
      screen.getAllByText(/^Discounted total/),
      'discounted total',
    ).textContent;

    fireEvent.change(
      screen.getByLabelText('Maintenance horizon (years):'),
      { target: { value: '5' } },
    );

    const updatedTotal = first(
      screen.getAllByText(/^Discounted total/),
      'updated discounted total',
    ).textContent;

    expect(updatedTotal).not.toBe(originalTotal);
    expect(updatedTotal).toContain('(5 years)');
  });

  it('preserves visible upfront affordability when annual upkeep is unknown', () => {
    render(<ComparisonHarness />);

    fireEvent.change(
      first(
        screen.getAllByLabelText('Annual upkeep ($):'),
        'annual upkeep input',
      ),
      { target: { value: '' } },
    );

    expect(screen.getByText('Annual upkeep: Unknown')).toBeTruthy();

    expect(
      first(screen.getAllByText(/^Upfront cost:/), 'upfront cost').textContent,
    ).toContain('$12,000.00');

    expect(
      first(screen.getAllByText(/^Funding gap:/), 'funding gap').textContent,
    ).toContain('$12,000.00');

    expect(
      screen.getByText(/Annual upkeep savings are Unknown/),
    ).toBeTruthy();
  });

  it('displays annual upkeep savings and the break-even threshold', () => {
    render(<ComparisonHarness />);

    expect(screen.getByText(/has lower annual upkeep by/)).toBeTruthy();
    expect(screen.getByText(/Higher-upfront package:/)).toBeTruthy();
    expect(screen.getByText(/Break-even annual savings required:/)).toBeTruthy();
  });
});

describe('Main application navigation', () => {
  it('switches between community comparison and the decision sheet', () => {
    render(<App />);

    const compareButton = screen.getByRole('button', {
      name: 'Compare build options',
    });

    const reportButton = screen.getByRole('button', {
      name: 'Decision sheet',
    });

    expect(compareButton.getAttribute('aria-pressed')).toBe('true');

    expect(
      screen.getByRole('heading', { name: 'Compare build options' }),
    ).toBeTruthy();

    fireEvent.click(reportButton);

    expect(reportButton.getAttribute('aria-pressed')).toBe('true');

    expect(
      screen.queryByRole('heading', { name: 'Compare build options' }),
    ).toBeNull();

    fireEvent.click(compareButton);

    expect(compareButton.getAttribute('aria-pressed')).toBe('true');

    expect(
      screen.getByRole('heading', { name: 'Compare build options' }),
    ).toBeTruthy();
  });
});
