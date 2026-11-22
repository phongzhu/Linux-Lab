update public.training_lessons
set starting_environment = jsonb_set(
  starting_environment,
  '{hosts,lab-app-01.training.test,files}',
  coalesce(starting_environment #> '{hosts,lab-app-01.training.test,files}', '{}'::jsonb) - '/home/learner/remote-note.txt',
  true
)
where unit_id = 'applied-linux-A03';

update public.training_lessons
set starting_environment = starting_environment #-
  '{files,/home/learner/remote-note.txt}'
where unit_id = 'applied-linux-A03' and lesson_number = 3;
