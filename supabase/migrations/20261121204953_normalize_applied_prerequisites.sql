update public.training_lessons lesson
set prerequisites = array(
  select case when prerequisite like 'al-a%' then 'applied-linux-' || substring(prerequisite from 4)
              else prerequisite end
    from unnest(lesson.prerequisites) prerequisite
)
where lesson.section_id = 'applied-linux-sre'
  and exists (select 1 from unnest(lesson.prerequisites) prerequisite where prerequisite like 'al-a%');
