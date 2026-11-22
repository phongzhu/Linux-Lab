update public.training_lessons
set implementation_status = 'ready'
where id in (
  'sre-operations-b04-l1',
  'sre-operations-b04-l2',
  'sre-operations-b04-l3'
);
