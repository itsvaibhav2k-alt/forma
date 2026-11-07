// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import legacyWorkspace from '../test/legacy-workspace.json';
import { parseWorkspace, type Workspace } from '../projects/workspace';
import { rankBraces, SOLVER_VERSION } from '../structures';
import { experimentReducer } from './experiment/state';
import { App } from './App';

afterEach(cleanup);
it('opens legacy evidence read-only, preserves its frozen sheet, and starts new current-solver trials', async () => {
  const initial = parseWorkspace(legacyWorkspace), ranker = vi.fn(rankBraces);
  const change = vi.fn<(workspace: Workspace) => void>();
  const originalReport = JSON.stringify(initial.report);
  render(<App initialWorkspace={initial} ranker={ranker} onWorkspaceChange={change} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Structural' }));
  expect(screen.getByRole('region', { name: 'Earlier solver result' })).toBeVisible();
  expect(screen.getByRole('radio', { name: 'B3 Right' })).toBeDisabled();
  expect(screen.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
  expect(ranker).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  const captured = screen.getByRole('article', { name: 'Captured decision sheet' }).textContent;
  await user.click(screen.getByRole('button', { name: 'Workbench' }));
  await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
  expect(screen.getByText('Results hidden')).toBeVisible();
  await user.click(screen.getByRole('radio', { name: 'P4' }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  const current = change.mock.calls.at(-1)![0];
  expect(current.experiment.trials).toHaveLength(2);
  expect(current.experiment.trials[0]).toEqual(initial.experiment.trials[0]);
  expect(current.experiment.trials[1]?.solverVersion).toBe(SOLVER_VERSION);
  expect(JSON.stringify(current.report)).toBe(originalReport);
  expect(() => parseWorkspace(current)).not.toThrow();
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  expect(screen.getByRole('article', { name: 'Captured decision sheet' }).textContent).toBe(captured);
});

it('rejects a new-solver retest of a legacy trial at the controller boundary', () => {
  const initial = parseWorkspace(legacyWorkspace).experiment;
  const trial = initial.trials[0]!;
  const load = { nodeId: 'B3', fxN: 0, fyN: -10 } as const;
  const results = rankBraces(trial.results.baseline.design, load);
  if (results.status !== 'ok') throw new Error(results.message);
  expect(experimentReducer(initial, { type: 'retest/show', value: { sourceTrialId: trial.id, chosenPanelId: trial.chosenPanelId, load, results } })).toBe(initial);
});
