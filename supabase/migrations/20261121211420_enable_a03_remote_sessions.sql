update public.training_lessons
set implementation_status = 'ready',
    starting_environment = starting_environment || jsonb_build_object(
      'localHost', 'learner-pc',
      'hostFingerprints', jsonb_build_object('lab-app-01.training.test', 'SHA256:TRAINING-ONLY-01'),
      'hosts', jsonb_build_object(
        'lab-app-01.training.test', jsonb_build_object(
          'host', 'lab-app-01',
          'user', 'learner',
          'fingerprint', 'SHA256:TRAINING-ONLY-01',
          'cwd', '/home/learner',
          'files', jsonb_build_object(
            '/home/learner/connection.txt', jsonb_build_object('type','file','content', E'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01'),
            '/opt/training-api/config.json', jsonb_build_object('type','file','content', E'{\n  "name": "training-api",\n  "port": 8080\n}'),
            '/home/learner/remote-note.txt', jsonb_build_object('type','file','content','Remote inspection scratch note — lab-app-01')
          )
        )
      ),
      'files', coalesce(starting_environment->'files', '{}'::jsonb) || jsonb_build_object(
        '/home/learner/connection.txt', jsonb_build_object('type','file','content', E'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01')
      )
    ) || case when lesson_number = 3 then jsonb_build_object(
      'host','lab-app-01',
      'user','learner',
      'cwd','/home/learner',
      'files', jsonb_build_object(
        '/home/learner/connection.txt', jsonb_build_object('type','file','content', E'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01'),
        '/opt/training-api/config.json', jsonb_build_object('type','file','content', E'{\n  "name": "training-api",\n  "port": 8080\n}'),
        '/home/learner/remote-note.txt', jsonb_build_object('type','file','content','Remote inspection scratch note — lab-app-01')
      ),
      'knownHosts', jsonb_build_object('lab-app-01.training.test','SHA256:TRAINING-ONLY-01'),
      'remoteSession', jsonb_build_object('key','lab-app-01.training.test'),
      'localSession', jsonb_build_object(
        'host','learner-pc','user','learner','cwd','/home/learner','oldpwd','/home/learner',
        'files', jsonb_build_object(
          '/home/learner/connection.txt', jsonb_build_object('type','file','content', E'Host: lab-app-01.training.test\nUser: learner\nFingerprint: SHA256:TRAINING-ONLY-01')
        )
      )
    ) else jsonb_build_object('host','learner-pc') end
where unit_id = 'applied-linux-A03';
