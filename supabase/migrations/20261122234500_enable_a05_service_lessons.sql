update public.training_lessons
set implementation_status = 'ready',
    starting_environment = starting_environment || jsonb_build_object(
      'role', case when lesson_number = 3 then 'training-admin' else 'read-only investigator' end,
      'host', 'web-1',
      'services', coalesce(starting_environment->'services','{}'::jsonb) || jsonb_build_object(
        'training-site','failed (Result: connection pool exhausted)'
      ),
      'processes', jsonb_build_array(
        jsonb_build_object('pid',1,'user','root','cpu',0.1,'mem',0.4,'command','init'),
        jsonb_build_object('pid',812,'user','www-data','cpu',4.2,'mem',31.5,'command','node training-site'),
        jsonb_build_object('pid',913,'user','app','cpu',72.4,'mem',22.1,'command','db-worker --pool 10')
      ),
      'disk', jsonb_build_object('total',20,'used',15.2,'available',4.8),
      'memory', jsonb_build_object('total',8192,'used',6144,'free',2048),
      'serviceLogs', jsonb_build_object('training-site', E'2026-11-22T09:00:00Z INFO training-site startup complete\n2026-11-22T09:02:00Z WARN database pool utilization=90%\n2026-11-22T09:04:12Z ERROR database connection pool exhausted active=10 max=10\n2026-11-22T09:05:01Z ERROR request failed status=503\n2026-11-22T09:07:00Z INFO health probe status=503'),
      'endpoints', jsonb_build_object(
        'https://status.training.test/health', jsonb_build_object('status',503,'body','{"httpStatus":503,"status":"unavailable","reason":"connection pool exhausted"}')
      )
    ) || jsonb_build_object(
      'files', coalesce(starting_environment->'files','{}'::jsonb) || jsonb_build_object(
        '/opt/training-site/config.json', jsonb_build_object('type','file','content', E'{\n  "service": "training-site",\n  "poolSize": 10,\n  "endpoint": "https://status.training.test/health"\n}'),
        '/var/log/training/training-site.log', jsonb_build_object('type','file','content', E'2026-11-22T09:00:00Z INFO training-site startup complete\n2026-11-22T09:02:00Z WARN database pool utilization=90%\n2026-11-22T09:04:12Z ERROR database connection pool exhausted active=10 max=10\n2026-11-22T09:05:01Z ERROR request failed status=503\n2026-11-22T09:07:00Z INFO health probe status=503')
      )
    )
where unit_id = 'applied-linux-A05';
