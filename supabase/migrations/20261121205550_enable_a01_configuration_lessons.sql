update public.training_lessons
set implementation_status = 'ready',
    starting_environment = jsonb_set(
      starting_environment,
      '{files}',
      coalesce(starting_environment->'files', '{}'::jsonb) || jsonb_build_object(
        '/opt', jsonb_build_object('type','dir'),
        '/opt/training-api', jsonb_build_object('type','dir'),
        '/opt/training-api/config.json', jsonb_build_object('type','file','content',
          case when lesson_number = 3 then E'{\n  "name": "training-api",\n  "port": 8081,\n  "healthPath": "/health"\n}' else E'{\n  "name": "training-api",\n  "port": 8080,\n  "healthPath": "/health"\n}' end),
        '/opt/training-api/README.txt', jsonb_build_object('type','file','content', E'Runbook: training client expects https://api.training.test:8081/health\nOwner: training-platform'),
        '/var/log/training-api', jsonb_build_object('type','dir'),
        '/var/log/training-api/app.log', jsonb_build_object('type','file','content',
          case when lesson_number = 3 then '2026-11-22T09:00:00Z INFO service started on port 8081' || E'\n' || '2026-11-22T09:00:01Z INFO health check passed status=200' else '' end)
      ), true
    ) || case when lesson_number > 1 then jsonb_build_object('role','training-admin') else '{}'::jsonb end ||
    jsonb_build_object('services', coalesce(starting_environment->'services','{}'::jsonb) || jsonb_build_object('training-api','active (running)')) ||
    case when lesson_number = 3 then jsonb_build_object('endpoints', jsonb_build_object('https://api.training.test:8081/health', jsonb_build_object('status',200,'body','{"status":"healthy","service":"training-api"}'))) else '{}'::jsonb end
where unit_id = 'applied-linux-A01';
