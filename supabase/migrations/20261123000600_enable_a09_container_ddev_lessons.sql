-- A09 has attempt-local container and DDEV behavior with observable state changes.
-- This update preserves all learner records.
update public.training_lessons
set implementation_status = 'ready'
where id in ('applied-linux-a09-l1', 'applied-linux-a09-l2', 'applied-linux-a09-l3');
