import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnvironment, executeCommand, normalizeEnvironment, pathExists, resolvePath } from '../../src/simulation/executor.js';
import { lessons, validateTask } from '../../src/services/curriculum.js';
import { evaluateCommand } from '../../src/simulation/taskEvaluator.js';
import { initialAttemptState } from '../../src/services/attemptService.js';

test('starts in learner home and resolves relative paths', () => {
  const env = createEnvironment();
  assert.equal(env.cwd, '/home/learner');
  assert.equal(executeCommand(env, 'pwd').output, '/home/learner');
  assert.equal(executeCommand(env, 'cd projects').env.cwd, '/home/learner/projects');
});

test('repairs missing directory ancestors and keeps ls, cd, cat, and relative paths consistent', () => {
  const env = createEnvironment();
  assert.equal(env.files['/etc/training']?.type, 'dir');
  assert.ok(executeCommand(env, 'ls /etc').stdout.split(/\s+/).includes('training'));

  const fromEtc = executeCommand(env, 'cd /etc');
  assert.equal(fromEtc.cwdBefore, '/home/learner');
  assert.equal(fromEtc.cwdAfter, '/etc');
  assert.equal(executeCommand(env, 'cd training').cwdAfter, '/etc/training');

  const relative = executeCommand(env, 'cat app.json');
  const absolute = executeCommand(env, 'cat /etc/training/app.json');
  assert.equal(relative.stdout, absolute.stdout);
  assert.equal(relative.cwdBefore, '/etc/training');
  assert.equal(relative.cwdAfter, '/etc/training');
});

test('direct cd works, path normalization is stable, and failed cd preserves cwd', () => {
  const env = createEnvironment();
  assert.equal(executeCommand(env, 'cd /etc/training/').cwdAfter, '/etc/training');
  assert.equal(resolvePath('/etc//training/./../training/', '/home/learner'), '/etc/training');
  assert.equal(resolvePath('../training/app.json', '/etc'), '/training/app.json');

  const before = env.cwd;
  const missing = executeCommand(env, 'cd /etc/missing');
  assert.equal(missing.exitCode, 1);
  assert.match(missing.stderr, /No such directory/);
  assert.equal(env.cwd, before);
  assert.equal(missing.cwdBefore, before);
  assert.equal(missing.cwdAfter, before);
});

test('normalizes legacy saved filesystem states without dropping their files', () => {
  const env = createEnvironment();
  delete env.files['/etc/training'];
  const normalized = normalizeEnvironment(env);
  assert.equal(normalized.files['/etc/training']?.type, 'dir');
  assert.equal(normalized.files['/etc/training/app.json']?.content, env.files['/etc/training/app.json'].content);
});

test('creates and copies persistent virtual files', () => {
  const env = createEnvironment();
  executeCommand(env, 'mkdir collection');
  executeCommand(env, 'cp /var/log/training/app.log collection/');
  assert.equal(pathExists(env, 'collection/app.log', 'file'), true);
  assert.match(env.files['/home/learner/collection/app.log'].content, /ERROR/);
});

test('pipes and output redirection use simulated file data', () => {
  const env = createEnvironment();
  const filtered = executeCommand(env, 'cat /var/log/training/app.log | grep ERROR');
  assert.match(filtered.output, /payment worker timeout/);
  executeCommand(env, 'grep ERROR /var/log/training/app.log > errors.txt');
  assert.equal(env.files['/home/learner/errors.txt'].content.split('\n').length, 4);
});

test('shell result separates stdout, stderr, and exit status for grep', () => {
  const env = createEnvironment();
  const match = executeCommand(env, 'grep ERROR /var/log/training/app.log');
  assert.equal(match.exitCode, 0);
  assert.match(match.stdout, /payment worker timeout/);
  assert.equal(match.stderr, '');

  const noMatch = executeCommand(env, 'grep NOT_FOUND /var/log/training/app.log');
  assert.equal(noMatch.exitCode, 1);
  assert.equal(noMatch.stdout, '');
  assert.equal(noMatch.stderr, '');
  const noMatchCount = executeCommand(env, 'grep -c NOT_FOUND /var/log/training/app.log');
  assert.equal(noMatchCount.stdout, '0');
  assert.equal(noMatchCount.stderr, '');
  assert.equal(noMatchCount.exitCode, 1);
  assert.equal(executeCommand(env, 'grep -c NOT_FOUND /var/log/training/app.log | cat').exitCode, 0, 'without pipefail the final pipeline command determines status');

  const usage = executeCommand(env, 'grep -Z ERROR /var/log/training/app.log');
  assert.equal(usage.exitCode, 2);
  assert.equal(usage.stdout, '');
  assert.match(usage.stderr, /unsupported option/);
});

test('pipelines pass stdout and quoted redirection paths preserve spaces and literals', () => {
  const env = createEnvironment();
  const pipeline = executeCommand(env, "printf 'alpha\\nbeta\\n' | grep beta");
  assert.equal(pipeline.exitCode, 0);
  assert.equal(pipeline.stdout, 'beta');

  const redirected = executeCommand(env, 'echo "a | b" > "report file.txt"');
  assert.equal(redirected.exitCode, 0);
  assert.equal(env.files['/home/learner/report file.txt'].content, 'a | b');
  const appended = executeCommand(env, 'echo done >> "report file.txt"');
  assert.equal(appended.exitCode, 0);
  assert.equal(env.files['/home/learner/report file.txt'].content, 'a | bdone');
});

test('bare redirection and unsupported shell operators return syntax errors', () => {
  const env = createEnvironment();
  const redirect = executeCommand(env, '>');
  assert.equal(redirect.exitCode, 2);
  assert.match(redirect.stderr, /requires a target file/);
  const chain = executeCommand(env, 'pwd && ls');
  assert.equal(chain.exitCode, 2);
  assert.match(chain.stderr, /unsupported shell operator/);
});

test('find reports full paths and unsupported options fail', () => {
  const env = createEnvironment();
  assert.match(executeCommand(env, 'find /var/log -name app.log').output, /\/var\/log\/training\/app.log/);
  assert.equal(executeCommand(env, 'grep -z ERROR /var/log/training/app.log').error, true);
  assert.equal(executeCommand(env, 'curl -X POST https://api.training.local/health').error, true);
});

test('curl returns training data and writes the requested file', () => {
  const env = createEnvironment();
  const result = executeCommand(env, 'curl -o health.json https://api.training.local/health');
  assert.equal(result.error, false);
  assert.match(env.files['/home/learner/health.json'].content, /degraded/);
});

test('unsupported commands and unknown URLs fail clearly', () => {
  const env = createEnvironment();
  assert.match(executeCommand(env, 'something-unsupported').output, /command not found/);
  assert.equal(executeCommand(env, 'curl https://example.com/').error, true);
  assert.equal(executeCommand(env, 'ls nowhere').error, true);
});

test('validates lesson objective from resulting terminal state', () => {
  const task = lessons[0].objectives[0];
  const env = createEnvironment();
  assert.equal(validateTask(task, env, 'pwd', { stdout: '/home/learner', stderr: '', exitCode: 0 }), true);
  assert.equal(validateTask(task, env, 'pwd', { stdout: '/var/log', stderr: '', exitCode: 0 }), false);
  assert.equal(validateTask(task, env, 'pwd', { stdout: '', stderr: 'not found', exitCode: 2 }), false);
});

test('config lesson keeps full-file reading and verifies exactly the first three lines', () => {
  const env = createEnvironment();
  const lesson = lessons.find((item) => item.id === 'u1l3');
  const [readTask, firstLinesTask] = lesson.objectives;
  const fullFile = executeCommand(env, 'cat /etc/training/app.json');
  const firstThree = executeCommand(env, 'head -n 3 /etc/training/app.json');

  assert.equal(validateTask(readTask, env, 'cat /etc/training/app.json', fullFile), true);
  assert.equal(validateTask(firstLinesTask, env, 'head -n 3 /etc/training/app.json', firstThree), true);
  assert.equal(firstThree.stdout, env.files['/etc/training/app.json'].content.split('\n').slice(0, 3).join('\n'));
  assert.equal(validateTask(firstLinesTask, env, 'head -n 2 /etc/training/app.json', executeCommand(env, 'head -n 2 /etc/training/app.json')), false);
  assert.equal(validateTask(firstLinesTask, env, 'head /etc/training/app.json', executeCommand(env, 'head /etc/training/app.json')), false);
});

test('config lesson checks the submitted port against the current scenario file', () => {
  const env = createEnvironment();
  const lesson = lessons.find((item) => item.id === 'u1l3');
  const portTask = lesson.objectives.find((task) => task.id === 'portanswer');

  const attempt = { state: env, completed_tasks: [] };
  const incorrect = executeCommand(env, 'echo 8081');
  assert.deepEqual(evaluateCommand({ lessonId: 'u1l3', attempt, command: 'echo 8081', result: incorrect }), []);
  const correct = executeCommand(env, 'echo 8080');
  assert.deepEqual(evaluateCommand({ lessonId: 'u1l3', attempt, command: 'echo 8080', result: correct }), ['portanswer']);

  env.files['/etc/training/app.json'].content = env.files['/etc/training/app.json'].content.replace('8080', '9091');
  const changedAnswer = executeCommand(env, 'echo 9091');
  assert.equal(validateTask(portTask, env, 'echo 9091', changedAnswer), true);
  assert.equal(validateTask(portTask, env, 'echo 8080', executeCommand(env, 'echo 8080')), false);
});

test('failed file reads cannot satisfy a matching config lesson command', () => {
  const env = createEnvironment();
  const lesson = lessons.find((item) => item.id === 'u1l3');
  const readTask = lesson.objectives[0];
  const result = executeCommand(env, 'cat /tmp/app.json');

  assert.equal(result.error, true);
  assert.equal(validateTask(readTask, env, 'cat /tmp/app.json', result), false);
});

test('requires requested file state before accepting a copy task', () => {
  const task = lessons.find((item) => item.id === 'u2l3').objectives[0];
  const env = createEnvironment();
  assert.equal(validateTask(task, env, 'cp /var/log/training/app.log incident-notes/', { stdout: '', stderr: '', exitCode: 0 }), false);
  executeCommand(env, 'mkdir incident-notes');
  executeCommand(env, 'cp /var/log/training/app.log incident-notes/');
  assert.equal(validateTask(task, env, 'cp /var/log/training/app.log incident-notes/', { stdout: '', stderr: '', exitCode: 0 }), true);
});

test('preserves the fifteen foundation lessons and defines 45 structured applied lessons', () => {
  const foundation = lessons.filter((item) => item.sectionId === 'linux-fundamentals');
  const applied = lessons.filter((item) => item.sectionId === 'applied-linux-sre');
  assert.equal(foundation.length, 15);
  assert.equal(applied.length, 45);
  assert.equal(new Set(lessons.map((item) => item.id)).size, 60);
  assert.ok(foundation.some((item) => item.id === 'u1l1'));
  for (const item of applied) {
    assert.ok(item.trackId === 'applied-linux' || item.trackId === 'sre-operations');
    assert.ok(item.unitId && item.role && item.workspaceType);
    assert.deepEqual(item.prerequisites, [], `${item.id} must not require prerequisite lessons`);
    assert.equal(item.objectives.length, 3);
    item.objectives.forEach((objective) => {
      assert.equal(objective.hints.length, 3);
      assert.match(objective.hints[0], /identify the source, time window, and result/i);
      assert.match(objective.hints[1], /Use .* to inspect/i);
      assert.match(objective.hints[2], /^Example:/);
    });
    const expectedReady = ['applied-linux-A01','applied-linux-A02','applied-linux-A03'].includes(item.unitId)
      || ['applied-linux-a04-l1','applied-linux-a04-l2','applied-linux-a04-l3'].includes(item.id)
      || ['applied-linux-A05','applied-linux-A06','applied-linux-A07','applied-linux-A08','applied-linux-A09','applied-linux-A10','sre-operations-B01','sre-operations-B02','sre-operations-B03','sre-operations-B04','sre-operations-B05'].includes(item.unitId);
    assert.equal(item.implementationStatus, expectedReady ? 'ready' : 'preview');
  }
  const worked = lessons.find((item) => item.id === 'applied-linux-a09-l3');
  const ddev = lessons.find((item) => item.id === 'applied-linux-a09-l2');
  assert.match(worked.scenario, /Port 443 is occupied/);
  assert.match(ddev.scenario, /30001/);
  assert.match(worked.expectedOutcomes.join(' '), /404/);
  assert.match(worked.expectedOutcomes.join(' '), /200/);
});

test('every curriculum lesson is independently startable without prerequisite completion', () => {
  assert.ok(lessons.length === 60);
  for (const item of lessons) assert.deepEqual(item.prerequisites, [], `${item.id} must be independently startable`);
});

test('B01 monitoring dashboards compute from attempt fixtures and validate evidence across all three lessons', () => {
  const start = (id) => {
    const definition = lessons.find((item) => item.id === id);
    const env = initialAttemptState({ id, starting_environment: createEnvironment() });
    assert.equal(env.monitoring?.dashboards.length, 3);
    return { definition, env };
  };
  const run = (env, command) => executeCommand(env, command);
  const first = start('sre-operations-b01-l1');
  run(first.env, 'dashboard scope account=linuxlab-training role=MetricsReadOnly region=training-west-1 timezone=UTC');
  for (const id of ['fleet', 'traffic', 'history']) run(first.env, 'dashboard open ' + id);
  assert.equal(validateTask(first.definition.objectives[0], first.env, 'dashboard open history', { exitCode: 0 }), true);
  for (const metric of ['CPUUtilization statistic=Average', 'NetworkPacketsIn statistic=Sum', 'NetworkPacketsOut statistic=Sum']) {
    const command = 'dashboard metric ' + metric.replace(' statistic=', ' resource=WEB-1 statistic=') + ' period=5m';
    assert.equal(run(first.env, command).exitCode, 0);
  }
  assert.equal(validateTask(first.definition.objectives[1], first.env, 'dashboard metric', { exitCode: 0 }), true);
  assert.notEqual(run(first.env, 'dashboard metric CPUUtilization resource=WEB-1 statistic=Sum period=5m').exitCode, 0);
  run(first.env, 'dashboard metric MemoryUsed resource=WEB-1 statistic=Average period=5m');
  const freshness = run(first.env, 'dashboard verify freshness');
  assert.match(freshness.stdout, /training-agent custom metric fixture/);
  assert.equal(validateTask(first.definition.objectives[2], first.env, 'dashboard verify freshness', freshness), true);

  const second = start('sre-operations-b01-l2');
  let mondayComparison;
  for (const window of ['monday-09', 'wednesday-09', 'monthly']) {
    const result = run(second.env, 'dashboard compare window=' + window);
    if (window === 'monday-09') mondayComparison = result;
  }
  const compared = second.env.monitoring.comparisonHistory['monday-09'];
  assert.ok(mondayComparison.stdout);
  assert.match(mondayComparison.stdout, /3000 \| 2525 \| 475/);
  assert.equal(validateTask(second.definition.objectives[0], second.env, 'dashboard compare window=monthly', { exitCode: 0 }), true);
  const calculated = run(second.env, 'dashboard calculate window=monday-09');
  assert.match(calculated.stdout, /84\.17%/);
  assert.equal(validateTask(second.definition.objectives[1], second.env, 'dashboard calculate window=monday-09', calculated), true);
  const analysis = run(second.env, 'dashboard submit note=' + encodeURIComponent('Monday shows failed processing; Wednesday shows reduced demand; monthly WEB-3 has missing reporting. This pattern is not automatically harmless.'));
  assert.equal(validateTask(second.definition.objectives[2], second.env, 'dashboard submit', analysis), true);

  const third = start('sre-operations-b01-l3');
  const baseline = run(third.env, 'dashboard baseline resource=WEB-2 window=90d statistic=Average period=15d');
  assert.match(baseline.stdout, /5\/6 samples; mean=54\.00%/);
  assert.equal(validateTask(third.definition.objectives[0], third.env, 'dashboard baseline', baseline), true);
  const buffer = run(third.env, 'dashboard buffer percentage-points=5 relative-percent=5');
  assert.match(buffer.stdout, /59\.00%/);
  assert.match(buffer.stdout, /56\.70%/);
  assert.equal(validateTask(third.definition.objectives[1], third.env, 'dashboard buffer', buffer), true);
  const report = run(third.env, 'dashboard submit note=' + encodeURIComponent('One sample is missing in the 90d series at 15d resolution. A 5 percentage-point buffer differs from a 5 percent relative buffer.'));
  assert.equal(validateTask(third.definition.objectives[2], third.env, 'dashboard submit', report), true);
});

test('B02 alarm state, notification deduplication, timeline, report, and CSV derive from attempt data', () => {
  const start = (lessonId) => {
    const definition = lessons.find((item) => item.id === lessonId);
    return { definition, env: initialAttemptState({ id: lessonId, starting_environment: createEnvironment() }) };
  };
  const run = (env, command) => executeCommand(env, command);

  const first = start('sre-operations-b02-l1');
  const inspected = run(first.env, 'incident inspect-alarm');
  assert.match(inspected.stdout, /datapoints to alarm=2/i);
  assert.equal(validateTask(first.definition.objectives[0], first.env, 'incident inspect-alarm', inspected), true);
  const evaluation = run(first.env, 'incident evaluate-alarm');
  assert.match(evaluation.stdout, /state=ALARM · 2 of 3 points breach; 1 missing/);
  assert.equal(validateTask(first.definition.objectives[1], first.env, 'incident evaluate-alarm', evaluation), true);
  const alarmNote = run(first.env, 'incident submit-alarm note=' + encodeURIComponent('ALARM because 2 of 3 periods breach 70%. One missing datapoint is treated as notBreaching.'));
  assert.equal(validateTask(first.definition.objectives[2], first.env, 'incident submit-alarm', alarmNote), true);
  const missingOnly = structuredClone(first.env);
  missingOnly.incident.alarm.points = missingOnly.incident.alarm.points.map((point) => ({ ...point, value: null }));
  missingOnly.incident.alarm.missingDataTreatment = 'missing';
  assert.match(run(missingOnly, 'incident inspect-alarm').stdout, /Missing data treatment=missing/);
  assert.match(run(missingOnly, 'incident evaluate-alarm').stdout, /INSUFFICIENT_DATA/);

  const second = start('sre-operations-b02-l2');
  run(second.env, 'incident inspect-composite');
  run(second.env, 'incident inspect-service');
  assert.equal(validateTask(second.definition.objectives[0], second.env, 'incident inspect-service', { exitCode: 0 }), true);
  const grouping = run(second.env, 'incident group-notifications');
  assert.match(grouping.stdout, /Notices=3 · distinct incident IDs=2/);
  assert.equal(validateTask(second.definition.objectives[1], second.env, 'incident group-notifications', grouping), true);
  const correlation = run(second.env, 'incident submit-correlation note=' + encodeURIComponent('The alarm is a state, notifications are messages, and INC-704 and INC-705 are distinct incidents. There is no verified mapping to Normal, Cautious, or Serious.'));
  assert.equal(validateTask(second.definition.objectives[2], second.env, 'incident submit-correlation', correlation), true);

  const third = start('sre-operations-b02-l3');
  const fields = {
    timeAndTimezone: '2026-11-22 09:00–09:18 UTC',
    resource: 'WEB-3',
    alarmAndMetric: 'WEB-3-CPU-high; CPUUtilization Average 300s threshold 70',
    impact: 'training-web degraded; 12/100 request errors',
    evidence: '71%, missing datapoint, 74%; health checks 2 of 3',
    actions: 'Inspected alarm, correlated service evidence, grouped notifications',
    escalationAndOwner: 'Training-on-call escalation; current owner trainee',
    recovery: 'Recovery not verified from supplied evidence',
    nextAction: 'Repeat the health check and monitor CPU readings',
  };
  assert.notEqual(run(third.env, 'incident save-report data=' + encodeURIComponent(JSON.stringify(fields))).exitCode, 0);
  const timeline = run(third.env, 'incident build-timeline timezone=UTC');
  assert.match(timeline.stdout, /\| metric \| WEB-3/);
  assert.equal(validateTask(third.definition.objectives[0], third.env, 'incident build-timeline', timeline), true);
  const saved = run(third.env, 'incident save-report data=' + encodeURIComponent(JSON.stringify(fields)));
  assert.equal(validateTask(third.definition.objectives[1], third.env, 'incident save-report', saved), true);
  const csv = run(third.env, 'incident export-csv');
  assert.match(csv.stdout, /timeAndTimezone,resource,alarmAndMetric/);
  assert.equal(validateTask(third.definition.objectives[2], third.env, 'incident export-csv', csv), false);
  const handover = run(third.env, 'incident submit-handover note=' + encodeURIComponent('Keep the 3-hour reporting cadence. Serious incidents are escalated immediately, not after the report interval. Recovery is not verified.'));
  assert.equal(validateTask(third.definition.objectives[2], third.env, 'incident submit-handover', handover), true);
});

test('B03 traces, route ordering, and proxy verification derive from attempt evidence', () => {
  const start = (lessonId) => {
    const definition = lessons.find((item) => item.id === lessonId);
    return { definition, env: initialAttemptState({ id: lessonId, starting_environment: createEnvironment() }) };
  };
  const run = (env, command) => executeCommand(env, command);

  const trace = start('sre-operations-b03-l1');
  const events = run(trace.env, 'trace inspect REQ-7F21');
  assert.match(events.stdout, /Kiosk UI/);
  assert.match(events.stdout, /QR Service/);
  assert.match(events.stdout, /No settlement or cash-in completion event/);
  assert.equal(validateTask(trace.definition.objectives[0], trace.env, 'trace inspect REQ-7F21', events), true);
  assert.equal(validateTask(trace.definition.objectives[1], trace.env, 'trace inspect REQ-7F21', events), true);
  const traceNote = run(trace.env, 'trace explain note=' + encodeURIComponent('Kiosk UI called API Core, which called QR Service and returned a QR. Settlement is missing and not observed. AFOD, GW2, and ECPay are names to confirm; matching references do not confirm one server.'));
  assert.equal(validateTask(trace.definition.objectives[2], trace.env, 'trace explain', traceNote), true);

  const route = start('sre-operations-b03-l2');
  const inspected = run(route.env, 'routing inspect');
  assert.equal(validateTask(route.definition.objectives[0], route.env, 'routing inspect', inspected), true);
  const broken = run(route.env, 'routing test path=/invoice/21/INV-21');
  assert.match(broken.stdout, /selects \/invoice\/\*/);
  run(route.env, 'routing fix-order');
  run(route.env, 'routing test path=/invoice/1/INV-10');
  const corrected = run(route.env, 'routing test path=/invoice/21/INV-21');
  assert.match(corrected.stdout, /selects \/invoice\/21\/\*/);
  assert.equal(validateTask(route.definition.objectives[1], route.env, 'routing test', corrected), true);
  const routeNote = run(route.env, 'routing explain note=' + encodeURIComponent('The specific /invoice/21 behavior must come before the general path. The load balancer is a separate downstream layer. Forwarded header and query settings and cache behavior matter; request body values are not inspected by path matching.'));
  assert.equal(validateTask(route.definition.objectives[2], route.env, 'routing explain', routeNote), true);

  const proxy = start('sre-operations-b03-l3');
  const initial = run(proxy.env, 'proxy inspect');
  assert.match(initial.stdout, /hostname=api-client\.training\.test; path=\/v1\/qr/);
  assert.match(initial.stdout, /hostname mismatch/);
  assert.equal(validateTask(proxy.definition.objectives[0], proxy.env, 'proxy inspect', initial), true);
  run(proxy.env, 'proxy repair training-route');
  const restarted = run(proxy.env, 'proxy restart api-core');
  assert.match(restarted.stdout, /HTTP 503/);
  assert.match(restarted.stdout, /HTTP 200/);
  const response = run(proxy.env, 'proxy test training-route');
  assert.match(response.stdout, /response=200 QR=QR-TRAINING-7F21/);
  assert.equal(validateTask(proxy.definition.objectives[1], proxy.env, 'proxy test training-route', response), true);
  const explanation = run(proxy.env, 'proxy explain note=' + encodeURIComponent('Hostname differs from URL path. TLS matches the repaired hostname. Web reaches API Core through the proxy; cache and worker roles are separate. QR does not prove cash-in completion.'));
  assert.equal(validateTask(proxy.definition.objectives[2], proxy.env, 'proxy explain', explanation), true);
});

test('B04 security findings, event parsing, and sign-in confidence use supplied records', () => {
  const start = (lessonId) => {
    const definition = lessons.find((item) => item.id === lessonId);
    return { definition, env: initialAttemptState({ id: lessonId, starting_environment: createEnvironment() }) };
  };
  const run = (env, command) => executeCommand(env, command);

  const findings = start('sre-operations-b04-l1');
  const inspected = run(findings.env, 'security inspect-findings');
  assert.match(inspected.stdout, /EC2/);
  assert.match(inspected.stdout, /ECR/);
  assert.match(inspected.stdout, /Lambda/);
  assert.equal(validateTask(findings.definition.objectives[0], findings.env, 'security inspect-findings', inspected), true);
  const findingsNote = run(findings.env, 'security record-findings note=' + encodeURIComponent('EC2 openssl 3.0.11-r0 HIGH 2026-11-22T08:40:00Z completed; agent heartbeat 08:39Z upgrade to 3.0.13-r0 training-platform. ECR libxml2 2.11.5-r1 MEDIUM 2026-11-22T08:42:00Z completed; image digest sha256:train17 rebuild image with 2.11.7-r0 training-containers. Lambda requests 2.31.0 LOW 2026-11-22T08:45:00Z partial; one layer not scanned update dependency to 2.32.0 and rescan training-payments. A finding is not evidence of exploitation.'));
  assert.equal(validateTask(findings.definition.objectives[1], findings.env, 'security record-findings', findingsNote), true, JSON.stringify(findings.env.security.findings.map((item) => ({ package: item.package, installedVersion: item.installedVersion, severity: item.severity, scanTime: item.scanTime, coverage: item.coverage, suggestedFix: item.suggestedFix }))));
  assert.equal(validateTask(findings.definition.objectives[2], findings.env, 'security record-findings', findingsNote), true);

  const event = start('sre-operations-b04-l2');
  const raw = run(event.env, 'security inspect-event');
  assert.match(raw.stdout, /"event_id":4625/);
  assert.match(raw.stdout, /sshd-training/);
  assert.equal(validateTask(event.definition.objectives[0], event.env, 'security inspect-event', raw), true);
  const eventNote = run(event.env, 'security record-event note=' + encodeURIComponent('Decoder sshd-training and rule 5710 assign medium severity to endpoint edge-07 at 2026-11-22T09:16:22Z. The raw message and source IP are raw evidence; the rule interpretation is not raw. Collection sends it through analysis to storage and display.'));
  assert.equal(validateTask(event.definition.objectives[1], event.env, 'security record-event', eventNote), true);
  assert.equal(validateTask(event.definition.objectives[2], event.env, 'security record-event', eventNote), true);

  const signins = start('sre-operations-b04-l3');
  const filtered = run(signins.env, 'security filter-signins window=09:00-10:00Z');
  assert.match(filtered.stdout, /5 sign-in events/);
  assert.equal(validateTask(signins.definition.objectives[0], signins.env, 'security filter-signins', filtered), true);
  const grouped = run(signins.env, 'security correlate-signins');
  assert.match(grouped.stdout, /mrivera/);
  assert.match(grouped.stdout, /authorized support record=true/);
  assert.equal(validateTask(signins.definition.objectives[1], signins.env, 'security correlate-signins', grouped), true);
  const assessment = run(signins.env, 'security report-signins note=' + encodeURIComponent('Confidence is low because the same source has both failures and an authorized support success. This is not confirmed compromise. Evidence includes endpoint and ticket context. Next step is verify the ticket and source with the service owner.'));
  assert.equal(validateTask(signins.definition.objectives[2], signins.env, 'security report-signins', assessment), true);
});

test('B05 release layers, scale evidence, and rollout status update from attempt records', () => {
  const start = (lessonId) => {
    const definition = lessons.find((item) => item.id === lessonId);
    return { definition, env: initialAttemptState({ id: lessonId, starting_environment: createEnvironment() }) };
  };
  const run = (env, command) => executeCommand(env, command);

  const layers = start('sre-operations-b05-l1');
  const inspected = run(layers.env, 'release inspect-layers');
  assert.match(inspected.stdout, /ami-train-2026\.11/);
  assert.match(inspected.stdout, /task-17/);
  assert.equal(validateTask(layers.definition.objectives[0], layers.env, 'release inspect-layers', inspected), true);
  const published = run(layers.env, 'release publish image=linuxlab/api:1.9');
  assert.match(published.stdout, /Running tasks are unchanged/);
  run(layers.env, 'release update-task-definition');
  assert.equal(validateTask(layers.definition.objectives[1], layers.env, 'release update-task-definition', { exitCode: 0 }), true);
  const layerNote = run(layers.env, 'release explain-layers note=' + encodeURIComponent('AMI and launch template control host launch configuration, while task definition points to the container image. A new launch can use changed configuration; existing running tasks remain unchanged until replaced.'));
  assert.equal(validateTask(layers.definition.objectives[2], layers.env, 'release explain-layers', layerNote), true);

  const scaling = start('sre-operations-b05-l2');
  const setup = run(scaling.env, 'scale inspect');
  assert.match(setup.stdout, /desired=4 running=3/);
  assert.match(setup.stdout, /120 requests\/minute/);
  assert.equal(validateTask(scaling.definition.objectives[0], scaling.env, 'scale inspect', setup), true);
  const comparison = run(scaling.env, 'scale compare');
  assert.match(comparison.stdout, /Sent 6/);
  assert.match(comparison.stdout, /Gateway arrived 5/);
  assert.match(comparison.stdout, /Successful 3/);
  assert.equal(validateTask(scaling.definition.objectives[1], scaling.env, 'scale compare', comparison), true);
  const capacityNote = run(scaling.env, 'scale explain note=' + encodeURIComponent('Task capacity does not raise the partner rate ceiling or prove end-to-end success. This is separate from Kubernetes: Pods run on nodes and replicas describe desired workload count, not ECS tasks.'));
  assert.equal(validateTask(scaling.definition.objectives[2], scaling.env, 'scale explain', capacityNote), true);

  const rollout = start('sre-operations-b05-l3');
  const release = run(rollout.env, 'rollout inspect');
  assert.match(release.stdout, /task-17 running=linuxlab\/api:2\.1/);
  assert.match(release.stdout, /EventBridge rule training-release-watch/);
  assert.equal(validateTask(rollout.definition.objectives[0], rollout.env, 'rollout inspect', release), true);
  const verified = run(rollout.env, 'rollout verify');
  assert.match(verified.stdout, /stale running tasks=task-17/);
  assert.match(verified.stdout, /non-200 health responses=1/);
  assert.equal(validateTask(rollout.definition.objectives[1], rollout.env, 'rollout verify', verified), true);
  const handover = run(rollout.env, 'rollout handover note=' + encodeURIComponent('Verified registry and task definition are api:2.2, but task-17 remains stale. Health is mixed; the log and metric show remaining errors. The EventBridge trigger is the training-release-watch rule. Remaining work is replace task-17 and recheck health.'));
  assert.equal(validateTask(rollout.definition.objectives[2], rollout.env, 'rollout handover', handover), true);
});

test('A04 HTTPS and allowlisting lesson verifies certificate and preserves proxy uncertainty', () => {
  const definition = lessons.find((item) => item.id === 'applied-linux-a04-l3');
  const env = initialAttemptState({ id: definition.id, starting_environment: createEnvironment() });
  const certificate = executeCommand(env, 'openssl s_client -connect api.training.test:443 -servername api.training.test');
  assert.match(certificate.stdout, /TLS terminates at training edge proxy/);
  assert.match(certificate.stdout, /verification=OK/);
  assert.equal(validateTask(definition.objectives[0], env, 'openssl s_client -connect api.training.test:443 -servername api.training.test', certificate), true);
  const event = executeCommand(env, 'waf inspect');
  assert.match(event.stdout, /observed source=10\.24\.8\.12/);
  assert.match(event.stdout, /forwarded-for=198\.51\.100\.24/);
  assert.match(event.stdout, /Proxy handling.*unconfirmed/);
  assert.equal(validateTask(definition.objectives[1], env, 'waf inspect', event), true);
  const noteText = 'The certificate hostname api.training.test is valid and TLS terminates at the edge proxy. WAF observed 10.24.8.12 with X-Forwarded-For 198.51.100.24 while allowlist is 198.51.100.0/24. Proxy handling is not confirmed; we need confirmation which source IP the allowlist uses.';
  const report = executeCommand(env, `echo "${noteText}"`);
  assert.equal(validateTask(definition.objectives[2], env, `echo "${noteText}"`, report), true);
  const unsupported = executeCommand(env, 'echo "X-Forwarded-For is definitely trusted"');
  assert.equal(validateTask(definition.objectives[2], env, 'echo "X-Forwarded-For is definitely trusted"', unsupported), false);
});

test('A06 psql session mutates an isolated database and filters its own records', () => {
  const definition = lessons.find((item) => item.id === 'applied-linux-a06-l1');
  const base = createEnvironment();
  const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
  const connect = executeCommand(env, 'psql -h db.training.test -p 5432 -U trainee incidents_lab');
  assert.equal(connect.exitCode, 0, connect.stderr);
  assert.match(connect.stdout, /Connected to database/);
  assert.deepEqual(Object.keys(env.practiceDatabases.incidents_lab.tables), []);

  const create = executeCommand(env, 'CREATE TABLE incidents (id integer, severity text, service text);');
  assert.equal(create.exitCode, 0, create.stderr);
  const insert = executeCommand(env, "INSERT INTO incidents (id, severity, service) VALUES (1, 'high', 'api'), (2, 'low', 'web'), (3, 'high', 'worker');");
  assert.equal(insert.exitCode, 0, insert.stderr);
  assert.equal(env.practiceDatabases.incidents_lab.tables.incidents.rows.length, 3);

  const query = executeCommand(env, "SELECT * FROM incidents WHERE severity = 'high';");
  assert.equal(query.exitCode, 0, query.stderr);
  assert.equal(query.rows.length, 2);
  assert.match(query.stdout, /api/);
  assert.match(query.stdout, /worker/);
  const count = executeCommand(env, "SELECT COUNT(*) FROM incidents WHERE severity = 'high';");
  assert.match(count.stdout, /2$/);
  assert.equal(executeCommand(env, '\\q').exitCode, 0);
  assert.equal(env.databaseSession, null);
  assert.equal(Object.keys(env.files).some((path) => path.includes('incidents_lab')), false);
});

test('A06 tasks require the intended connection, real rows, matching query results, and careful warehouse claims', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completed = [];
    for (const command of commands) {
      const result = executeCommand(env, command);
      completed = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completed }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    }
    assert.equal(completed.length, definition.objectives.length);
  };
  runLesson('applied-linux-a06-l1', [
    'cat /home/learner/db-connection.txt',
    'psql -h db.training.test -p 5432 -U trainee incidents_lab',
    '\\conninfo',
  ]);
  runLesson('applied-linux-a06-l2', [
    'psql -h db.training.test -p 5432 -U trainee incidents_lab',
    'CREATE TABLE incidents (id integer, severity text, service text);',
    "INSERT INTO incidents (id, severity, service) VALUES (1, 'high', 'api'), (2, 'low', 'web'), (3, 'high', 'worker');",
    '\\d incidents',
  ]);
  runLesson('applied-linux-a06-l3', [
    'psql -h db.training.test -p 5432 -U trainee incidents_lab',
    'CREATE TABLE incidents (id integer, severity text, service text);',
    "INSERT INTO incidents (id, severity, service) VALUES (1, 'high', 'api'), (2, 'low', 'web'), (3, 'high', 'worker');",
    "SELECT * FROM incidents WHERE severity = 'high';",
    "SELECT COUNT(*) FROM incidents WHERE severity = 'high';",
    '\\q',
    'echo "The reporting warehouse is separate; its transaction path is not confirmed."',
  ]);
});

test('A07 archives, transfers, hashes, extracts, and leaves unrelated recovery files unchanged', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completed = [];
    for (const command of commands) {
      const result = executeCommand(env, command);
      completed = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completed }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    }
    assert.equal(completed.length, definition.objectives.length);
    return env;
  };
  runLesson('applied-linux-a07-l1', [
    'cat /var/log/training/app.log', 'cat /var/log/training/system.log',
    'tar -czf training-logs-2026-11-22.tar.gz /var/log/training/app.log /var/log/training/system.log',
    'tar -tzf training-logs-2026-11-22.tar.gz',
  ]);
  for (const lessonId of ['applied-linux-a07-l1','applied-linux-a07-l2','applied-linux-a07-l3']) {
    const lesson = lessons.find((item) => item.id === lessonId);
    assert.ok(lesson.objectives.every((task) => task.hints[2].startsWith('Example:') && !task.hints[2].includes('<the resource')));
  }
  const transferred = runLesson('applied-linux-a07-l2', [
    'cat /home/learner/connection.txt',
    'scp training-logs-2026-11-22.tar.gz learner@backup-01.training.test:/srv/backups/',
    'scp learner@backup-01.training.test:/srv/backups/training-logs-2026-11-22.tar.gz /tmp/backup-copy.tar.gz',
    'sha256sum training-logs-2026-11-22.tar.gz /tmp/backup-copy.tar.gz',
  ]);
  assert.ok(transferred.hosts['backup-01.training.test'].archives['/srv/backups/training-logs-2026-11-22.tar.gz']);
  const recovered = runLesson('applied-linux-a07-l3', [
    'mkdir -p /srv/recovery/var/log/training',
    'tar -xzf training-logs-2026-11-22.tar.gz -C /srv/recovery',
    'sha256sum /srv/recovery/var/log/training/app.log /var/log/training/app.log /srv/recovery/var/log/training/system.log /var/log/training/system.log',
  ]);
  assert.equal(recovered.files['/srv/recovery/unrelated.txt'].content, 'preserve this file');
});

test('A08 executes only the documented report-script subset and runs schedules on the simulated clock', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completed = [];
    for (const command of commands) {
      const result = executeCommand(env, command);
      completed = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completed }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    }
    assert.equal(completed.length, definition.objectives.length);
    return env;
  };
  runLesson('applied-linux-a08-l1', [
    'printf "echo \\"Host: \\$HOSTNAME\\"\\necho \\"Disk: \\$DISK\\"\\necho \\"Memory: \\$MEMORY\\"\\necho \\"Service: \\$SERVICE\\"\\n" > daily-report.sh',
    'bash daily-report.sh > daily-report.txt',
    'cat daily-report.txt',
  ]);
  const repair = runLesson('applied-linux-a08-l2', ['ls -l daily-report.sh', 'chmod 0755 daily-report.sh', './daily-report.sh']);
  assert.equal(repair.files['/home/learner/daily-report.sh'].mode, '0755');
  const schedule = runLesson('applied-linux-a08-l3', [
    'crontab add "0 9 * * * /home/learner/daily-report.sh" UTC',
    'training-clock advance 2h',
    'cat daily-report.txt',
  ]);
  assert.deepEqual(schedule.schedule.runs.map((run) => run.time), ['2026-11-22T09:00:00.000Z']);
  const failed = executeCommand(schedule, 'bash /home/learner/not-a-script.sh');
  assert.equal(failed.exitCode, 1);
  assert.match(failed.stderr, /No such file/);
});

test('A09 container inspection, DDEV logs, occupied ports, and corrected endpoint derive from attempt state', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completed = [];
    for (const command of commands) {
      const result = executeCommand(env, command);
      completed = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completed }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    }
    assert.equal(completed.length, definition.objectives.length);
    return env;
  };
  const inspected = runLesson('applied-linux-a09-l1', ['docker ps -a', 'docker inspect api-sim-web', 'docker logs api-sim-web']);
  assert.equal(inspected.containers[0].status, 'exited');
  const deniedRestart = executeCommand(inspected, 'docker restart api-sim-web');
  assert.equal(deniedRestart.exitCode, 1);
  assert.equal(inspected.containers[0].restartCount, 3);
  runLesson('applied-linux-a09-l2', [
    'ddev list', 'ddev describe api-sim', 'ddev logs api-sim',
    'cat /var/log/training/ddev-startup.log', 'cat /var/log/training/app.log',
    'echo api-sim is running at https://api.training.test:30001',
  ]);
  const repaired = runLesson('applied-linux-a09-l3', [
    'ddev config --router-https-port 30002',
    'ddev restart api-sim',
    'curl https://api.training.test:443/health',
    'curl https://api.training.test:30002/health',
    'echo "The old 443 route returns 404; the DDEV 30002 address returns 200 based on these checks."',
  ]);
  assert.equal(repaired.ddevProjects['api-sim'].url, 'https://api.training.test:30002');
});

test('A10 virtual printer config, job IDs, cancellation, and replacement preserve unrelated work', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completed = [];
    for (const command of commands) {
      const result = executeCommand(env, command);
      completed = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completed }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    }
    assert.equal(completed.length, definition.objectives.length);
    return env;
  };
  const configured = runLesson('applied-linux-a10-l1', [
    'lpinfo -v',
    'lpadmin -p lab_printer -E -v ipp://printer.training.test/ipp/print -m everywhere',
    'lpstat -p',
  ]);
  assert.equal(configured.printerQueues.lab_printer.uri, 'ipp://printer.training.test/ipp/print');
  const submitted = runLesson('applied-linux-a10-l2', [
    'cat /home/learner/monthly-report.pdf',
    'lp -d lab_printer /home/learner/monthly-report.pdf',
    'lpstat -o',
  ]);
  assert.equal(submitted.printJobs[0].status, 'queued');
  const triaged = runLesson('applied-linux-a10-l3', [
    'lpstat -o',
    'cancel lab_printer-204',
    'lp -d lab_printer /home/learner/replacement-report.pdf',
    'lpstat -o',
  ]);
  assert.equal(triaged.printJobs.find((job) => job.id === 204).status, 'cancelled');
  assert.equal(triaged.printJobs.find((job) => job.id === 205).status, 'queued');
  assert.equal(triaged.printJobs.find((job) => job.document === 'replacement-report.pdf').status, 'queued');
});

test('A01 configuration lessons preserve evidence, backup, edit, validate, reload, and verify state', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completedTasks = [];
    commands.forEach((command) => {
      const result = executeCommand(env, command);
      completedTasks = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completedTasks }, command, result });
      assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    });
    assert.equal(completedTasks.length, definition.objectives.length);
    return env;
  };

  runLesson('applied-linux-a01-l1', [
    'ls /opt/training-api',
    'cat /opt/training-api/config.json',
    'cat /opt/training-api/README.txt',
    'echo "actual 8080 requested 8081 mismatch"',
  ]);
  const changed = runLesson('applied-linux-a01-l2', [
    'cp /opt/training-api/config.json /opt/training-api/config.json.bak',
    'editor set /opt/training-api/config.json .port 8081',
    'jq -r .port /opt/training-api/config.json',
  ]);
  assert.equal(JSON.parse(changed.files['/opt/training-api/config.json.bak'].content).port, 8080);
  assert.equal(JSON.parse(changed.files['/opt/training-api/config.json'].content).port, 8081);

  const verified = runLesson('applied-linux-a01-l3', [
    'systemctl restart training-api',
    'curl https://api.training.test:8081/health',
    'cat /var/log/training-api/app.log',
    'echo "changed port 8081 verified HTTP 200"',
  ]);
  assert.equal(verified.services['training-api'], 'active (running)');
  assert.match(verified.files['/var/log/training-api/app.log'].content, /restart completed/);
});

test('A02 permission lessons diagnose the boundary, grant scoped access, and test both users', () => {
  const runLesson = (lessonId, commands, expectedExitCodes = []) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completedTasks = [];
    commands.forEach((command, index) => {
      const result = executeCommand(env, command);
      if (expectedExitCodes[index] !== undefined) assert.equal(result.exitCode, expectedExitCodes[index], `${command}: ${result.stderr}`);
      completedTasks = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completedTasks }, command, result });
    });
    assert.equal(completedTasks.length, definition.objectives.length);
    return env;
  };
  runLesson('applied-linux-a02-l1', [
    'whoami', 'id report-reader', 'ls -l /srv/reports/monthly.csv',
    'echo "report-reader is not finance-ops; mode 0640 gives finance-ops group read only"',
  ]);
  const grantLesson = lessons.find((item) => item.id === 'applied-linux-a02-l2');
  const unsafeBase = createEnvironment();
  const unsafeEnv = normalizeEnvironment({ ...unsafeBase, ...grantLesson.startingState, files: { ...unsafeBase.files, ...grantLesson.startingState.files } });
  const unsafe = executeCommand(unsafeEnv, 'chmod 0777 /srv/reports/monthly.csv');
  const unsafeTasks = evaluateCommand({ lessonId: grantLesson.id, attempt: { state: unsafeEnv, completed_tasks: [] }, command: 'chmod 0777 /srv/reports/monthly.csv', result: unsafe });
  assert.deepEqual(unsafeTasks, [], 'world-readable mode must not satisfy the private report task');
  runLesson('applied-linux-a02-l2', [
    'chgrp report-users /srv/reports/monthly.csv',
    'chmod 0640 /srv/reports/monthly.csv',
    'ls -l /srv/reports/monthly.csv',
  ]);
  const checks = runLesson('applied-linux-a02-l3', [
    'sudo -u report-reader cat /srv/reports/monthly.csv',
    'sudo -u guest-audit cat /srv/reports/monthly.csv',
    'echo "report-reader allowed; guest-audit denied"',
  ], [0, 1, 0]);
  assert.equal(checks.accessChecks['report-reader'].allowed, true);
  assert.equal(checks.accessChecks['guest-audit'].allowed, false);
});

test('A03 SSH sessions isolate host filesystems, persist remote changes, and retain historical prompts', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completedTasks = [];
    const results = commands.map((command) => {
      const result = executeCommand(env, command);
      completedTasks = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completedTasks }, command, result });
      return result;
    });
    assert.equal(completedTasks.length, definition.objectives.length, `${lessonId} should complete all tasks`);
    return { env, results };
  };

  const first = runLesson('applied-linux-a03-l1', [
    'cat /home/learner/connection.txt',
    'ssh learner@lab-app-01.training.test',
    'hostname',
    'whoami',
    'echo "connected to lab-app-01 as learner"',
  ]);
  assert.equal(first.results[1].hostBefore, 'learner-pc');
  assert.equal(first.results[1].hostAfter, 'lab-app-01');
  assert.equal(first.results[1].cwdBefore, '/home/learner');
  assert.equal(first.results[1].cwdAfter, '/home/learner');

  const second = runLesson('applied-linux-a03-l2', [
    'cat /home/learner/connection.txt',
    'ssh learner@lab-app-01.training.test',
    'hostname',
    'whoami',
    'cat /opt/training-api/config.json',
    'echo "lab-app-01 /opt/training-api/config.json port 8080"',
  ]);
  assert.match(second.results[4].stdout, /"port": 8080/);

  const third = runLesson('applied-linux-a03-l3', [
    'echo "remote-only scratch note persisted" > /home/learner/remote-note.txt',
    'exit',
    'ls /home/learner',
    'ssh learner@lab-app-01.training.test',
    'cat /home/learner/remote-note.txt',
  ]);
  assert.equal(third.results[1].hostBefore, 'lab-app-01');
  assert.equal(third.results[1].hostAfter, 'learner-pc');
  assert.equal(third.results[2].hostBefore, 'learner-pc');
  assert.equal(third.results[3].hostAfter, 'lab-app-01');
  assert.match(third.results[4].stdout, /remote-only scratch note persisted/);
  assert.doesNotMatch(third.results[2].stdout, /remote-note\.txt/, 'remote-only file must not leak into the local filesystem');
});

test('A03 SSH refuses an unknown fingerprint or account without changing the local prompt', () => {
  const lesson = lessons.find((item) => item.id === 'applied-linux-a03-l1');
  const base = createEnvironment();
  const env = normalizeEnvironment({ ...base, ...lesson.startingState, files: { ...base.files, ...lesson.startingState.files } });
  executeCommand(env, 'cat /home/learner/connection.txt');
  env.hostFingerprints['lab-app-01.training.test'] = 'SHA256:UNEXPECTED';
  const fingerprintFailure = executeCommand(env, 'ssh learner@lab-app-01.training.test');
  assert.equal(fingerprintFailure.exitCode, 1);
  assert.match(fingerprintFailure.stderr, /fingerprint mismatch/);
  assert.equal(fingerprintFailure.hostBefore, 'learner-pc');
  assert.equal(fingerprintFailure.hostAfter, 'learner-pc');
  env.hostFingerprints['lab-app-01.training.test'] = env.hosts['lab-app-01.training.test'].fingerprint;
  const accountFailure = executeCommand(env, 'ssh root@lab-app-01.training.test');
  assert.equal(accountFailure.exitCode, 1);
  assert.match(accountFailure.stderr, /not authorized/);
  assert.equal(accountFailure.hostAfter, 'learner-pc');
});

test('A04 network lessons derive DNS, route, listener, and endpoint observations from attempt state', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completedTasks = [];
    const results = commands.map((command) => {
      const result = executeCommand(env, command);
      completedTasks = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completedTasks }, command, result });
      return result;
    });
    assert.equal(completedTasks.length, definition.objectives.length, `${lessonId} should complete all tasks`);
    return { env, results };
  };

  const destination = runLesson('applied-linux-a04-l1', [
    'getent hosts api.training.test',
    'ip addr',
    'ip route',
    'cat /etc/training/client-destination.txt',
    'echo "DNS resolves api.training.test to 10.24.1.30 but client record says 10.24.1.31"',
  ]);
  assert.match(destination.results[0].stdout, /10\.24\.1\.30/);
  assert.match(destination.results[2].stdout, /10\.24\.1\.1/);

  const ports = runLesson('applied-linux-a04-l2', [
    'ss -ltn',
    'cat /etc/training/port-map.txt',
    'echo "API listens on 8443; requested port is 443"',
    'curl https://api.training.test:443/health',
    'curl https://api.training.test:8443/health',
    'echo "port 443 returned 404; port 8443 returned 200 healthy"',
  ]);
  assert.match(ports.results[3].stdout, /httpStatus":404/);
  assert.match(ports.results[4].stdout, /httpStatus":200/);
  assert.deepEqual(ports.env.network.endpointChecks.map(({ port, status }) => [port, status]), [[443,404],[8443,200]]);

  const wrongDestination = lessons.find((item) => item.id === 'applied-linux-a04-l1');
  const base = createEnvironment();
  const invalidEnv = normalizeEnvironment({ ...base, ...wrongDestination.startingState, files: { ...base.files, ...wrongDestination.startingState.files } });
  const invalidDns = executeCommand(invalidEnv, 'getent hosts missing.training.test');
  assert.equal(invalidDns.exitCode, 1);
  assert.deepEqual(evaluateCommand({ lessonId: wrongDestination.id, attempt: { state: invalidEnv, completed_tasks: [] }, command: 'getent hosts missing.training.test', result: invalidDns }), []);
});

test('A05 service recovery depends on permissions, config state, logs, and endpoint health', () => {
  const runLesson = (lessonId, commands) => {
    const definition = lessons.find((item) => item.id === lessonId);
    const base = createEnvironment();
    const env = normalizeEnvironment({ ...base, ...definition.startingState, files: { ...base.files, ...definition.startingState.files } });
    let completedTasks = [];
    const results = commands.map((command) => {
      const result = executeCommand(env, command);
      completedTasks = evaluateCommand({ lessonId, attempt: { state: env, completed_tasks: completedTasks }, command, result });
      return result;
    });
    assert.equal(completedTasks.length, definition.objectives.length, `${lessonId} should complete all tasks`);
    return { env, results };
  };

  runLesson('applied-linux-a05-l1', [
    'systemctl status training-site', 'ps aux', 'df -h', 'free -h',
    'echo "training-site failed because the connection pool exhausted"',
  ]);
  runLesson('applied-linux-a05-l2', [
    'cat /var/log/training/training-site.log',
    'grep "2026-11-22T09:04:12Z" /var/log/training/training-site.log',
    'echo "09:04:12 database connection pool exhausted"',
  ]);

  const recovery = lessons.find((item) => item.id === 'applied-linux-a05-l3');
  const base = createEnvironment();
  const env = normalizeEnvironment({ ...base, ...recovery.startingState, files: { ...base.files, ...recovery.startingState.files } });
  env.role = 'read-only investigator';
  const denied = executeCommand(env, 'editor set /opt/training-site/config.json .poolSize 20');
  assert.equal(denied.exitCode, 1, 'read-only exercise role cannot edit the service config');
  env.role = 'training-admin';
  const unsafe = executeCommand(env, 'editor set /opt/training-site/config.json .poolSize 12');
  assert.equal(unsafe.exitCode, 0);
  assert.equal(executeCommand(env, 'systemctl restart training-site').exitCode, 1, 'undersized pool does not recover the service');
  let completedTasks = [];
  for (const command of [
    'editor set /opt/training-site/config.json .poolSize 20',
    'systemctl restart training-site',
    'cat /var/log/training/training-site.log',
    'curl https://status.training.test/health',
    'echo "training-site poolSize 20 log verified health 200"',
  ]) {
    const result = executeCommand(env, command);
    completedTasks = evaluateCommand({ lessonId: recovery.id, attempt: { state: env, completed_tasks: completedTasks }, command, result });
  }
  assert.equal(completedTasks.length, recovery.objectives.length);
  assert.equal(env.endpoints['https://status.training.test/health'].status, 200);
  assert.match(env.files['/var/log/training/training-site.log'].content, /restart completed state=active/);
});
