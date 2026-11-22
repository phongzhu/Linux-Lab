update public.training_lessons
set implementation_status = 'ready',
    starting_environment = jsonb_set(
      starting_environment,
      '{files}',
      coalesce(starting_environment->'files', '{}'::jsonb) || jsonb_build_object(
        '/srv', jsonb_build_object('type','dir'),
        '/srv/reports', jsonb_build_object('type','dir'),
        '/srv/reports/monthly.csv', jsonb_build_object(
          'type','file', 'content', E'month,total\n2026-10,418\n',
          'owner','finance-admin',
          'group', case when lesson_number = 3 then 'report-users' else 'finance-ops' end,
          'mode','0640'
        )
      ), true
    ) || jsonb_build_object(
      'users', jsonb_build_object(
        'learner', jsonb_build_object('groups', jsonb_build_array('learners')),
        'report-reader', jsonb_build_object('groups', jsonb_build_array('report-users')),
        'guest-audit', jsonb_build_object('groups', jsonb_build_array('auditors'))
      ),
      'groups', jsonb_build_array('learners','report-users','auditors','finance-ops')
    ) || case when lesson_number > 1 then jsonb_build_object('role','training-admin') else '{}'::jsonb end
where unit_id = 'applied-linux-A02';
