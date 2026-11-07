// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { rankBraces } from '../structures';
import { App } from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function prepare() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
  await user.click(screen.getByRole('button', { name: 'Compare build options' }));
  await user.click(screen.getByRole('button', { name: 'Load fictional example' }));
  return user;
}

it('captures the selected B1 trial while B2 is active and keeps that sheet after later edits', async () => {
  const ranker = vi.fn(rankBraces);
  render(<App ranker={ranker} />);
  const user = await prepare();
  await user.click(screen.getByRole('button', { name: 'Decision sheet' }));
  const sheet = screen.getByRole('article', { name: 'Captured decision sheet' });
  const captured = sheet.textContent;
  expect(within(sheet).getByRole('region', { name: '02 / Predicted' })).toHaveTextContent('1.09%');
  expect(sheet).not.toHaveTextContent('10.46%');
  expect(sheet).toHaveTextContent('No measurement recorded.');
  expect(sheet).toHaveTextContent('−1.373 N (compression)');
  expect(sheet).toHaveTextContent('$26,677.18');
  expect(sheet).toHaveTextContent('Fictional demo assumption');
  expect(within(sheet).getAllByRole('region')).toHaveLength(5);
  const original = within(sheet).getByRole('img', { name: /Original.*10 N at B1/ });
  const modified = within(sheet).getByRole('img', { name: /Modified.*10 N at B1/ });
  expect(original.querySelectorAll('line')).toHaveLength(34);
  expect(modified.querySelectorAll('line')).toHaveLength(36);
  expect(ranker).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: 'Compare build options' }));
  const years = screen.getByLabelText('Horizon (years)'); await user.clear(years); await user.type(years, '5');
  await user.click(screen.getByRole('button', { name: 'Experiment' }));
  expect(screen.getByRole('region', { name: 'Same-brace retest' })).toHaveTextContent('10.46%');
  await user.click(screen.getByRole('radio', { name: 'B3 Right' }));
  await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
  await user.click(screen.getByRole('radio', { name: 'P4' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  expect(screen.getByRole('article', { name: 'Captured decision sheet' }).textContent).toBe(captured);
  await user.click(screen.getByRole('button', { name: 'Experiment' }));
  await user.click(screen.getByRole('button', { name: 'Capture new sheet' }));
  expect(screen.getByRole('article')).toHaveTextContent('5 years');
  expect(screen.getByRole('article').textContent).not.toBe(captured);
  expect(ranker).toHaveBeenCalledTimes(4);
});

it('includes a retest only when explicitly checked, then prints that captured payload', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<App />);
  const user = await prepare();
  await user.click(screen.getByRole('checkbox', { name: /Include the current B2 retest/ }));
  await user.click(screen.getByRole('button', { name: 'Decision sheet' }));
  const sheet = screen.getByRole('article');
  expect(sheet).toHaveTextContent('Scenario R'); expect(sheet).toHaveTextContent('10.46%');
  expect(sheet).toHaveTextContent('P2 + P3 (tie)'); expect(sheet).toHaveTextContent('1.09%');
  const captured = sheet.textContent;
  await user.click(screen.getByRole('button', { name: 'Print / Save PDF' }));
  expect(print).toHaveBeenCalledOnce();
  expect(screen.getByRole('article').textContent).toBe(captured);
});

it('gates capture on a selected trial and valid settings, but allows unknown amounts', async () => {
  render(<App />);
  const user = userEvent.setup();
  expect(screen.getByRole('button', { name: 'Decision sheet' })).toBeDisabled();
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  expect(screen.getByRole('button', { name: 'Decision sheet' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Compare build options' }));
  await user.type(screen.getByLabelText('Common scope and level of service'), 'Equal service; quotes pending');
  await user.click(screen.getByRole('button', { name: 'Decision sheet' }));
  expect(screen.getByRole('article')).toHaveTextContent('Unknown');
  expect(screen.getByRole('article')).not.toHaveTextContent('$19,000');
  await user.click(screen.getByRole('button', { name: 'Compare build options' }));
  await user.clear(screen.getByLabelText('Horizon (years)'));
  expect(screen.getByRole('button', { name: 'Capture new sheet' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Experiment' }));
  await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
  expect(screen.getByRole('button', { name: 'Capture new sheet' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  expect(screen.getByRole('article')).toHaveTextContent('Equal service; quotes pending');
});

it('blocks one-page printing when measured content overflows without truncating the snapshot', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1100);
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<App />);
  const user = await prepare();
  await user.click(screen.getByRole('button', { name: 'Decision sheet' }));
  expect(screen.getByRole('button', { name: 'Print / Save PDF' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('exceeds one Letter page');
  expect(screen.getByRole('article')).toHaveTextContent('Open assumptions');
  expect(screen.getByRole('button', { name: 'Download snapshot JSON' })).toBeEnabled();
  expect(print).not.toHaveBeenCalled();
});
