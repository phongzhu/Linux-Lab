-- Durable Express sessions for serverless deployments.
-- The backend connects with its private Postgres DATABASE_URL. The public Data API
-- must not expose session cookies or authentication tokens stored in this table.
create table if not exists public.linuxlab_sessions (
  sid varchar not null,
  sess json not null,
  expire timestamp(6) not null,
  constraint linuxlab_sessions_pkey primary key (sid)
);

create index if not exists idx_linuxlab_sessions_expire
  on public.linuxlab_sessions (expire);

alter table public.linuxlab_sessions enable row level security;
revoke all privileges on table public.linuxlab_sessions from public, anon, authenticated, service_role;
