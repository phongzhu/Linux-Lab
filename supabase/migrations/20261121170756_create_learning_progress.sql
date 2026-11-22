create table if not exists public.training_lessons (
  id text primary key,
  unit_number integer not null check (unit_number between 1 and 5),
  lesson_number integer not null check (lesson_number between 1 and 3),
  unit_title text not null,
  unit_color text not null,
  unit_subtitle text not null,
  title text not null,
  duration text not null,
  concept text not null,
  scenario text not null,
  objectives jsonb not null,
  recap jsonb not null,
  starting_environment jsonb not null,
  unique(unit_number, lesson_number)
);

create table if not exists public.learning_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  completed_lessons text[] not null default '{}',
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_learning_day date,
  timezone text not null default 'Asia/Manila',
  updated_at timestamptz not null default now()
);

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.training_lessons(id),
  state jsonb not null,
  completed_tasks text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_attempts_user_status_idx on public.training_attempts(user_id, status, updated_at desc);

create table if not exists public.training_command_history (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.training_attempts(id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  command text not null check (char_length(command) <= 256),
  cwd text not null default '/home/learner',
  output text not null default '' check (char_length(output) <= 20000),
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists training_command_history_attempt_idx on public.training_command_history(attempt_id, id);

create table if not exists public.learning_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  completed_lessons integer not null default 0,
  primary key (user_id, activity_date)
);

alter table public.training_lessons enable row level security;
alter table public.learning_progress enable row level security;
alter table public.training_attempts enable row level security;
alter table public.training_command_history enable row level security;
alter table public.learning_activity enable row level security;

grant select on public.training_lessons to authenticated;
grant select, insert, update on public.learning_progress to authenticated;
grant select, insert, update on public.training_attempts to authenticated;
grant select, insert on public.training_command_history to authenticated;
grant select, insert, update on public.learning_activity to authenticated;

drop policy if exists "Learners read their own progress" on public.learning_progress;
drop policy if exists "Learners create their own progress" on public.learning_progress;
drop policy if exists "Learners update their own progress" on public.learning_progress;
create policy "Learners read their own progress" on public.learning_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners create their own progress" on public.learning_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners update their own progress" on public.learning_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Signed in learners read course lessons" on public.training_lessons for select to authenticated using (true);
create policy "Learners manage their own attempts" on public.training_attempts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Learners read and create their command history" on public.training_command_history for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Learners manage their activity" on public.learning_activity for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.record_attempt_command(
  p_attempt_id uuid,
  p_command text,
  p_output text,
  p_succeeded boolean,
  p_state jsonb,
  p_completed_tasks text[],
  p_complete_lesson boolean
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.training_attempts%rowtype;
  v_progress public.learning_progress%rowtype;
  v_today date;
  v_awarded integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(p_command) > 256 then raise exception 'Command is too long'; end if;
  select * into v_attempt from public.training_attempts where id = p_attempt_id and user_id = v_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status <> 'active' then raise exception 'Attempt is not active'; end if;

  insert into public.training_command_history(attempt_id, user_id, command, cwd, output, succeeded)
  values (p_attempt_id, v_user_id, p_command, coalesce(p_state ->> 'cwd', '/home/learner'), left(p_output, 20000), p_succeeded);
  update public.training_attempts
  set state = p_state, completed_tasks = p_completed_tasks, updated_at = now()
  where id = p_attempt_id and user_id = v_user_id;

  if p_complete_lesson then
    insert into public.learning_progress(user_id) values (v_user_id) on conflict (user_id) do nothing;
    select * into v_progress from public.learning_progress where user_id = v_user_id for update;
    if not (v_attempt.lesson_id = any(v_progress.completed_lessons)) then
      v_today := (now() at time zone v_progress.timezone)::date;
      v_awarded := 30;
      update public.learning_progress
      set completed_lessons = array_append(completed_lessons, v_attempt.lesson_id),
          xp = xp + v_awarded,
          streak = case when last_learning_day = v_today then streak when last_learning_day = v_today - 1 then streak + 1 else 1 end,
          last_learning_day = v_today,
          updated_at = now()
      where user_id = v_user_id;
      insert into public.learning_activity(user_id, activity_date, completed_lessons)
      values (v_user_id, v_today, 1)
      on conflict (user_id, activity_date) do update set completed_lessons = public.learning_activity.completed_lessons + 1;
    end if;
    update public.training_attempts set status = 'completed', updated_at = now() where id = p_attempt_id and user_id = v_user_id;
  end if;

  select * into v_progress from public.learning_progress where user_id = v_user_id;
  return jsonb_build_object('awarded_xp', v_awarded, 'progress', to_jsonb(v_progress));
end;
$$;

revoke all on function public.record_attempt_command(uuid, text, text, boolean, jsonb, text[], boolean) from public, anon;
grant execute on function public.record_attempt_command(uuid, text, text, boolean, jsonb, text[], boolean) to authenticated;

create or replace function public.reset_learning_progress()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress public.learning_progress%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.training_attempts where user_id = v_user_id;
  delete from public.learning_activity where user_id = v_user_id;
  insert into public.learning_progress(user_id) values (v_user_id) on conflict (user_id) do update
    set completed_lessons = '{}', xp = 0, streak = 0, last_learning_day = null, updated_at = now();
  select * into v_progress from public.learning_progress where user_id = v_user_id;
  return to_jsonb(v_progress);
end;
$$;

revoke all on function public.reset_learning_progress() from public, anon;
grant execute on function public.reset_learning_progress() to authenticated;
