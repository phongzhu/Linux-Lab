-- Repair older lesson and attempt snapshots whose file maps omitted parents.
-- Keep all existing files, task completions, XP, and progress records.
alter table public.training_command_history
  add column if not exists cwd_before text,
  add column if not exists cwd_after text,
  add column if not exists stdout text,
  add column if not exists stderr text,
  add column if not exists exit_code integer;

with ordered as (
  select h.id,
         coalesce(lag(h.cwd) over (partition by h.attempt_id order by h.id),
           l.starting_environment #>> '{cwd}', '/home/learner') as cwd_before,
         coalesce(h.cwd, '/home/learner') as cwd_after,
         case when h.succeeded then h.output else '' end as stdout,
         case when h.succeeded then ''
              when h.output like '✖ grep: no lines matched%' then ''
              else h.output end as stderr,
         case when h.succeeded then 0
              when h.output like '✖ command not found:%' then 127
              when h.output like '✖ grep: no lines matched%' then 1
              else 1 end as exit_code
    from public.training_command_history h
    join public.training_attempts a on a.id = h.attempt_id
    join public.training_lessons l on l.id = a.lesson_id
)
update public.training_command_history h
set cwd_before = ordered.cwd_before,
    cwd_after = ordered.cwd_after,
    stdout = left(ordered.stdout, 20000),
    stderr = left(ordered.stderr, 20000),
    exit_code = ordered.exit_code
from ordered where h.id = ordered.id;

update public.training_command_history
set cwd_before = coalesce(cwd_before, cwd, '/home/learner'),
    cwd_after = coalesce(cwd_after, cwd, '/home/learner'),
    stdout = coalesce(stdout, case when succeeded then output else '' end),
    stderr = coalesce(stderr, case when succeeded then '' else output end),
    exit_code = coalesce(exit_code, case when succeeded then 0 else 1 end);

alter table public.training_command_history
  alter column cwd_before set not null,
  alter column cwd_after set not null,
  alter column stdout set default '',
  alter column stdout set not null,
  alter column stderr set default '',
  alter column stderr set not null,
  alter column exit_code set not null;

-- Add every missing ancestor directory to each saved virtual filesystem.
-- This repairs snapshots in place and preserves the learner's state.
with snapshots as (
  select 'lesson'::text as kind, id::text as row_id, starting_environment as state
    from public.training_lessons
  union all
  select 'attempt', id::text, state from public.training_attempts
), paths as (
  select s.kind, s.row_id, e.key as path,
         string_to_array(trim(both '/' from e.key), '/') as parts,
         e.value as node
    from snapshots s
    cross join lateral jsonb_each(coalesce(s.state->'files', '{}'::jsonb)) e
), ancestors as (
  select p.kind, p.row_id,
         '/' || array_to_string(p.parts[1:d.depth], '/') as path
    from paths p
    cross join lateral generate_series(1, greatest(cardinality(p.parts) - 1, 0)) as d(depth)
   where p.node->>'type' <> 'dir'
), required_dirs as (
  select kind, row_id, path, jsonb_build_object('type', 'dir') as node from ancestors
  union all
  select kind, row_id, '/' as path, jsonb_build_object('type', 'dir') as node from snapshots
), additions as (
  select r.kind, r.row_id,
         jsonb_object_agg(r.path, r.node) filter (where s.state->'files'->r.path is null) as files
    from required_dirs r
    join snapshots s on s.kind = r.kind and s.row_id = r.row_id
   group by r.kind, r.row_id
)
update public.training_lessons l
   set starting_environment = jsonb_set(l.starting_environment, '{files}',
       coalesce(l.starting_environment->'files', '{}'::jsonb) || coalesce(a.files, '{}'::jsonb), true)
  from additions a where a.kind = 'lesson' and a.row_id = l.id and a.files is not null;

with snapshots as (
  select id::text as row_id, state from public.training_attempts
), paths as (
  select s.row_id, e.key as path,
         string_to_array(trim(both '/' from e.key), '/') as parts,
         e.value as node
    from snapshots s
    cross join lateral jsonb_each(coalesce(s.state->'files', '{}'::jsonb)) e
), required_dirs as (
  select p.row_id, '/' || array_to_string(p.parts[1:d.depth], '/') as path,
         jsonb_build_object('type', 'dir') as node
    from paths p
    cross join lateral generate_series(1, greatest(cardinality(p.parts) - 1, 0)) as d(depth)
   where p.node->>'type' <> 'dir'
  union all
  select row_id, '/', jsonb_build_object('type', 'dir') from snapshots
), additions as (
  select r.row_id,
         jsonb_object_agg(r.path, r.node) filter (where s.state->'files'->r.path is null) as files
    from required_dirs r join snapshots s using (row_id)
   group by r.row_id
)
update public.training_attempts a
   set state = jsonb_set(a.state, '{files}',
       coalesce(a.state->'files', '{}'::jsonb) || coalesce(additions.files, '{}'::jsonb), true)
  from additions where additions.row_id = a.id::text and additions.files is not null;

drop function if exists public.record_attempt_command(uuid, text, text, boolean, jsonb, text[], boolean);
create function public.record_attempt_command(
  p_attempt_id uuid,
  p_command text,
  p_stdout text,
  p_stderr text,
  p_exit_code integer,
  p_cwd_before text,
  p_cwd_after text,
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
  v_output text := left(case when coalesce(p_stdout, '') <> '' then p_stdout else coalesce(p_stderr, '') end, 20000);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(p_command) > 256 then raise exception 'Command is too long'; end if;
  select * into v_attempt from public.training_attempts where id = p_attempt_id and user_id = v_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status <> 'active' then raise exception 'Attempt is not active'; end if;

  insert into public.training_command_history(
    attempt_id, user_id, command, cwd, output, succeeded,
    cwd_before, cwd_after, stdout, stderr, exit_code
  ) values (
    p_attempt_id, v_user_id, p_command, coalesce(p_cwd_after, '/home/learner'), v_output, p_exit_code = 0,
    coalesce(p_cwd_before, '/home/learner'), coalesce(p_cwd_after, '/home/learner'),
    left(coalesce(p_stdout, ''), 20000), left(coalesce(p_stderr, ''), 20000), p_exit_code
  );
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

revoke all on function public.record_attempt_command(uuid, text, text, text, integer, text, text, jsonb, text[], boolean) from public, anon;
grant execute on function public.record_attempt_command(uuid, text, text, text, integer, text, text, jsonb, text[], boolean) to authenticated;
