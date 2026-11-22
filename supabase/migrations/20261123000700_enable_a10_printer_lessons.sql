-- A10 virtual printer queues and jobs now mutate attempt-local state.
-- Existing learner data and progress are unchanged.
update public.training_lessons
set implementation_status = 'ready'
where id in ('applied-linux-a10-l1', 'applied-linux-a10-l2', 'applied-linux-a10-l3');
