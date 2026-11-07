// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { rankBraces } from '../structures';
import { App } from './App';

afterEach(cleanup);

it('uses one viewport and preserves the draft, committed brace and retest across representations', async () => {
  const user = userEvent.setup(), ranker = vi.fn(rankBraces);
  const { container } = render(<App ranker={ranker} />);
  const switchTo = (name: string) => user.click(screen.getByRole('button', { name }));
  await switchTo('Assembly');
  expect(container.querySelectorAll('.viewport-card svg')).toHaveLength(1);
  expect(screen.queryByRole('slider')).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('radio', { name: 'B3 Right' }));
  expect(screen.getByRole('img', { name: /Load at B3, brace in P2/ })).toBeVisible();
  expect(screen.getByText('Results hidden')).toBeVisible();
  expect(ranker).not.toHaveBeenCalled();
  await switchTo('Structural');
  expect(container.querySelectorAll('.viewport-card svg')).toHaveLength(1);
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '3');
  expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
  await switchTo('Assembly');
  await switchTo('Commit prediction');
  expect(screen.getByRole('region', { name: 'Your prediction, tested' })).toBeVisible();
  await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
  expect(screen.getByRole('img', { name: /Load at B2, brace in P2/ })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Same-brace retest' })).toHaveTextContent('10.46%');
  await switchTo('Structural');
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '2');
  expect(screen.getByRole('radio', { name: 'P2' })).toBeDisabled();
  expect(ranker).toHaveBeenCalledTimes(2);
});

it('keeps overlay preferences separate from representation and clears all active evidence in a new round', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);
  await user.click(screen.getByRole('radio', { name: 'P1' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('button', { name: 'Structural' }));
  const detail = container.querySelector('.ranking-details');
  expect(detail).not.toHaveAttribute('open');
  await user.click(screen.getByText('Structural overlays and comparison'));
  await user.click(screen.getByRole('checkbox', { name: 'Axial force colors' }));
  await user.click(screen.getByRole('checkbox', { name: 'Deformed shape' }));
  await user.click(screen.getByRole('radio', { name: 'Original' }));
  await user.click(screen.getByRole('button', { name: 'Assembly' }));
  expect(screen.queryByText('Structural overlays and comparison')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Structural' }));
  await user.click(screen.getByText('Structural overlays and comparison'));
  expect(screen.getByRole('checkbox', { name: 'Axial force colors' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Deformed shape' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Original' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
  expect(screen.getByText('Results hidden')).toBeVisible();
  expect(container.querySelector('.workspace-grid')).not.toHaveTextContent(/0\.043702|26\.34|tension|compression/);
  expect(container.querySelector('[data-overlay]')).toBeNull();
  expect(container.querySelector('.tension, .compression')).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'P4' }));
  expect(container.querySelector('.preview-brace')).not.toBeNull();
  await user.click(screen.getByRole('button', { name: 'Assembly' }));
  expect(screen.getByRole('img', { name: /Load at B1, brace in P4/ })).toBeVisible();
  expect(container.querySelector('.workspace-grid')).not.toHaveTextContent(/0\.043702|26\.34/);
});

it('returns from read-only assembly history to the exact active retest without solving', async () => {
  const user = userEvent.setup(), ranker = vi.fn(rankBraces);
  render(<App ranker={ranker} />);
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
  const retest = screen.getByRole('region', { name: 'Same-brace retest' }).textContent;
  await user.click(screen.getByRole('button', { name: 'Assembly' }));
  const history = screen.getByRole('button', { name: /Trial 01 · Load B1/ });
  await user.click(history);
  expect(screen.getByRole('button', { name: 'Back to current experiment' })).toHaveFocus();
  expect(screen.getByRole('img', { name: /Load at B1, brace in P2/ })).toBeVisible();
  expect(screen.getByRole('radio', { name: 'B3 Right' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Back to current experiment' }));
  expect(history).toHaveFocus();
  expect(screen.getByRole('region', { name: 'Same-brace retest' }).textContent).toBe(retest);
  expect(screen.getByRole('img', { name: /Load at B2, brace in P2/ })).toBeVisible();
  expect(ranker).toHaveBeenCalledTimes(2);
});
