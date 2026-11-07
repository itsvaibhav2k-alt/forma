// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AUTOSAVE_DELAY_MS, ConnectedWorkspace } from './ProjectApp';
import { projectRepository } from './repository';
import { savedWorkspace } from '../test/workspace';

vi.mock('./repository', () => ({ projectRepository: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const project = { id: 'c0cddff1-a190-4e23-9445-3e5844eb1122', name: 'Bridge lab', version: 1, created_at: '2026-11-07T20:00:00Z', updated_at: '2026-11-07T20:00:00Z' };
const account = (id = 'owner-a') => ({ user: { id, email: `${id}@example.test` } }) as Session;
function setup() {
  let callback: (event: string, session: Session | null) => void = () => {};
  const repo = { list: vi.fn().mockResolvedValue([project]), open: vi.fn().mockResolvedValue({ project, workspace: savedWorkspace() }), save: vi.fn().mockResolvedValue(project) };
  vi.mocked(projectRepository).mockReturnValue(repo);
  const client = { auth: { onAuthStateChange: vi.fn((cb: typeof callback) => { callback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; }), signOut: vi.fn(async () => { callback('SIGNED_OUT', null); return { error: null }; }) } } as unknown as SupabaseClient;
  render(<ConnectedWorkspace client={client} />);
  act(() => callback('INITIAL_SESSION', account()));
  return { repo, client, user: userEvent.setup(), emit: (session: Session | null) => act(() => callback('SIGNED_IN', session)) };
}
async function panel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Projects & account' }));
  await screen.findByRole('button', { name: 'Open Bridge lab' });
}
it('opens saved trials, quote inputs, readings and captured artifacts together', async () => {
  const { user } = setup(); await panel(user);
  await user.click(screen.getByRole('button', { name: 'Open Bridge lab' }));
  expect(await screen.findByText('Opened “Bridge lab”.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Captured template' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Captured sheet' }));
  expect(screen.getByRole('article', { name: 'Captured decision sheet' })).toHaveTextContent('saved-report');
  await user.click(screen.getByRole('button', { name: 'Physical evidence' }));
  expect(screen.getByRole('article', { name: 'Measurement 1' })).toHaveTextContent('Synthetic test');
  expect(within(screen.getByRole('region', { name: 'Projects' })).getByText('Saved', { exact: true })).toBeVisible();
});
it('protects unsaved changes when opening or starting another workspace', async () => {
  const { user, repo } = setup(); await panel(user);
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Open Bridge lab' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('unsaved changes');
  expect(repo.open).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'New workspace' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
  expect(screen.getByRole('radio', { name: 'P2' })).not.toBeChecked();
});
it('keeps work after a failed save and reuses the write token on retry', async () => {
  const { user, repo } = setup(); await panel(user);
  repo.save.mockRejectedValueOnce(new Error('Save could not be confirmed.')).mockResolvedValueOnce(project);
  await user.type(screen.getByLabelText('Project name'), 'Bridge lab');
  await user.click(screen.getByRole('radio', { name: 'P2' }));
  await user.click(screen.getByRole('button', { name: 'Save project' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
  expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Save project' }));
  await screen.findByText('Saved “Bridge lab”.');
  expect(repo.save.mock.calls[0]?.[0]).toEqual(repo.save.mock.calls[1]?.[0]);
});
it('ignores a late project response after the account changes', async () => {
  const { user, repo, emit } = setup(); await panel(user);
  let resolve!: (value: Awaited<ReturnType<typeof repo.open>>) => void;
  repo.open.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await user.click(screen.getByRole('button', { name: 'Open Bridge lab' }));
  emit(account('owner-b'));
  await act(async () => resolve({ project, workspace: savedWorkspace() }));
  expect(screen.queryByRole('button', { name: 'Captured sheet' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'P2' })).not.toBeChecked();
  expect(screen.getByText('owner-b@example.test')).toBeVisible();
});
it('clears private workspace and list on sign-out', async () => {
  const { user } = setup(); await panel(user);
  await user.click(screen.getByRole('button', { name: 'Open Bridge lab' }));
  await screen.findByText('Opened “Bridge lab”.');
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Captured sheet' })).toBeNull());
  expect(screen.queryByRole('button', { name: 'Open Bridge lab' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

async function opened() {
  const value = setup(); await panel(value.user);
  await value.user.click(screen.getByRole('button', { name: 'Open Bridge lab' }));
  await screen.findByText('Opened “Bridge lab”.');
  value.repo.save.mockImplementation(async input => ({ ...project, name: input.name.trim(), version: (input.expectedVersion ?? 0) + 1 }));
  vi.useFakeTimers();
  return value;
}
async function advance(ms = AUTOSAVE_DELAY_MS) { await act(async () => { vi.advanceTimersByTime(ms); }); }

it('debounces rapid edits and saves only the latest content of an existing project', async () => {
  const { repo } = await opened();
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'First edit' } });
  await advance(AUTOSAVE_DELAY_MS - 1);
  expect(repo.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Latest edit' } });
  await advance(AUTOSAVE_DELAY_MS - 1);
  expect(repo.save).not.toHaveBeenCalled();
  await advance(1);
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(repo.save.mock.calls[0]?.[0]).toMatchObject({ id: project.id, name: 'Latest edit', expectedVersion: 1 });
  expect(within(screen.getByRole('region', { name: 'Projects' })).getByRole('status')).toHaveTextContent(/^Saved$/);
  await advance(10_000);
  expect(repo.save).toHaveBeenCalledTimes(1);
});

it('never creates a project automatically, but enables autosave after its first explicit save', async () => {
  const { user, repo } = setup(); await panel(user); vi.useFakeTimers();
  repo.save.mockImplementation(async input => ({ ...project, name: input.name, version: (input.expectedVersion ?? 0) + 1 }));
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'New lab' } });
  await advance(10_000);
  expect(repo.save).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save project' })); });
  expect(repo.save).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Renamed lab' } });
  await advance();
  expect(repo.save).toHaveBeenCalledTimes(2);
  expect(repo.save.mock.calls[1]?.[0]).toMatchObject({ name: 'Renamed lab', expectedVersion: 1 });
});

it('queues edits made during a save and uses the acknowledged version for the next save', async () => {
  const { repo } = await opened();
  let resolve!: (value: typeof project) => void;
  repo.save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByRole('radio', { name: 'B3 Right' }));
  await advance();
  expect(screen.getByText('Saving…', { exact: true })).toBeVisible();
  expect(repo.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('radio', { name: 'B1 Left' }));
  const close = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(close);
  expect(close.defaultPrevented).toBe(true);
  await advance(10_000);
  expect(repo.save).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ...project, version: 2 }));
  expect(screen.getByText('Unsaved changes · autosave pending')).toBeVisible();
  await advance();
  expect(repo.save).toHaveBeenCalledTimes(2);
  expect(repo.save.mock.calls[1]?.[0]).toMatchObject({ expectedVersion: 2, workspace: { experiment: { retest: { status: 'ready', value: { load: { nodeId: 'B1' } } } } } });
});

it('pauses after a failed autosave and retains its token for an explicit retry', async () => {
  const { repo } = await opened();
  repo.save.mockRejectedValueOnce(new Error('Connection lost.'));
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Offline edit' } });
  await advance();
  expect(screen.getByText('Save failed — autosave paused')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
  await advance(60_000);
  expect(repo.save).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry save' })); });
  expect(repo.save.mock.calls[0]?.[0]).toEqual(repo.save.mock.calls[1]?.[0]);
  expect(screen.queryByText('Save failed — autosave paused')).toBeNull();
});

it('does not auto-retry a conflict even when the user makes further edits', async () => {
  const { repo } = await opened();
  repo.save.mockRejectedValueOnce(new Error('This project changed elsewhere. Open the latest version or save a copy.'));
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Conflicting edit' } });
  await advance();
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Still local' } });
  await advance(60_000);
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Project name')).toHaveValue('Still local');
  expect(screen.getByRole('button', { name: 'Save a copy' })).toBeEnabled();
});

it('cancels a pending autosave on account changes and while a discard decision is open', async () => {
  const { repo, emit } = await opened();
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Unsaved edit' } });
  fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
  await advance(10_000);
  expect(repo.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  emit(account('owner-b'));
  await advance(10_000);
  expect(repo.save).not.toHaveBeenCalled();
});

it('ignores an autosave acknowledgement that arrives after an account switch', async () => {
  const { repo, emit } = await opened();
  let resolve!: (value: typeof project) => void;
  repo.save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Old account edit' } });
  await advance();
  expect(repo.save).toHaveBeenCalledTimes(1);
  emit(account('owner-b'));
  await act(async () => resolve({ ...project, name: 'Old account edit', version: 2 }));
  expect(screen.getByLabelText('Project name')).toHaveValue('');
  expect(screen.queryByText('Old account edit')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Captured sheet' })).toBeNull();
  await advance(10_000);
  expect(repo.save).toHaveBeenCalledTimes(1);
});
