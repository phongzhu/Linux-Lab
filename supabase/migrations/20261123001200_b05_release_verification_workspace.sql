update public.training_lessons
set implementation_status = 'ready'
where id in (
  'sre-operations-b05-l1',
  'sre-operations-b05-l2',
  'sre-operations-b05-l3'
);
