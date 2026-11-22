-- A07 archive and transfer commands now mutate attempt-local filesystem and host state.
-- Catalog status only; learner records are preserved.
update public.training_lessons
set implementation_status = 'ready'
where id in ('applied-linux-a07-l1', 'applied-linux-a07-l2', 'applied-linux-a07-l3');
