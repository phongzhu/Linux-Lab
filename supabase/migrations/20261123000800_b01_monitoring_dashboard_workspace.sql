update public.training_lessons
set implementation_status = 'ready'
where id in (
  'sre-operations-b01-l1',
  'sre-operations-b01-l2',
  'sre-operations-b01-l3'
);
