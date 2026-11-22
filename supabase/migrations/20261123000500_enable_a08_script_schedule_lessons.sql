-- A08 script and scheduler exercises now operate on per-attempt state.
-- No learner progress or attempt records are modified.
update public.training_lessons
set implementation_status = 'ready'
where id in ('applied-linux-a08-l1', 'applied-linux-a08-l2', 'applied-linux-a08-l3');
