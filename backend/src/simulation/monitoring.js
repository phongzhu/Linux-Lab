const resources = ['WEB-1', 'WEB-2', 'WEB-3'];

function fail(stderr, exitCode = 2) { return { stdout: '', stderr, exitCode }; }
function success(stdout) { return { stdout, stderr: '', exitCode: 0 }; }

function requestTotals(rows) {
  const present = rows.filter((row) => Number.isFinite(row.attempts) && Number.isFinite(row.successes) && Number.isFinite(row.failures));
  const attempts = present.reduce((sum, row) => sum + row.attempts, 0);
  const successes = present.reduce((sum, row) => sum + row.successes, 0);
  const failures = present.reduce((sum, row) => sum + row.failures, 0);
  return { attempts, successes, failures, successRate: attempts ? successes / attempts * 100 : null, failureRate: attempts ? failures / attempts * 100 : null };
}

export function executeMonitoringCommand(env, command) {
  const monitor = env.monitoring;
  if (!monitor) return fail('dashboard: this training attempt has no monitoring workspace', 1);

  const scope = command.match(/^dashboard scope account=([a-z-]+) role=([A-Za-z]+) region=([a-z0-9-]+) timezone=([A-Za-z/]+)$/);
  if (scope) {
    const [, account, role, region, timezone] = scope;
    if (account !== monitor.scopeOptions.account || role !== monitor.scopeOptions.role || region !== monitor.scopeOptions.region || timezone !== monitor.scopeOptions.timezone) {
      return fail('dashboard: this fictional role has no access to that account, region, or timezone', 1);
    }
    monitor.scope = { account, role, region, timezone };
    return success('Scope: account=' + account + ' role=' + role + ' region=' + region + ' timezone=' + timezone);
  }

  const open = command.match(/^dashboard open (fleet|traffic|history)$/);
  if (open) {
    const dashboard = monitor.dashboards.find((item) => item.id === open[1]);
    if (!dashboard) return fail("dashboard: unknown dashboard '" + open[1] + "'", 1);
    monitor.openedDashboards = [...new Set([...(monitor.openedDashboards || []), dashboard.id])];
    monitor.selection.dashboard = dashboard.id;
    return success(dashboard.name + ' · source=' + dashboard.source + ' · freshest sample=' + dashboard.freshness);
  }

  const metric = command.match(/^dashboard metric ([A-Za-z]+) resource=(WEB-[123]) statistic=(Average|Sum) period=(\d+m)$/);
  if (metric) {
    const [, name, resource, statistic, period] = metric;
    const definition = monitor.metrics[name];
    if (!definition) return fail("dashboard: metric '" + name + "' is not defined in this training account", 1);
    if (definition.statistic !== statistic || definition.period !== period) {
      return fail(name + ' is defined as ' + definition.statistic + ' over ' + definition.period + '; requested ' + statistic + ' over ' + period);
    }
    const value = definition.values[resource];
    const inspection = { metric: name, resource, statistic, period, value, unit: definition.unit, source: definition.source, timezone: monitor.selection.timezone, window: monitor.selection.window, freshness: monitor.dashboards.find((item) => item.id === 'fleet').freshness };
    monitor.inspections = [...(monitor.inspections || []).filter((item) => !(item.metric === name && item.resource === resource)), inspection];
    monitor.selection.resource = resource;
    return success(name + ' ' + resource + ': ' + value + ' ' + definition.unit + ' (' + statistic + ', ' + period + ', ' + inspection.timezone + '); source=' + definition.source + '; freshest sample=' + inspection.freshness);
  }

  if (command === 'dashboard verify freshness') {
    monitor.freshnessChecked = true;
    return success(monitor.dashboards.map((item) => item.name + ': ' + item.freshness + ' (' + item.source + ')').join('\n'));
  }

  const compare = command.match(/^dashboard compare window=(monday-09|wednesday-09|monthly)$/);
  if (compare) {
    const window = compare[1];
    const rows = monitor.requestWindows[window];
    if (!rows) return fail("dashboard: no training data for window '" + window + "'", 1);
    const comparison = { window, timezone: 'UTC', resources: rows.map((row) => ({ ...row })), totals: requestTotals(rows) };
    monitor.comparison = comparison;
    monitor.comparisonHistory = { ...(monitor.comparisonHistory || {}), [window]: comparison };
    monitor.selection.window = window;
    return success([
      'Window=' + window + ' timezone=UTC',
      'Resource | Attempts | Success | Failures | Log samples',
      ...comparison.resources.map((row) => row.resource + ' | ' + row.attempts + ' | ' + row.successes + ' | ' + row.failures + ' | ' + (row.logSamples ?? 'missing')),
      'Total | ' + comparison.totals.attempts + ' | ' + comparison.totals.successes + ' | ' + comparison.totals.failures + ' | —',
      'Success rate=' + comparison.totals.successRate.toFixed(2) + '%; failure rate=' + comparison.totals.failureRate.toFixed(2) + '%',
    ].join('\n'));
  }

  const calculate = command.match(/^dashboard calculate window=(monday-09|wednesday-09|monthly)$/);
  if (calculate) {
    const window = calculate[1];
    const rows = monitor.requestWindows[window];
    if (!rows) return fail("dashboard: no training data for window '" + window + "'", 1);
    const totals = requestTotals(rows);
    monitor.calculation = { window, timezone: 'UTC', ...totals };
    monitor.selection.window = window;
    return success(window + ' UTC: ' + totals.successes + '/' + totals.attempts + ' successful (' + totals.successRate.toFixed(2) + '%); ' + totals.failures + '/' + totals.attempts + ' failed (' + totals.failureRate.toFixed(2) + '%)');
  }

  const baseline = command.match(/^dashboard baseline resource=(WEB-[123]) window=90d statistic=Average period=(\d+d)$/);
  if (baseline) {
    const [, resource, period] = baseline;
    if (period !== monitor.historical.period) return fail('dashboard: historical fixture resolution is ' + monitor.historical.period);
    const values = monitor.historical.values[resource];
    const samples = values.filter(Number.isFinite);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    monitor.baseline = {
      resource, window: monitor.historical.window, statistic: monitor.historical.statistic,
      period: monitor.historical.period, expectedSamples: monitor.historical.expectedSamples,
      sampleCount: samples.length, missingSamples: monitor.historical.expectedSamples - samples.length,
      values: [...values], mean,
    };
    monitor.selection.resource = resource;
    monitor.selection.window = monitor.historical.window;
    return success(resource + ' CPUUtilization Average over ' + monitor.historical.window + ', ' + period + ' buckets: ' + samples.length + '/' + monitor.historical.expectedSamples + ' samples; mean=' + mean.toFixed(2) + '%');
  }

  const buffer = command.match(/^dashboard buffer percentage-points=(\d+(?:\.\d+)?) relative-percent=(\d+(?:\.\d+)?)$/);
  if (buffer) {
    if (!monitor.baseline) return fail('dashboard: calculate a historical baseline first', 1);
    const percentagePoints = Number(buffer[1]);
    const relativePercent = Number(buffer[2]);
    monitor.buffer = {
      percentagePoints, relativePercent,
      threshold: monitor.baseline.mean + percentagePoints,
      relativeThreshold: monitor.baseline.mean * (1 + relativePercent / 100),
    };
    return success('Baseline=' + monitor.baseline.mean.toFixed(2) + '%; +' + percentagePoints + ' percentage points=' + monitor.buffer.threshold.toFixed(2) + '%; +' + relativePercent + '% relative=' + monitor.buffer.relativeThreshold.toFixed(2) + '%');
  }

  const submit = command.match(/^dashboard submit note=(.*)$/);
  if (submit) {
    try { monitor.submittedNote = decodeURIComponent(submit[1]); }
    catch { return fail('dashboard: report text is not valid encoded text'); }
    if (!monitor.submittedNote.trim()) return fail('dashboard: add an evidence-based note before submitting');
    return success('Training note saved (' + monitor.submittedNote.trim().length + ' characters).');
  }

  return fail('dashboard: unsupported action. Use scope, open, metric, verify freshness, compare, calculate, baseline, buffer, or submit.');
}

export function validateMonitoringTask(lessonIndex, taskIndex, env, result) {
  const m = env.monitoring;
  if (!m || result?.exitCode !== 0) return false;
  if (lessonIndex === 0) {
    if (taskIndex === 0) return m.scope?.account === 'linuxlab-training' && m.scope?.role === 'MetricsReadOnly'
      && m.scope?.region === 'training-west-1' && m.scope?.timezone === 'UTC'
      && ['fleet', 'traffic', 'history'].every((id) => m.openedDashboards.includes(id));
    if (taskIndex === 1) return resources.includes(m.selection.resource)
      && ['CPUUtilization', 'NetworkPacketsIn', 'NetworkPacketsOut'].every((name) => m.inspections.some((item) => item.metric === name && item.resource === m.selection.resource && item.statistic === m.metrics[name].statistic && item.period === m.metrics[name].period));
    return m.inspections.some((item) => item.metric === 'MemoryUsed' && /training-agent custom metric fixture/.test(item.source))
      && m.freshnessChecked && m.selection.timezone === 'UTC' && !!m.selection.resource && !!m.selection.window;
  }
  if (lessonIndex === 1) {
    if (taskIndex === 0) return !!m.comparison && m.comparison.timezone === 'UTC'
      && m.comparison.resources.map((item) => item.resource).join(',') === resources.join(',')
      && m.comparison.resources.every((item) => item.logSamples === null || item.logSamples === item.attempts);
    if (taskIndex === 1) {
      const expected = requestTotals(m.requestWindows[m.calculation?.window] || []);
      return !!m.calculation && !!m.comparisonHistory?.[m.calculation.window]
        && m.calculation.attempts === expected.attempts && m.calculation.successes === expected.successes
        && m.calculation.failures === expected.failures && m.calculation.successRate === expected.successRate
        && m.calculation.failureRate === expected.failureRate;
    }
    const note = m.submittedNote.toLowerCase();
    return !!m.calculation && ['monday-09', 'wednesday-09', 'monthly'].every((window) => !!m.comparisonHistory?.[window])
      && m.comparisonHistory.monthly.resources.some((item) => item.logSamples == null)
      && ['reduced demand', 'failed processing', 'missing reporting'].every((claim) => note.includes(claim))
      && (/not harmless|not automatically harmless|needs investigation|investigate/i.test(note));
  }
  if (lessonIndex === 2) {
    if (taskIndex === 0) {
      const values = m.historical.values[m.baseline?.resource] || [];
      const samples = values.filter(Number.isFinite);
      return resources.includes(m.baseline?.resource) && m.baseline.window === '90d'
        && m.baseline.statistic === m.historical.statistic && m.baseline.period === m.historical.period
        && m.baseline.sampleCount === samples.length && m.baseline.missingSamples === m.historical.expectedSamples - samples.length;
    }
    if (taskIndex === 1) return !!m.buffer && Number.isFinite(m.baseline.mean)
      && m.buffer.percentagePoints > 0 && m.buffer.relativePercent > 0
      && Math.abs(m.buffer.threshold - (m.baseline.mean + m.buffer.percentagePoints)) < 1e-9
      && Math.abs(m.buffer.relativeThreshold - m.baseline.mean * (1 + m.buffer.relativePercent / 100)) < 1e-9;
    const note = m.submittedNote.toLowerCase();
    return !!m.baseline && !!m.buffer && /90.?d/.test(note) && /missing|gap|incomplete/.test(note) && /15.?d|resolution|sample period/.test(note)
      && /percentage.?points?/.test(note) && /relative/.test(note);
  }
  return false;
}
