// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { CostWorkbench } from './CostWorkbench';
import { useQuotes } from './useQuotes';

afterEach(cleanup);
function Harness() { return <CostWorkbench {...useQuotes()} />; }
const loadExample = async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Load fictional example' }));
  return user;
};
const resultsFor = (letter: string) => screen.getByRole('article', { name: `Package ${letter} (fictional) cost results` });

it('starts without fictional prices and calculates only from explicit inputs', () => {
  render(<Harness />);
  expect(screen.getAllByText('No quote entered')).toHaveLength(2);
  expect(screen.getByText('No comparison yet')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('$26,677.18')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Common scope and level of service'), { target: { value: 'Equivalent community garden materials and service' } });
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(5);
  expect(screen.getByRole('heading', { name: 'Cash today. Cost over time.' })).toBeVisible();
});

it('shows the fictional totals, required savings and sources, and responds to budget, years and 0% rate', async () => {
  await loadExample();
  expect(resultsFor('A')).toHaveTextContent('$26,677.18');
  expect(resultsFor('B')).toHaveTextContent('$24,838.59');
  expect(screen.getByText('$234.46')).toBeVisible();
  expect(screen.getByText(/Fictional example amounts are labeled/)).toBeVisible();
  expect(screen.getByLabelText('Package A Materials source type')).toHaveValue('demo-assumption');
  fireEvent.change(screen.getByLabelText('Upfront budget (USD)'), { target: { value: '21000' } });
  expect(resultsFor('B')).toHaveTextContent('Fits the upfront budget');
  expect(resultsFor('B')).toHaveTextContent('$24,838.59');
  expect(screen.getByText('$234.46')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Real discount rate (%)'), { target: { value: '0' } });
  expect(screen.getByText('$200.00')).toBeVisible();
  expect(resultsFor('B')).toHaveTextContent('$25,500.00');
  fireEvent.change(screen.getByLabelText('Horizon (years)'), { target: { value: '5' } });
  expect(screen.getByText('$400.00')).toBeVisible();
  expect(resultsFor('B')).toHaveTextContent('$23,250.00');
});

it('keeps upfront affordability when upkeep is cleared and treats zero as a known amount', async () => {
  const user = await loadExample();
  await user.clear(screen.getByLabelText('Package B Annual upkeep (USD/year)'));
  expect(resultsFor('B')).toHaveTextContent('$21,000.00');
  expect(resultsFor('B')).toHaveTextContent('$1,000.00');
  expect(within(resultsFor('B')).getByText('Unknown')).toBeVisible();
  expect(screen.getByText('$234.46')).toBeVisible();
  expect(screen.getByLabelText('Package B Annual upkeep source type')).toBeDisabled();
  await user.type(screen.getByLabelText('Package B Annual upkeep (USD/year)'), '0');
  expect(within(resultsFor('B')).queryByText('Unknown')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Package B Annual upkeep source type')).toHaveValue('user-estimate');
});

it('clears stale totals on invalid raw input and exposes an associated field error', async () => {
  await loadExample();
  const input = screen.getByLabelText('Package B Cash contribution (USD)');
  fireEvent.change(input, { target: { value: '-1' } });
  expect(screen.getByRole('alert')).toHaveTextContent('finite, nonnegative');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.queryByText('$24,838.59')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '0' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(resultsFor('B')).toHaveTextContent('$24,838.59');
  fireEvent.change(screen.getByLabelText('Horizon (years)'), { target: { value: '1e' } });
  expect(screen.getByRole('alert')).toHaveTextContent('positive whole number');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('requires a supplier reference and relabels edited example prices', async () => {
  const user = await loadExample();
  fireEvent.change(screen.getByLabelText('Package A Materials (USD)'), { target: { value: '11000' } });
  expect(screen.getByLabelText('Package A Materials source type')).toHaveValue('user-estimate');
  await user.selectOptions(screen.getByLabelText('Package A Materials source type'), 'supplier-quote');
  expect(screen.getByRole('alert')).toHaveTextContent('enter its reference');
  const source = screen.getByLabelText('Package A Materials source reference');
  expect(source).toHaveAttribute('aria-invalid', 'true');
  await user.type(source, 'Supplier quote Q-42, November 2026');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Package A Materials source type')).toHaveValue('supplier-quote');
});

it('resets the comparison explicitly and keeps blanks unknown', async () => {
  const user = await loadExample();
  await user.click(screen.getByRole('button', { name: 'Start blank' }));
  expect(screen.getAllByText('No quote entered')).toHaveLength(2);
  expect(screen.getByLabelText('Package A Materials (USD)')).toHaveValue('');
  expect(screen.queryByText('$26,677.18')).not.toBeInTheDocument();
  expect(screen.getByText('No comparison yet')).toBeVisible();
});

it('caps excess cash contributions at upfront cost without crediting maintenance', async () => {
  await loadExample();
  fireEvent.change(screen.getByLabelText('Package B Cash contribution (USD)'), { target: { value: '30000' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(resultsFor('B')).toHaveTextContent('$0.00');
  expect(resultsFor('B')).toHaveTextContent('$3,838.59');
  expect(screen.getAllByText(/Excess does not offset upkeep/)).toHaveLength(2);
});
