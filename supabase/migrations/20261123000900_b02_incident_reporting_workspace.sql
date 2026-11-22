update public.training_lessons
set implementation_status = 'ready'
where id in (
  'sre-operations-b02-l1',
  'sre-operations-b02-l2',
  'sre-operations-b02-l3'
);
