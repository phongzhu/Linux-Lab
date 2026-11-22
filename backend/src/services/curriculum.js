const objective = (id, title, description, hint, validate) => ({ id, title, description, hint, feedback: `${hint} This pattern is useful to remember when you investigate a Linux machine.`, validate });
const lesson = (id, title, time, intro, scenario, objectives, recap) => ({ id, title, time, intro, scenario, objectives, recap });
const cmd = (pattern, test = () => true) => (env, command, result) => pattern.test(command) && result.exitCode === 0 && test(env, command, result.stdout, result);
const fileHas = (path, text) => (env) => env.files[path]?.content.includes(text);
const copyExists = (source, destination) => (env) => !!env.files[destination] && env.files[destination].content === env.files[source]?.content;
const configuredPort = (env) => {
  try {
    const config = JSON.parse(env.files['/etc/training/app.json']?.content || '{}');
    return Number.isInteger(config.port) && config.port > 0 ? String(config.port) : null;
  } catch {
    return null;
  }
};

export const units = [
  { title: 'Explore the terminal', subtitle: 'Get your bearings and find your way around.', color: 'mint', lessons: [
    lesson('u1l1', 'Your first commands', '3 min', 'A terminal is a direct way to ask your computer questions. Start by finding your location and looking around.', 'You just logged in to learnbox. Check where you landed and see what is nearby.', [
      objective('where', 'Find your current location', 'Run a command that prints the full path to your current directory.', 'Try the command that means â€œprint working directory.â€', cmd(/^\s*pwd\s*$/, (e, c, o) => o === e.cwd)),
      objective('look', 'Look around', 'List the items in your current folder.', 'Use ls. You can also show hidden items with ls -a.', cmd(/^\s*ls(?:\s+-\w+)*\s*$/, (e, c, o) => o.includes('readme.txt'))),
      objective('readme', 'Read the welcome note', 'Open readme.txt and read its contents.', 'Use cat followed by the file name.', cmd(/^\s*cat\s+.*readme\.txt\s*$/, (e, c, o) => o.includes('Welcome to your Linux training machine'))),
    ], ['pwd prints your current path.', 'ls lists directory contents.', 'cat reads a text file.']),
    lesson('u1l2', 'Move between folders', '4 min', 'Directories are folders. Use cd to move through them, and pwd to confirm where you are.', 'The project notes are tucked away in the projects folder. Find and read them.', [
      objective('projects', 'Enter the projects folder', 'Move into the projects directory.', 'Try cd projects from your home folder.', cmd(/^\s*cd\s+\S+\s*$/, (e) => e.cwd.endsWith('/projects'))),
      objective('confirm', 'Confirm your location', 'Print your current path so you know you arrived.', 'Run pwd after changing directories.', cmd(/^\s*pwd\s*$/, (e) => e.cwd.endsWith('/projects'))),
      objective('notes', 'Read the project guide', 'Read the README.md file here.', 'Use cat README.md.', cmd(/^\s*cat\s+.*README\.md\s*$/, (e, c, o) => o.includes('Training app workspace'))),
      objective('home', 'Return home', 'Return to your home directory with a relative path.', 'cd .. moves up one directory.', cmd(/^\s*cd\s+\.\.\s*$/, (e) => e.cwd === '/home/learner')),
    ], ['cd changes your current directory.', 'Relative paths start from where you are.', 'cd .. moves up one level.']),
    lesson('u1l3', 'Read a config file', '4 min', 'Configuration files hold settings the application reads when it starts. Open the app configuration, inspect its first three lines, and report the configured port.', 'A teammate needs the training app port before updating a service check. Find the value in /etc/training/app.json and submit that exact number.', [
      objective('config', 'Read the app configuration', 'Print /etc/training/app.json so you can inspect the app settings.', 'Use cat /etc/training/app.json.', cmd(/^\s*cat\s+.*app\.json\s*$/, (e, c, o) => o === e.files['/etc/training/app.json']?.content)),
      objective('port', 'Show the first three lines', 'Use head to display exactly the first three lines of the configuration file.', 'Try head -n 3 /etc/training/app.json.', cmd(/^\s*head\s+(?:-n\s+3|-3)\s+.*app\.json\s*$/, (e, c, o) => o === e.files['/etc/training/app.json']?.content.split('\n').slice(0, 3).join('\n'))),
      objective('portanswer', 'Submit the configured port', 'Enter the application port you found in the configuration.', 'If the file says "port": 8080, submit it with: echo 8080', cmd(/^\s*echo\s+\d+\s*$/, (e, c, o) => configuredPort(e) !== null && o.trim() === configuredPort(e))),
    ], ['cat reads the whole configuration file.', 'head -n 3 shows the first three lines.', 'Compare the configured port value, then submit it with echo NUMBER.']),
  ] },
  { title: 'Collect and organize data', subtitle: 'Find the right files and keep them together.', color: 'blue', lessons: [
    lesson('u2l1', 'Locate the logs', '4 min', 'Logs record what an application is doing. The find command searches through directories for files.', 'Support needs all training log files for a bug report. Locate them first.', [
      objective('findlog', 'Find the application log', 'Search /var/log for app.log by name.', 'find /var/log -name app.log searches by file name.', cmd(/^\s*find\s+.*(?:-name|-iname)\s+.*app\.log\s*$/, (e, c, o) => o.includes('/var/log/training/app.log'))),
      objective('findauth', 'Find the authentication log', 'Search /var/log for auth.log.', 'Use find again with auth.log.', cmd(/^\s*find\s+.*(?:-name|-iname)\s+.*auth\.log\s*$/, (e, c, o) => o.includes('auth.log'))),
      objective('listlogs', 'List the training log folder', 'List the files inside /var/log/training.', 'ls /var/log/training shows the available logs.', cmd(/^\s*ls\s+.*training\s*$/, (e, c, o) => o.includes('system.log'))),
    ], ['find searches file paths and names.', 'Use an absolute path when you know the starting folder.']),
    lesson('u2l2', 'Make a collection folder', '3 min', 'Use mkdir to make a place for collected files. Keep your original logs untouched.', 'Create a tidy incident folder in your home directory.', [
      objective('mkdir', 'Create an incident folder', 'Create a folder named incident-notes in your home directory.', 'mkdir ~/incident-notes works, or use the full /home/learner path.', cmd(/^\s*mkdir\s+.*incident-notes\s*$/, (e) => e.files['/home/learner/incident-notes']?.type === 'dir')),
      objective('touch', 'Add a notes file', 'Create an empty notes.txt inside your new folder.', 'touch incident-notes/notes.txt creates an empty file.', cmd(/^\s*touch\s+.*notes\.txt\s*$/, (e) => e.files['/home/learner/incident-notes/notes.txt']?.type === 'file')),
      objective('confirmfolder', 'Check your collection', 'List the new incident-notes folder.', 'Use ls with the folder path.', cmd(/^\s*ls\s+.*incident-notes\s*$/, (e, c, o) => o.includes('notes.txt'))),
    ], ['mkdir creates directories.', 'touch creates an empty file.', 'Keep incident evidence in one place.']),
    lesson('u2l3', 'Copy files safely', '4 min', 'Copying is useful when collecting evidence: your source files stay in place while a copy goes into your workspace.', 'Gather the app and system logs into incident-notes.', [
      objective('copyapp', 'Copy the app log', 'Copy app.log into incident-notes.', 'cp /var/log/training/app.log incident-notes/ copies the log.', cmd(/^\s*cp\s+.*app\.log\s+.*incident-notes\/?\s*$/, (e) => copyExists('/var/log/training/app.log', '/home/learner/incident-notes/app.log')(e))),
      objective('copysys', 'Copy the system log', 'Copy system.log into incident-notes.', 'Use cp with the source and destination paths.', cmd(/^\s*cp\s+.*system\.log\s+.*incident-notes\/?\s*$/, (e) => copyExists('/var/log/training/system.log', '/home/learner/incident-notes/system.log')(e))),
      objective('verifycopies', 'Verify both copies', 'List incident-notes and check that both logs are there.', 'Run ls incident-notes.', cmd(/^\s*ls\s+.*incident-notes\s*$/, (e, c, o) => o.includes('app.log') && o.includes('system.log'))),
    ], ['cp copies a file and leaves the source in place.', 'A trailing slash makes the destination directory clear.']),
  ] },
  { title: 'Analyze logs', subtitle: 'Search, count, and summarize useful signals.', color: 'purple', lessons: [
    lesson('u3l1', 'Search for errors', '4 min', 'grep finds lines that match a word or phrase. It is one of the fastest ways to spot trouble in a log.', 'The payment team reports timeouts. Find every ERROR line in app.log.', [
      objective('error', 'Find error entries', 'Search app.log for the word ERROR.', 'grep "ERROR" /var/log/training/app.log', cmd(/^\s*grep\s+(?:-\w+\s+)*"?ERROR"?\s+.*app\.log\s*$/, (e, c, o) => o.includes('ERROR payment worker'))),
      objective('pipe', 'Filter with a pipe', 'Use cat and a pipe to show only lines containing upstream.', 'cat app.log | grep upstream sends file output into grep.', cmd(/^\s*cat\s+.*app\.log\s*\|\s*grep\s+.*upstream\s*$/, (e, c, o) => o.includes('upstream API'))),
      objective('count', 'Count error lines', 'Count matching ERROR lines in app.log.', 'grep -c ERROR app.log prints the match count.', cmd(/^\s*grep\s+-c\s+"?ERROR"?\s+.*app\.log\s*$/, (e, c, o) => o.trim() === '4')),
    ], ['grep searches for matching text.', 'A pipe | passes one commandâ€™s output into another.', 'grep -c counts matching lines.']),
    lesson('u3l2', 'Inspect recent activity', '3 min', 'Logs are chronological. tail is a quick way to focus on the newest events.', 'Check what the application did most recently.', [
      objective('recent', 'Read the latest log entries', 'Show the last four lines in app.log.', 'tail -n 4 /var/log/training/app.log', cmd(/^\s*tail\s+(?:-n\s+\d+\s+)?\S+app\.log\s*$/, (e, c, o) => o.includes('worker queue ready'))),
      objective('recentwarn', 'Focus on warnings', 'Search auth.log for WARN entries, ignoring case.', 'grep -i warn /var/log/training/auth.log', cmd(/^\s*grep\s+-i\s+.*warn.*auth\.log\s*$/, (e, c, o) => o.includes('invalid password'))),
      objective('countlines', 'Count the app log lines', 'Count how many lines are in app.log.', 'wc -l /var/log/training/app.log', cmd(/^\s*wc\s+-l\s+.*app\.log\s*$/, (e, c, o) => o.trim().startsWith('10'))),
    ], ['tail shows the most recent lines.', 'grep -i ignores letter case.', 'wc -l counts log entries.']),
    lesson('u3l3', 'Summarize repeated messages', '4 min', 'Sorting and uniq can reveal repeated messages. uniq compares neighboring lines, so sort first when needed.', 'Find which error message appears more than once.', [
      objective('sort', 'Sort matching errors', 'Search for ERROR, then sort the matching lines.', 'grep ERROR app.log | sort', cmd(/^\s*grep\s+"?ERROR"?\s+.*app\.log\s*\|\s*sort\s*$/, (e, c, o) => o.includes('payment worker timeout'))),
      objective('uniq', 'Remove adjacent duplicates', 'Sort the error lines and pass them through uniq.', 'grep ERROR app.log | sort | uniq', cmd(/^\s*grep\s+"?ERROR"?\s+.*app\.log\s*\|\s*sort\s*\|\s*uniq\s*$/, (e, c, o) => o.includes('upstream API'))),
      objective('save', 'Save a small report', 'Redirect ERROR lines into error-report.txt in your home directory.', 'grep ERROR app.log > error-report.txt', cmd(/^\s*grep\s+"?ERROR"?\s+.*app\.log\s*>\s*\S+error-report\.txt\s*$/, fileHas('/home/learner/error-report.txt', 'ERROR'))),
    ], ['sort puts equal lines together.', 'uniq removes neighboring duplicate lines.', '> writes command output into a file.']),
  ] },
  { title: 'Monitor a server', subtitle: 'Check resources, processes, and services.', color: 'orange', lessons: [
    lesson('u4l1', 'Check disk and memory', '3 min', 'Resource checks help explain slow or failing services. These training metrics are fictional snapshots.', 'Users report slowness. Check whether disk or memory is getting tight.', [
      objective('disk', 'Check disk space', 'Show disk usage and note the percentage used.', 'Run df -h.', cmd(/^\s*df(?:\s+-\w+)?\s*$/, (e, c, o) => o.includes('86%'))),
      objective('memory', 'Check memory', 'Show the system memory totals.', 'Run free -h or free.', cmd(/^\s*free(?:\s+-\w+)?\s*$/, (e, c, o) => o.includes('4096'))),
      objective('space', 'Inspect the system warning', 'Read the system log and find the memory warning.', 'grep memory /var/log/training/system.log', cmd(/^\s*grep\s+.*memory.*system\.log\s*$/i, (e, c, o) => o.toLowerCase().includes('memory usage'))),
    ], ['df reports disk space.', 'free reports memory.', 'Training metrics do not describe a real machine.']),
    lesson('u4l2', 'Inspect running processes', '4 min', 'Processes are programs currently running. ps gives a snapshot; top shows a simulated live-style summary.', 'Find the process that is using the most CPU.', [
      objective('ps', 'List processes', 'Show all process users and commands.', 'Try ps aux.', cmd(/^\s*ps(?:\s+(?:aux|-aux))?\s*$/, (e, c, o) => o.includes('payment-worker'))),
      objective('top', 'View the process snapshot', 'Run top to inspect the training server snapshot.', 'Type top.', cmd(/^\s*top\s*$/, (e, c, o) => o.includes('48.1'))),
      objective('processlog', 'Connect the clue to the logs', 'Search app.log for the payment worker timeout.', 'grep timeout /var/log/training/app.log', cmd(/^\s*grep\s+.*timeout.*app\.log\s*$/, (e, c, o) => o.includes('payment worker timeout'))),
    ], ['ps lists processes.', 'top summarizes system activity.', 'Match process symptoms with log evidence.']),
    lesson('u4l3', 'Check a service', '4 min', 'systemctl status tells you if a service is healthy. journalctl can show its recent log entries.', 'Investigate the payment worker failure and check the main app.', [
      objective('payment', 'Check the payment worker', 'Check the status of payment-worker.', 'systemctl status payment-worker', cmd(/^\s*systemctl\s+status\s+payment-worker\s*$/, (e, c, o) => o.includes('failed'))),
      objective('journal', 'Inspect recent system events', 'Show the latest four journal entries.', 'journalctl -n 4', cmd(/^\s*journalctl\s+(?:.*-n\s+4|.*--lines\s+4).*$/, (e, c, o) => o.includes('scheduled cleanup'))),
      objective('appstatus', 'Check the training app', 'Check whether training-app is running.', 'systemctl status training-app', cmd(/^\s*systemctl\s+status\s+training-app\s*$/, (e, c, o) => o.includes('active (running)'))),
    ], ['systemctl status inspects service state.', 'journalctl reads simulated system logs.', 'A running app can still depend on a failing worker.']),
  ] },
  { title: 'Fetch and inspect data', subtitle: 'Request a response and investigate service health.', color: 'pink', lessons: [
    lesson('u5l1', 'Request health data', '3 min', 'curl makes a web request. In this lesson, the URL is simulated and safely returns training data.', 'Request the health endpoint and inspect the response.', [
      objective('curlhealth', 'Call the health endpoint', 'Request the simulated health URL.', 'curl https://api.training.local/health', cmd(/^\s*curl\s+https:\/\/api\.training\.local\/health\s*$/, (e, c, o) => o.includes('"status"'))),
      objective('savehealth', 'Save the response', 'Request the same endpoint and save it as health.json.', 'curl -o health.json https://api.training.local/health', cmd(/^\s*curl\s+(?:-o|--output)\s+\S+\.json\s+https:\/\/api\.training\.local\/health\s*$/, fileHas('/home/learner/health.json', 'degraded'))),
      objective('inspecthealth', 'Read the service status', 'Open health.json and find the reported service status.', 'Use cat health.json to inspect the response.', cmd(/^\s*cat\s+.*health\.json\s*$/, (e, c, o) => o.includes('degraded'))),
    ], ['curl requests data from a URL.', '-o saves the response to a file.', 'The health payload is fictional training data.']),
    lesson('u5l2', 'Inspect a saved response', '3 min', 'Once data is saved, ordinary file commands can inspect it. JSON is plain text with a structured shape.', 'Read the health response you saved and extract its key signal.', [
      objective('fetchhealth', 'Save the health response', 'Fetch the health endpoint and save it to health.json.', 'curl -o health.json https://api.training.local/health', cmd(/^\s*curl\s+(?:-o|--output)\s+\S+\.json\s+https:\/\/api\.training\.local\/health\s*$/, fileHas('/home/learner/health.json', 'degraded'))),
      objective('cathealth', 'Read health.json', 'Print the saved response.', 'cat health.json', cmd(/^\s*cat\s+.*health\.json\s*$/, (e, c, o) => o.includes('paymentWorker'))),
      objective('counthealth', 'Count response lines', 'Count the lines in health.json.', 'wc -l health.json', cmd(/^\s*wc\s+-l\s+.*health\.json\s*$/)),
    ], ['Saved JSON is still a text file.', 'grep can find a field without opening the whole file.', 'wc -l gives a quick size check.']),
    lesson('u5l3', 'Investigate the incident', '5 min', 'Bring the investigation together: inspect the service, verify the health signal, and collect evidence for a handoff.', 'Users cannot complete payments. Check service health and leave an incident report in your home folder.', [
      objective('service', 'Check the payment service', 'Inspect payment-worker status.', 'systemctl status payment-worker', cmd(/^\s*systemctl\s+status\s+payment-worker\s*$/, (e, c, o) => o.includes('failed'))),
      objective('errors', 'Find recent worker errors', 'Search app.log for payment worker timeout messages.', 'grep timeout /var/log/training/app.log', cmd(/^\s*grep\s+.*timeout.*app\.log\s*$/, (e, c, o) => o.includes('payment worker'))),
      objective('endpoint', 'Fetch the health response', 'Save the health endpoint response to incident-health.json.', 'curl -o incident-health.json https://api.training.local/health', cmd(/^\s*curl\s+-o\s+\S*incident-health\.json\s+https:\/\/api\.training\.local\/health\s*$/, fileHas('/home/learner/incident-health.json', 'paymentWorker'))),
      objective('report', 'Write a handoff note', 'Write a short timeout note into incident-report.txt.', 'echo "payment worker timeout" > incident-report.txt', cmd(/^\s*echo\s+.*payment worker timeout.*>\s*\S*incident-report\.txt\s*$/, fileHas('/home/learner/incident-report.txt', 'payment worker timeout'))),
    ], ['Service status shows the worker is failing.', 'Repeated timeout entries point to a worker issue.', 'The health response confirms a degraded payment worker.']),
  ] },
];

const foundationLessons = units.flatMap((unit, unitIndex) => unit.lessons.map((item, lessonIndex) => ({
  ...item,
  unitIndex,
  lessonIndex,
  unitTitle: unit.title,
  unitColor: unit.color,
  unitId: `LF-U${String(unitIndex + 1).padStart(2, '0')}`,
  unitNumber: unitIndex + 1,
  number: unitIndex * 3 + lessonIndex + 1,
  sectionId: 'linux-fundamentals',
  trackId: 'linux-fundamentals',
  prerequisites: [],
  role: 'learner',
  workspaceType: 'local-shell',
  tools: [],
  explanation: item.recap,
  objectives: item.objectives.map((objective) => ({
    ...objective,
    hints: objective.hints || [
      `Look for the observable evidence described by “${objective.title.toLowerCase()}”.`,
      objective.hint,
      objective.hint,
    ],
  })),
})));

import { appliedLessons } from './appliedCurriculum.js';

export const lessons = [...foundationLessons, ...appliedLessons];
export function validateTask(task, env, command, result) { return typeof task.validate === 'function' && task.validate(env, command, result); }
