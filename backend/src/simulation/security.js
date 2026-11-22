const ok = (stdout) => ({ stdout, stderr: '', exitCode: 0 });
const fail = (stderr, exitCode = 2) => ({ stdout: '', stderr, exitCode });
function decoded(command, pattern) {
  const match = command.match(pattern);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function executeSecurityCommand(env, command) {
  const security = env.security;
  if (!security) return fail('security: this attempt has no security review workspace', 1);
  if (command === 'security inspect-findings') {
    security.findingsInspected = true;
    return ok(security.findings.map((f) => `${f.id} | ${f.resourceType} ${f.resource}\n  package=${f.package} installed=${f.installedVersion} severity=${f.severity}\n  scan=${f.scanTime} coverage=${f.coverage}\n  suggested fix=${f.suggestedFix} owner=${f.owner}`).join('\n') + '\nA finding alone is not evidence of exploitation.');
  }
  const finding = decoded(command, /^security record-findings note=(.*)$/);
  if (finding !== null) {
    security.findingsNote = finding;
    return finding.trim() ? ok('Finding review saved with the supplied evidence.') : fail('security: add a supported finding summary');
  }
  if (command === 'security inspect-event') {
    security.eventInspected = true;
    return ok(`Raw event: ${JSON.stringify(security.event.raw)}\nExtracted fields: ${JSON.stringify(security.event.extracted)}\nDecoder=${security.event.decoder}\nRule=${security.event.rule.id} severity=${security.event.rule.severity} description=${security.event.rule.description}\nEndpoint=${security.event.endpoint} time=${security.event.time}\nFlow: ${security.event.flow.join(' -> ')}`);
  }
  const eventNote = decoded(command, /^security record-event note=(.*)$/);
  if (eventNote !== null) {
    security.eventNote = eventNote;
    return eventNote.trim() ? ok('Event interpretation saved separately from raw fields.') : fail('security: add an event interpretation');
  }
  if (command === 'security filter-signins window=09:00-10:00Z') {
    security.signInWindow = { start: '2026-11-22T09:00:00Z', end: '2026-11-22T10:00:00Z' };
    security.filteredSignins = security.signIns.filter((item) => item.time >= security.signInWindow.start && item.time <= security.signInWindow.end).map((item) => ({ ...item }));
    return ok(`Filtered ${security.filteredSignins.length} sign-in events in 09:00–10:00 UTC\n` + security.filteredSignins.map((item) => `${item.time} | ${item.user} | ${item.source} | ${item.endpoint} | ${item.result} | ${item.context}`).join('\n'));
  }
  if (command === 'security correlate-signins') {
    if (!security.filteredSignins) return fail('security: filter the supplied time window first', 1);
    const groups = Object.values(security.filteredSignins.reduce((map, item) => {
      const key = `${item.user}|${item.source}|${item.endpoint}`;
      map[key] ||= { user: item.user, source: item.source, endpoint: item.endpoint, events: [] };
      map[key].events.push(item);
      return map;
    }, {}));
    security.signInGroups = groups;
    return ok(groups.map((group) => `${group.user} | ${group.source} | ${group.endpoint} | ${group.events.map((item) => item.result).join(', ')} | authorized support record=${group.events.some((item) => item.authorizedSupport)}`).join('\n'));
  }
  const signInNote = decoded(command, /^security report-signins note=(.*)$/);
  if (signInNote !== null) {
    security.signInNote = signInNote;
    return signInNote.trim() ? ok('Sign-in assessment saved with confidence and follow-up.') : fail('security: add a confidence statement, evidence, and next step');
  }
  return fail('security: unsupported action. Use inspect-findings, record-findings, inspect-event, record-event, filter-signins, correlate-signins, or report-signins.');
}

export function validateSecurityTask(lessonIndex, taskIndex, env, result) {
  const s = env.security;
  if (!s || result?.exitCode !== 0) return false;
  if (lessonIndex === 0) {
    if (taskIndex === 0) return s.findingsInspected && ['EC2', 'ECR', 'Lambda'].every((type) => s.findings.some((item) => item.resourceType === type));
    const note = (s.findingsNote || '').toLowerCase();
    if (taskIndex === 1) return s.findingsInspected && s.findings.every((item) => [item.package, item.installedVersion, item.severity.toLowerCase(), item.scanTime, item.coverage.toLowerCase(), item.suggestedFix.toLowerCase()].every((term) => note.includes(String(term).toLowerCase())));
    return s.findings.every((item) => (s.findingsNote || '').includes(item.owner)) && /not.*exploit|does not prove.*exploit|no evidence.*exploit/i.test(s.findingsNote || '');
  }
  if (lessonIndex === 1) {
    const note = (s.eventNote || '').toLowerCase();
    if (taskIndex === 0) return s.eventInspected && s.event.raw.timestamp === s.event.time;
    if (taskIndex === 1) return s.eventInspected && ['decoder', s.event.decoder.toLowerCase(), s.event.rule.id.toLowerCase(), s.event.endpoint.toLowerCase(), s.event.rule.severity.toLowerCase()].every((term) => note.includes(term));
    return /raw/.test(note) && /interpret|rule/.test(note) && /not.*raw|separat/.test(note) && /collection/.test(note) && /storage/.test(note);
  }
  if (lessonIndex === 2) {
    if (taskIndex === 0) return s.signInWindow?.start === '2026-11-22T09:00:00Z' && s.filteredSignins?.length === 5;
    if (taskIndex === 1) return s.signInGroups?.some((group) => group.user === 'mrivera' && group.events.some((item) => item.result === 'failure') && group.events.some((item) => item.result === 'success'))
      && s.signInGroups?.some((group) => group.events.some((item) => item.authorizedSupport));
    const note = (s.signInNote || '').toLowerCase();
    return /confidence/.test(note) && /evidence/.test(note) && /next step|follow.up/.test(note) && /not confirmed|not enough evidence|unconfirmed/.test(note);
  }
  return false;
}
