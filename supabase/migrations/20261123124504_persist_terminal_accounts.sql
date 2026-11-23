create table if not exists public.linuxlab_terminal_accounts (
  app_user_id uuid not null references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-z_][a-z0-9_-]{0,31}$'),
  uid integer not null check (uid >= 1000),
  groups text[] not null default '{}',
  password_salt text,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_user_id, username),
  unique (app_user_id, uid),
  constraint terminal_password_hash_pair check (
    (password_salt is null and password_hash is null)
    or (password_salt is not null and password_hash is not null)
  )
);

create index if not exists linuxlab_terminal_accounts_owner_uid_idx
  on public.linuxlab_terminal_accounts (app_user_id, uid);

alter table public.linuxlab_terminal_accounts enable row level security;

revoke all on public.linuxlab_terminal_accounts from public, anon;
grant select, insert, update on public.linuxlab_terminal_accounts to authenticated;

drop policy if exists "Users read their own LinuxLab machine accounts" on public.linuxlab_terminal_accounts;
create policy "Users read their own LinuxLab machine accounts"
  on public.linuxlab_terminal_accounts for select to authenticated
  using ((select auth.uid()) = app_user_id);

drop policy if exists "Users create their own LinuxLab machine accounts" on public.linuxlab_terminal_accounts;
create policy "Users create their own LinuxLab machine accounts"
  on public.linuxlab_terminal_accounts for insert to authenticated
  with check ((select auth.uid()) = app_user_id);

drop policy if exists "Users update their own LinuxLab machine accounts" on public.linuxlab_terminal_accounts;
create policy "Users update their own LinuxLab machine accounts"
  on public.linuxlab_terminal_accounts for update to authenticated
  using ((select auth.uid()) = app_user_id)
  with check ((select auth.uid()) = app_user_id);

create or replace function public.set_linuxlab_terminal_account_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_linuxlab_terminal_account_updated_at() from public, anon, authenticated;

drop trigger if exists set_linuxlab_terminal_account_updated_at on public.linuxlab_terminal_accounts;
create trigger set_linuxlab_terminal_account_updated_at
  before update on public.linuxlab_terminal_accounts
  for each row execute function public.set_linuxlab_terminal_account_updated_at();
