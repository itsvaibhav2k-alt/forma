import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { projectRepository } from './repository';
import { savedWorkspace } from '../test/workspace';

const input = () => ({ id: crypto.randomUUID(), name: 'Lab', workspace: savedWorkspace(), expectedVersion: 2, writeId: crypto.randomUUID() });
it('sends the expected revision and stable write token, never an owner ID', async () => {
  const value = input(), rpc = vi.fn().mockResolvedValue({ data: [{ id: value.id, name: 'Lab', version: 3, created_at: 'now', updated_at: 'now' }], error: null });
  const repo = projectRepository({ rpc } as unknown as SupabaseClient);
  expect((await repo.save(value)).version).toBe(3);
  expect(rpc).toHaveBeenCalledWith('save_project', { project_id: value.id, project_name: 'Lab', project_workspace: value.workspace, expected_version: 2, write_id: value.writeId });
});
it('surfaces conflict and network failures rather than claiming a save', async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ error: { code: '40001' } }).mockResolvedValueOnce({ error: { code: 'FETCH_ERROR' } });
  const repo = projectRepository({ rpc } as unknown as SupabaseClient);
  await expect(repo.save(input())).rejects.toThrow('changed elsewhere');
  await expect(repo.save(input())).rejects.toThrow('could not be confirmed');
});
it('rejects invalid project names before sending any request', async () => {
  const rpc = vi.fn(), repo = projectRepository({ rpc } as unknown as SupabaseClient);
  await expect(repo.save({ ...input(), name: ' ' })).rejects.toThrow('project name');
  expect(rpc).not.toHaveBeenCalled();
});
