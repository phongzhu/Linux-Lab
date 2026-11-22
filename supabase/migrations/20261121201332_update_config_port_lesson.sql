update public.training_lessons
set
  concept = 'Configuration files hold settings the application reads when it starts. Open the app configuration, inspect its first three lines, and report the configured port.',
  scenario = 'A teammate needs the training app port before updating a service check. Find the value in /etc/training/app.json and submit that exact number.',
  objectives = jsonb_build_array(
    jsonb_build_object(
      'id', 'config',
      'title', 'Read the app configuration',
      'description', 'Print /etc/training/app.json so you can inspect the app settings.',
      'hint', 'Use cat /etc/training/app.json.',
      'feedback', 'Use cat to read the whole configuration file. This pattern is useful to remember when you investigate a Linux machine.'
    ),
    jsonb_build_object(
      'id', 'port',
      'title', 'Show the first three lines',
      'description', 'Use head to display exactly the first three lines of the configuration file.',
      'hint', 'Try head -n 3 /etc/training/app.json.',
      'feedback', 'Use head -n 3 to show the first three lines. This pattern is useful to remember when you investigate a Linux machine.'
    ),
    jsonb_build_object(
      'id', 'portanswer',
      'title', 'Submit the configured port',
      'description', 'Enter the application port you found in the configuration.',
      'hint', 'If the file says "port": 8080, submit it with: echo 8080',
      'feedback', 'Compare the configured port value, then submit it with echo NUMBER. This pattern is useful to remember when you investigate a Linux machine.'
    )
  ),
  recap = jsonb_build_array(
    'cat reads the whole configuration file.',
    'head -n 3 shows the first three lines.',
    'Compare the configured port value, then submit it with echo NUMBER.'
  )
where id = 'u1l3';

-- Reopen the replaced JSON-validation task for learners with an active attempt.
update public.training_attempts
set completed_tasks = array_remove(completed_tasks, 'json')
where lesson_id = 'u1l3'
  and status = 'active'
  and 'json' = any(completed_tasks);
