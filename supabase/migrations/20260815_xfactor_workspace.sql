-- xFactor.OS cloud mirror. Local WorkspaceState remains the interaction source of truth.
create table if not exists public.xfactor_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 2,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.xfactor_workspaces enable row level security;

drop policy if exists "xfactor workspace select own" on public.xfactor_workspaces;
create policy "xfactor workspace select own" on public.xfactor_workspaces
  for select using (auth.uid() = owner_id);

drop policy if exists "xfactor workspace insert own" on public.xfactor_workspaces;
create policy "xfactor workspace insert own" on public.xfactor_workspaces
  for insert with check (auth.uid() = owner_id);

drop policy if exists "xfactor workspace update own" on public.xfactor_workspaces;
create policy "xfactor workspace update own" on public.xfactor_workspaces
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
