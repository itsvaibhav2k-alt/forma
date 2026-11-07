// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

it('explains the experiment openly before the first trial and collapses once a trial exists', async () => {
  render(<App />);
  const details = screen.getByText('How this works').closest('details')!;
  expect(details).toHaveAttribute('open');
  expect(screen.getByText(/exactly one diagonal brace/)).toBeVisible();
  expect(screen.getByText(/not a safety rating/)).toBeVisible();
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  expect(screen.getByText('How this works').closest('details')).not.toHaveAttribute('open');
  await user.click(screen.getByRole('button', { name: 'Compare build options' }));
  expect(screen.getByText('How this works').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText('Blank versus zero')).toBeInTheDocument();
});
