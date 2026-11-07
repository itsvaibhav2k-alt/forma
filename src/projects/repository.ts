import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseWorkspace, type Workspace } from './workspace';

const metadata = z.object({ id: z.uuid(), name: z.string().min(1).max(120), version: z.number().int().positive(), created_at: z.string(), updated_at: z.string() });
export type Project = z.infer<typeof metadata>;
export interface SaveProject { id: string; name: string; workspace: Workspace; expectedVersion: number | null; writeId: string }
const columns = 'id,name,version,created_at,updated_at';
export function projectRepository(client: SupabaseClient) {
  return {
    async list(): Promise<Project[]> {
      const { data, error } = await client.from('projects').select(columns).order('updated_at', { ascending: false }).limit(100);
      if (error) throw new Error('Could not load projects. Check your connection and try again.');
      return z.array(metadata).parse(data);
    },
    async open(id: string): Promise<{ project: Project; workspace: Workspace }> {
      const { data, error } = await client.from('projects').select(`${columns},workspace`).eq('id', id).single();
      if (error) throw new Error('This project is unavailable or you do not have access. Your current work is unchanged.');
      return { project: metadata.parse(data), workspace: parseWorkspace(data.workspace) };
    },
    async save(input: SaveProject): Promise<Project> {
      const workspace = parseWorkspace(input.workspace);
      const name = input.name.trim();
      if (!name || name.length > 120) throw new Error('Use a project name between 1 and 120 characters.');
      const { data, error } = await client.rpc('save_project', { project_id: input.id, project_name: name, project_workspace: workspace, expected_version: input.expectedVersion, write_id: input.writeId });
      if (error) {
        if (error.code === '40001') throw new Error('This project changed elsewhere. Open the latest version or save a copy to keep your work.');
        if (error.code === '42501') throw new Error('Sign in with the account that owns this project.');
        throw new Error('Save could not be confirmed. Your work is still here. Try again; a repeated save will not create a duplicate.');
      }
      return metadata.parse(data?.[0]);
    },
  };
}
