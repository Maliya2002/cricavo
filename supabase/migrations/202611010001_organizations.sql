-- Additive, namespaced schema. Run once through the Supabase migration workflow.
begin;

create table public.cricavo_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.cricavo_memberships (
  organization_id uuid not null references public.cricavo_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'admin', 'organizer', 'scorer', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index cricavo_memberships_user_idx on public.cricavo_memberships(user_id);

alter table public.cricavo_organizations enable row level security;
alter table public.cricavo_memberships enable row level security;

-- Membership rows are visible only to that member. No direct client writes;
-- later invitation/role-management RPCs will enforce ownership and audit changes.
create policy cricavo_read_own_membership on public.cricavo_memberships
  for select to authenticated using (user_id = (select auth.uid()));
create policy cricavo_read_member_organization on public.cricavo_organizations
  for select to authenticated using (
    exists (select 1 from public.cricavo_memberships membership
      where membership.organization_id = cricavo_organizations.id
      and membership.user_id = (select auth.uid()))
  );

revoke all on public.cricavo_organizations, public.cricavo_memberships from anon, authenticated;
grant select on public.cricavo_organizations, public.cricavo_memberships to authenticated;

-- Atomic bootstrap, not a client-chosen owner or role. Fixed empty search_path
-- and qualified identifiers prevent object shadowing in this privileged routine.
create function public.cricavo_create_organization(organization_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  organization uuid;
begin
  if caller is null then raise exception 'Sign in to create an organization' using errcode = '42501'; end if;
  if organization_name is null or char_length(btrim(organization_name)) not between 2 and 80 then
    raise exception 'Organization name must be 2–80 characters' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));
  if (select count(*) from public.cricavo_organizations where owner_id = caller) >= 10 then
    raise exception 'Organization limit reached' using errcode = '23514';
  end if;
  insert into public.cricavo_organizations(name, owner_id)
    values (btrim(organization_name), caller) returning id into organization;
  insert into public.cricavo_memberships(organization_id, user_id, role)
    values (organization, caller, 'owner');
  return organization;
end;
$$;
revoke all on function public.cricavo_create_organization(text) from public, anon;
grant execute on function public.cricavo_create_organization(text) to authenticated;
commit;
