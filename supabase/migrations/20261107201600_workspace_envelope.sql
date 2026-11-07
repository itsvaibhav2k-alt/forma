-- CHECK constraints must reject missing fields, rather than evaluating to NULL.
alter table public.projects add constraint workspace_version_required
  check (workspace @> '{"schemaVersion":1}'::jsonb);
