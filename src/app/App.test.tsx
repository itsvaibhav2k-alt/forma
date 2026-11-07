// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('foundation shell', () => {
  it('makes unavailable capabilities explicit and shows no invented analysis', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Where should one extra brace go?');
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Decision sheet/ })).toBeDisabled();
    expect(screen.getByText(/No predicted result is available/)).toBeVisible();
    expect(screen.queryByText(/26\.34|1\.09|10\.46|0\.043702/)).not.toBeInTheDocument();
  });

  it('supports keyboard navigation between independent views without exposing demo prices', async () => {
    const user = userEvent.setup();
    render(<App />);
    const compare = screen.getByRole('button', { name: 'Compare build options' });
    compare.focus();
    await user.keyboard('{Enter}');
    expect(compare).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What will each option really cost?');
    expect(screen.getAllByText('No quote entered')).toHaveLength(2);
    expect(screen.queryByText(/19,000|21,000|234\.46/)).not.toBeInTheDocument();
    const experiment = screen.getByRole('button', { name: 'Experiment' });
    experiment.focus();
    await user.keyboard(' ');
    expect(experiment).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Bridge workspace' })).toBeVisible();
  });
});
