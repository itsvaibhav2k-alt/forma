// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { rankBraces } from '../structures';
import { App } from './App';

afterEach(cleanup);

it('isolates live and saved structural outputs from every financial input, and preserves quotes during retests', async () => {
  const user = userEvent.setup();
  const ranker = vi.fn(rankBraces);
  render(<App ranker={ranker} />);
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
  const originalText = screen.getByRole('region', { name: 'Saved prediction: P2 at B1' }).textContent;
  const retestText = screen.getByRole('region', { name: 'Same-brace retest' }).textContent;
  const firstResults = JSON.stringify(ranker.mock.results.map(result => result.value));
  expect(ranker).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  await user.click(screen.getByRole('button', { name: 'Load fictional example' }));
  for (const [label, value] of [
    ['Upfront budget (USD)', '21000'], ['Horizon (years)', '7'], ['Real discount rate (%)', '2'],
    ['Package B Materials (USD)', '13000'], ['Package B Freight (USD)', '3500'],
    ['Package B Installation (USD)', '2800'], ['Package B Cash contribution (USD)', '200'],
    ['Package B Annual upkeep (USD/year)', '500'], ['Package B name', 'Local supplier'],
    ['Package B donation / scope notes', 'No material donations.'],
    ['Common scope and level of service', 'Equivalent local material packages over seven years'],
  ]) fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  const costsText = screen.getByRole('region', { name: 'Cash today. Cost over time.' }).textContent;
  await user.click(screen.getByRole('button', { name: 'Workbench' }));
  expect(screen.getByRole('region', { name: 'Same-brace retest' }).textContent).toBe(retestText);
  expect(screen.getByRole('region', { name: 'Saved prediction: P2 at B1' }).textContent).toBe(originalText);
  expect(JSON.stringify(ranker.mock.results.map(result => result.value))).toBe(firstResults);
  expect(ranker).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('radio', { name: 'B3 Right' }));
  await user.click(screen.getByRole('button', { name: 'Show saved result' }));
  expect(ranker).toHaveBeenCalledTimes(3);
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  expect(screen.getByRole('region', { name: 'Cash today. Cost over time.' }).textContent).toBe(costsText);
  expect(screen.getByLabelText('Package B Annual upkeep (USD/year)')).toHaveValue('500');
  expect(screen.getByLabelText('Package B donation / scope notes')).toHaveValue('No material donations.');
});

it('does not let invalid finance drafts block a structural prediction, and retains those drafts across navigation', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  fireEvent.change(screen.getByLabelText('Horizon (years)'), { target: { value: '-1' } });
  expect(screen.getByRole('alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Workbench' }));
  await user.click(screen.getByRole('radio', { name: 'P1' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  expect(screen.getByRole('status')).toHaveTextContent('26.34%');
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  expect(screen.getByLabelText('Horizon (years)')).toHaveValue('-1');
  expect(screen.getByRole('alert')).toBeVisible();
});
