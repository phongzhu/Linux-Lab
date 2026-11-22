-- A06 has a state-backed practice database and a separate psql session.
-- Only catalog availability changes; learner records are untouched.
update public.training_lessons
set implementation_status = 'ready'
where id in ('applied-linux-a06-l1', 'applied-linux-a06-l2', 'applied-linux-a06-l3');
