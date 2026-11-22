-- Lessons are independently startable. This changes catalog metadata only;
-- learner progress, attempts, and completion records remain untouched.
update public.training_lessons
set prerequisites = '{}'::text[];

-- Ensure the simulator lessons implemented in the application are playable
-- even if older catalog seed or status updates left them marked as previews.
update public.training_lessons
set implementation_status = 'ready'
where id in (
  'applied-linux-a01-l1', 'applied-linux-a01-l2', 'applied-linux-a01-l3',
  'applied-linux-a02-l1', 'applied-linux-a02-l2', 'applied-linux-a02-l3',
  'applied-linux-a03-l1', 'applied-linux-a03-l2', 'applied-linux-a03-l3',
  'applied-linux-a04-l1', 'applied-linux-a04-l2',
  'applied-linux-a05-l1', 'applied-linux-a05-l2', 'applied-linux-a05-l3'
);
