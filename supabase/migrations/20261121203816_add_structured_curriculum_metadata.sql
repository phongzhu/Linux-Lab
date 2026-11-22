alter table public.training_lessons
  drop constraint if exists training_lessons_unit_number_check,
  add constraint training_lessons_unit_number_check check (unit_number between 1 and 20),
  add column if not exists section_id text not null default 'linux-fundamentals',
  add column if not exists track_id text not null default 'linux-fundamentals',
  add column if not exists unit_id text,
  add column if not exists prerequisites text[] not null default '{}',
  add column if not exists role_name text not null default 'learner',
  add column if not exists workspace_type text not null default 'local-shell',
  add column if not exists tools text[] not null default '{}',
  add column if not exists expected_outcomes jsonb not null default '[]'::jsonb,
  add column if not exists explanation jsonb not null default '[]'::jsonb,
  add column if not exists implementation_status text not null default 'ready'
    check (implementation_status in ('ready', 'partial', 'preview'));

update public.training_lessons
set unit_id = coalesce(unit_id, 'LF-U' || lpad(unit_number::text, 2, '0')),
    expected_outcomes = coalesce(expected_outcomes, '[]'::jsonb),
    explanation = coalesce(explanation, recap),
    implementation_status = 'ready'
where unit_number between 1 and 5;

with ordered_foundation as (
  select id, lag(id) over (order by unit_number, lesson_number) as previous_id
    from public.training_lessons
   where unit_number between 1 and 5
)
update public.training_lessons lesson
   set prerequisites = case when ordered_foundation.previous_id is null
                            then '{}'::text[] else array[ordered_foundation.previous_id] end
  from ordered_foundation
 where lesson.id = ordered_foundation.id;

alter table public.training_lessons alter column unit_id set not null;
create index if not exists training_lessons_section_track_order_idx
  on public.training_lessons(section_id, track_id, unit_number, lesson_number);
