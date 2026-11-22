update public.training_lessons
set implementation_status = 'ready',
    starting_environment = jsonb_set(
      jsonb_set(
        starting_environment,
        '{network}',
        case when lesson_number = 1 then jsonb_build_object(
          'interfaces', jsonb_build_array(jsonb_build_object('name','eth0','address','10.24.1.18/24','state','UP')),
          'routes', jsonb_build_array(jsonb_build_object('destination','default','via','10.24.1.1','device','eth0')),
          'dns', jsonb_build_object('api.training.test','10.24.1.30')
        ) else jsonb_build_object(
          'interfaces', jsonb_build_array(jsonb_build_object('name','eth0','address','10.24.1.18/24','state','UP')),
          'routes', jsonb_build_array(jsonb_build_object('destination','default','via','10.24.1.1','device','eth0')),
          'dns', jsonb_build_object('api.training.test','10.24.1.30'),
          'listeners', jsonb_build_array(
            jsonb_build_object('address','0.0.0.0','port',443,'process','legacy-site'),
            jsonb_build_object('address','0.0.0.0','port',8443,'process','training-api')
          ),
          'endpointChecks', '[]'::jsonb
        ) end,
        true
      ),
      '{files}',
      coalesce(starting_environment->'files','{}'::jsonb) || case when lesson_number = 1 then jsonb_build_object(
        '/etc/training/client-destination.txt', jsonb_build_object('type','file','content', E'Client record: api.training.test -> 10.24.1.31\nApproved network: 10.24.1.0/24')
      ) else jsonb_build_object(
        '/etc/training/port-map.txt', jsonb_build_object('type','file','content', E'API listener: 8443\nClient requested port: 443\nTLS terminates at: training edge')
      ) end,
      true
    ) || case when lesson_number = 2 then jsonb_build_object(
      'endpoints', jsonb_build_object(
        'https://api.training.test:443/health', jsonb_build_object('status',404,'body','{"httpStatus":404,"error":"wrong virtual service"}'),
        'https://api.training.test:8443/health', jsonb_build_object('status',200,'body','{"httpStatus":200,"status":"healthy","service":"training-api"}')
      )
    ) else jsonb_build_object('endpoints','{}'::jsonb) end
where unit_id = 'applied-linux-A04' and lesson_number in (1,2);
