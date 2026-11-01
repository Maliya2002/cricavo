begin;
-- Immutable personal snapshots: a second device cannot overwrite newer scores.
create table public.cricavo_match_backups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  match_id uuid not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint backup_size check (octet_length(snapshot::text) <= 2000000),
  constraint backup_shape check (
    jsonb_typeof(snapshot) = 'object' and
    snapshot @> '{"schemaVersion":1}'::jsonb and
    jsonb_typeof(snapshot->'events') = 'array' and
    jsonb_typeof(snapshot->'settings') = 'object' and
    snapshot->>'id' = match_id::text
  )
);
create index cricavo_backups_owner_date on public.cricavo_match_backups(owner_id, created_at desc);
alter table public.cricavo_match_backups enable row level security;
revoke all on public.cricavo_match_backups from anon, authenticated;
grant select, insert on public.cricavo_match_backups to authenticated;
create policy backup_owner_read on public.cricavo_match_backups for select to authenticated
  using (owner_id = (select auth.uid()));
create policy backup_owner_insert on public.cricavo_match_backups for insert to authenticated
  with check (owner_id = (select auth.uid()) and snapshot ?& array['id','schemaVersion','events','settings']);
commit;
