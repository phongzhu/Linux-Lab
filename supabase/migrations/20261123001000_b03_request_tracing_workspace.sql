update public.training_lessons
set implementation_status = 'ready'
where id in (
  'sre-operations-b03-l1',
  'sre-operations-b03-l2',
  'sre-operations-b03-l3'
);
