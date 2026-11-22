alter table public.training_command_history
  add column if not exists host_before text,
  add column if not exists host_after text,
  add column if not exists user_before text,
  add column if not exists user_after text;

update public.training_command_history
set host_before = coalesce(host_before, 'learnbox'),
    host_after = coalesce(host_after, 'learnbox'),
    user_before = coalesce(user_before, 'learner'),
    user_after = coalesce(user_after, 'learner');

alter table public.training_command_history
  alter column host_before set default 'learnbox', alter column host_before set not null,
  alter column host_after set default 'learnbox', alter column host_after set not null,
  alter column user_before set default 'learner', alter column user_before set not null,
  alter column user_after set default 'learner', alter column user_after set not null;

drop function if exists public.record_attempt_command(uuid, text, text, text, integer, text, text, jsonb, text[], boolean);
create function public.record_attempt_command(
  p_attempt_id uuid,
  p_command text,
  p_stdout text,
  p_stderr text,
  p_exit_code integer,
  p_cwd_before text,
  p_cwd_after text,
  p_host_before text,
  p_host_after text,
  p_user_before text,
  p_user_after text,
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
    cwd_before, cwd_after, stdout, stderr, exit_code,
    host_before, host_after, user_before, user_after
  ) values (
    p_attempt_id, v_user_id, p_command, coalesce(p_cwd_after, '/home/learner'), v_output, p_exit_code = 0,
    coalesce(p_cwd_before, '/home/learner'), coalesce(p_cwd_after, '/home/learner'),
    left(coalesce(p_stdout, ''), 20000), left(coalesce(p_stderr, ''), 20000), p_exit_code,
    coalesce(p_host_before, 'learnbox'), coalesce(p_host_after, 'learnbox'), coalesce(p_user_before, 'learner'), coalesce(p_user_after, 'learner')
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

revoke all on function public.record_attempt_command(uuid, text, text, text, integer, text, text, text, text, text, text, jsonb, text[], boolean) from public, anon;
grant execute on function public.record_attempt_command(uuid, text, text, text, integer, text, text, text, text, text, text, jsonb, text[], boolean) to authenticated;
