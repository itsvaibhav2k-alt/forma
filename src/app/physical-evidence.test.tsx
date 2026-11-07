// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { rankBraces } from '../structures';
import { App } from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  return user;
}
async function saveReading(user: ReturnType<typeof userEvent.setup>, label: string, note: string) {
  await user.selectOptions(screen.getByLabelText('Design and load case'), screen.getByRole('option', { name: label }));
  await user.type(screen.getByLabelText('Raw vertical readings (one per line)'), '0.04\n0.05\n0.04');
  await user.type(screen.getByLabelText('Instrument resolution (mm)'), '0.01');
  await user.type(screen.getByLabelText('Measurement method'), 'QA dial fixture');
  await user.type(screen.getByLabelText('Physical test conditions'), note);
  await user.click(screen.getByRole('button', { name: 'Save measurement' }));
}

it('includes only matching cases, keeps saved reports frozen after removal and never reruns the solver for evidence', async () => {
  const ranker = vi.fn(rankBraces);
  render(<App ranker={ranker} />);
  const user = await setup();
  await saveReading(user, 'Saved B1 · With brace P2', 'QA-only B1 observation, not a physical test.');
  await saveReading(user, 'Retest B2 · With brace P2', 'QA-only B2 observation, not a physical test.');
  expect(screen.getAllByText(/Inconclusive for resolving/)).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  await user.click(screen.getByRole('button', { name: 'Load fictional example' }));
  expect(screen.getByText(/1 matching observation\(s\) included; 1 from other cases excluded/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Decision sheet' }));
  const captured = screen.getByRole('article', { name: 'Captured decision sheet' }).textContent;
  const evidence = screen.getByRole('region', { name: '03 / Measured' });
  expect(evidence).toHaveTextContent('QA-only B1'); expect(evidence).not.toHaveTextContent('QA-only B2');
  expect(evidence).toHaveTextContent('Inconclusive'); expect(evidence).toHaveTextContent('0.04, 0.05, 0.04 mm');
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  await user.click(screen.getByRole('button', { name: 'Remove measurement 1' }));
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  expect(screen.getByRole('article', { name: 'Captured decision sheet' }).textContent).toBe(captured);
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  await user.click(screen.getByRole('checkbox', { name: /Include the current B2 retest/ }));
  await user.click(screen.getByRole('button', { name: 'Capture new sheet' }));
  expect(screen.getByRole('region', { name: '03 / Measured' })).toHaveTextContent('QA-only B2');
  expect(screen.getByRole('region', { name: '03 / Measured' })).not.toHaveTextContent('QA-only B1');
  expect(ranker).toHaveBeenCalledTimes(2);
});

it('preserves separate case drafts across navigation, handles invalid entries, and clears raw values when the measured joint changes', async () => {
  render(<App />); const user = await setup();
  await user.click(screen.getByRole('button', { name: 'Save measurement' }));
  expect(screen.getByRole('alert')).toHaveTextContent('at least one raw reading');
  const rawLabel = 'Raw vertical readings (one per line)';
  await user.type(screen.getByLabelText(rawLabel), '0');
  await user.selectOptions(screen.getByLabelText('Design and load case'), screen.getByRole('option', { name: 'Retest B2 · Original' }));
  expect(screen.getByLabelText(rawLabel)).toHaveValue('');
  await user.selectOptions(screen.getByLabelText('Design and load case'), screen.getByRole('option', { name: 'Saved B1 · Original' }));
  expect(screen.getByLabelText(rawLabel)).toHaveValue('0');
  await user.click(screen.getByRole('button', { name: 'Build costs' }));
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  expect(screen.getByLabelText(rawLabel)).toHaveValue('0');
  await user.type(screen.getByLabelText('Instrument resolution (mm)'), '0.1');
  await user.selectOptions(screen.getByLabelText('Measured joint'), 'B3');
  expect(screen.getByLabelText(rawLabel)).toHaveValue('');
  expect(screen.getByLabelText('Instrument resolution (mm)')).toHaveValue('');
});

it('excludes another brace design and keeps the separately captured template unchanged across new trials', async () => {
  const ranker = vi.fn(rankBraces); render(<App ranker={ranker} />); const user = await setup();
  await saveReading(user, 'Saved B1 · With brace P2', 'Synthetic observation for P2 only.');
  await user.click(screen.getByRole('button', { name: 'Braced assembly template' }));
  const template = screen.getByRole('article', { name: 'Captured assembly template' });
  const captured = template.innerHTML;
  expect(within(template).getByRole('heading', { level: 1 })).toHaveTextContent('With brace P2');
  expect(screen.queryByRole('article', { name: 'Captured decision sheet' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Workbench' }));
  await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
  await user.click(screen.getByRole('radio', { name: 'P4' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  expect(screen.getByText(/No measurement recorded for these cases/)).toBeVisible();
  expect(screen.getByText(/1 saved observation\(s\) belong to other/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Captured template' }));
  expect(screen.getByRole('article', { name: 'Captured assembly template' }).innerHTML).toBe(captured);
  expect(ranker).toHaveBeenCalledTimes(3);
});
