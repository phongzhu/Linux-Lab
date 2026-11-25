create table if not exists public.linuxlab_sre_kiosk_attempts (
  id uuid not null default gen_random_uuid(),
  app_user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null check (scenario_id in ('cpu-network', 'storage', 'vpn-access')),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_user_id, id)
);

create index if not exists linuxlab_sre_kiosk_attempts_owner_updated_idx
  on public.linuxlab_sre_kiosk_attempts (app_user_id, updated_at desc);

alter table public.linuxlab_sre_kiosk_attempts enable row level security;
revoke all on public.linuxlab_sre_kiosk_attempts from public, anon;
grant select, insert, update, delete on public.linuxlab_sre_kiosk_attempts to authenticated;

drop policy if exists "Users access their own SRE kiosk attempts" on public.linuxlab_sre_kiosk_attempts;
create policy "Users access their own SRE kiosk attempts"
  on public.linuxlab_sre_kiosk_attempts for all to authenticated
  using ((select auth.uid()) = app_user_id)
  with check ((select auth.uid()) = app_user_id);

create or replace function public.set_linuxlab_sre_kiosk_attempt_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.set_linuxlab_sre_kiosk_attempt_updated_at() from public, anon, authenticated;
drop trigger if exists set_linuxlab_sre_kiosk_attempt_updated_at on public.linuxlab_sre_kiosk_attempts;
create trigger set_linuxlab_sre_kiosk_attempt_updated_at
  before update on public.linuxlab_sre_kiosk_attempts
  for each row execute function public.set_linuxlab_sre_kiosk_attempt_updated_at();
