-- Feature 1: private, durable workspaces. Calculations remain client-originated;
-- authoritative server calculations and immutable revision history are feature 2.
create table public.projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  workspace jsonb not null check (
    jsonb_typeof(workspace) = 'object' and workspace->>'schemaVersion' = '1'
    and workspace ?& array['experiment', 'quotes', 'measurements', 'report', 'pattern', 'includeRetest']
    and octet_length(workspace::text) <= 2097152
  ),
  version integer not null default 1 check (version > 0),
  last_write_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_updated on public.projects (owner_id, updated_at desc, id);
alter table public.projects enable row level security;
create policy projects_read_own on public.projects for select to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;

-- All writes go through one transaction. Callers cannot assign ownership,
-- timestamps or a revision counter, or bypass compare-and-swap via a direct update.
create function public.save_project(
  project_id uuid, project_name text, project_workspace jsonb,
  expected_version integer, write_id uuid
) returns table (id uuid, name text, version integer, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  existing public.projects%rowtype;
begin
  if account_id is null then raise exception 'Sign in to save a project.' using errcode = '42501'; end if;
  if project_id is null or write_id is null or project_name is null or project_workspace is null then
    raise exception 'Project fields are required.' using errcode = '22023';
  end if;
  -- Serializes competing creates as well as updates for this project ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(project_id::text, 0));
  select * into existing from public.projects p where p.id = project_id;
  if found then
    if existing.owner_id <> account_id then
      raise exception 'Project unavailable.' using errcode = '42501';
    end if;
    if existing.last_write_id = write_id then
      if existing.name <> btrim(project_name) or existing.workspace <> project_workspace then
        raise exception 'A save token cannot be reused for different content.' using errcode = '22023';
      end if;
      return query select p.id, p.name, p.version, p.created_at, p.updated_at from public.projects p where p.id = project_id;
      return;
    end if;
    if expected_version is null or existing.version <> expected_version then
      raise exception 'This project changed elsewhere. Open the latest version or save a copy.' using errcode = '40001';
    end if;
    update public.projects p set name = btrim(project_name), workspace = project_workspace,
      version = p.version + 1, last_write_id = write_id, updated_at = clock_timestamp() where p.id = project_id;
  else
    if expected_version is not null then
      raise exception 'Project unavailable. Save a copy instead.' using errcode = '40001';
    end if;
    insert into public.projects (id, owner_id, name, workspace, last_write_id)
      values (project_id, account_id, btrim(project_name), project_workspace, write_id);
  end if;
  return query select p.id, p.name, p.version, p.created_at, p.updated_at from public.projects p where p.id = project_id;
end;
$$;
revoke all on function public.save_project(uuid, text, jsonb, integer, uuid) from public, anon;
grant execute on function public.save_project(uuid, text, jsonb, integer, uuid) to authenticated;
