const reportKeys = ['timeAndTimezone', 'resource', 'alarmAndMetric', 'impact', 'evidence', 'actions', 'escalationAndOwner', 'recovery', 'nextAction'];
const ok = (stdout) => ({ stdout, stderr: '', exitCode: 0 });
const fail = (stderr, exitCode = 2) => ({ stdout: '', stderr, exitCode });

function parseNote(command, prefix) {
  const match = command.match(new RegExp('^' + prefix + ' note=(.*)$'));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function evaluateAlarm(alarm) {
  const points = alarm.points.slice(-alarm.evaluationPeriods);
  let breaching = 0;
  let considered = 0;
  let missing = 0;
  points.forEach(({ value }) => {
    if (value == null) {
      missing += 1;
      if (alarm.missingDataTreatment === 'breaching') { breaching += 1; considered += 1; }
      else if (alarm.missingDataTreatment === 'notBreaching') considered += 1;
      return;
    }
    considered += 1;
    if (alarm.comparison === 'greater-than-or-equal' ? value >= alarm.threshold : value <= alarm.threshold) breaching += 1;
  });
  const state = breaching >= alarm.datapointsToAlarm ? 'ALARM'
    : considered < alarm.datapointsToAlarm ? 'INSUFFICIENT_DATA'
      : 'OK';
  return { state, breaching, considered, missing, required: alarm.datapointsToAlarm, periodCount: alarm.evaluationPeriods };
}

function csvCell(value) { return '"' + String(value ?? '').replaceAll('"', '""') + '"'; }

export function executeIncidentCommand(env, command) {
  const incident = env.incident;
  if (!incident) return fail('incident: this training attempt has no incident workspace', 1);

  if (command === 'incident inspect-alarm') {
    incident.alarmInspected = true;
    const a = incident.alarm;
    return ok([
      'Alarm: ' + a.name + ' · Resource: ' + a.resource,
      'Metric=' + a.metric + ' Statistic=' + a.statistic + ' Period=' + a.periodSeconds + 's',
      'Threshold=' + a.comparison + ' ' + a.threshold + ' · Evaluation periods=' + a.evaluationPeriods + ' · Datapoints to alarm=' + a.datapointsToAlarm,
      'Missing data treatment=' + a.missingDataTreatment,
      ...a.points.map((point) => point.time + ' | ' + (point.value == null ? 'missing' : point.value + '%')),
    ].join('\n'));
  }

  if (command === 'incident evaluate-alarm') {
    if (!incident.alarmInspected) return fail('incident: inspect the full alarm configuration first', 1);
    incident.evaluation = evaluateAlarm(incident.alarm);
    return ok('Training alarm state=' + incident.evaluation.state + ' · ' + incident.evaluation.breaching + ' of ' + incident.evaluation.periodCount + ' points breach; ' + incident.evaluation.missing + ' missing; policy=' + incident.alarm.missingDataTreatment);
  }

  const alarmNote = parseNote(command, 'incident submit-alarm');
  if (alarmNote !== null) {
    if (!alarmNote.trim()) return fail('incident: add an alarm interpretation');
    incident.alarmNote = alarmNote;
    return ok('Alarm interpretation saved (' + alarmNote.trim().length + ' characters).');
  }

  if (command === 'incident inspect-composite') {
    incident.compositeInspected = true;
    const c = incident.compositeRule;
    return ok(c.name + ': ' + c.expression + ' · source=' + c.source + ' · composite alarm state=' + (incident.evaluation?.state || 'not evaluated'));
  }

  if (command === 'incident inspect-service') {
    incident.serviceInspected = true;
    const s = incident.serviceEvidence;
    return ok(s.service + ' state=' + s.state + ' observed=' + s.observedAt + ' · ' + s.evidence);
  }

  if (command === 'incident group-notifications') {
    const groups = Object.values(incident.notifications.reduce((map, notice) => {
      map[notice.incidentId] ||= { incidentId: notice.incidentId, notices: [] };
      map[notice.incidentId].notices.push({ ...notice });
      return map;
    }, {})).map((group) => ({ ...group, count: group.notices.length, firstSeen: group.notices.map((notice) => notice.time).sort()[0] }));
    incident.groupedNotifications = groups;
    return ok([
      'Notices=' + incident.notifications.length + ' · distinct incident IDs=' + groups.length,
      ...groups.map((group) => group.incidentId + ' | ' + group.count + ' notifications | first=' + group.firstSeen),
    ].join('\n'));
  }

  const correlationNote = parseNote(command, 'incident submit-correlation');
  if (correlationNote !== null) {
    if (!correlationNote.trim()) return fail('incident: add a correlation note');
    incident.correlationNote = correlationNote;
    return ok('Correlation note saved.');
  }

  const timeline = command.match(/^incident build-timeline timezone=(UTC|Asia\/Manila)$/);
  if (timeline) {
    const events = incident.timelineEvents.map((item) => ({ ...item })).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    if (events.some((item) => !Number.isFinite(Date.parse(item.time)))) return fail('incident: timeline contains an invalid timestamp', 1);
    incident.timeline = { timezone: timeline[1], events };
    return ok('Timeline built in ' + timeline[1] + ' from ' + events.length + ' fixture events.\n' + events.map((item) => item.time + ' | ' + item.type + ' | ' + item.resource + ' | ' + item.detail).join('\n'));
  }

  const save = command.match(/^incident save-report data=(.*)$/);
  if (save) {
    if (!incident.timeline) return fail('incident: build the evidence timeline before saving a handover', 1);
    let fields;
    try { fields = JSON.parse(decodeURIComponent(save[1])); } catch { return fail('incident: report data is not valid encoded JSON'); }
    if (!fields || reportKeys.some((key) => !String(fields[key] || '').trim())) return fail('incident: complete every required report field before saving');
    incident.reportFields = Object.fromEntries(reportKeys.map((key) => [key, String(fields[key]).trim()]));
    incident.reportText = reportKeys.map((key) => key + ': ' + incident.reportFields[key]).join('\n');
    incident.reportSaved = true;
    return ok('Report saved with ' + reportKeys.length + ' required fields.\n' + incident.reportText);
  }

  if (command === 'incident export-csv') {
    if (!incident.reportSaved) return fail('incident: save a complete report before exporting');
    const fields = incident.reportFields;
    incident.reportCsv = [reportKeys.join(','), reportKeys.map((key) => csvCell(fields[key])).join(',')].join('\n');
    return ok(incident.reportCsv);
  }

  const handover = parseNote(command, 'incident submit-handover');
  if (handover !== null) {
    if (!handover.trim()) return fail('incident: add the reporting cadence and remaining uncertainty');
    incident.handoverNote = handover;
    return ok('Handover note saved.');
  }

  return fail('incident: unsupported action. Use inspect-alarm, evaluate-alarm, submit-alarm, inspect-composite, inspect-service, group-notifications, submit-correlation, build-timeline, save-report, export-csv, or submit-handover.');
}

export function validateIncidentTask(lessonIndex, taskIndex, env, result) {
  const incident = env.incident;
  if (!incident || result?.exitCode !== 0) return false;
  if (lessonIndex === 0) {
    if (taskIndex === 0) return incident.alarmInspected && incident.alarm.statistic === 'Average'
      && incident.alarm.periodSeconds === 300 && incident.alarm.threshold === 70
      && incident.alarm.evaluationPeriods === 3 && incident.alarm.datapointsToAlarm === 2
      && incident.alarm.missingDataTreatment === 'notBreaching';
    if (taskIndex === 1) {
      const expected = evaluateAlarm(incident.alarm);
      return !!incident.evaluation && incident.evaluation.state === expected.state
        && incident.evaluation.state === 'ALARM' && incident.evaluation.breaching === 2
        && incident.evaluation.missing === 1;
    }
    const note = (incident.alarmNote || '').toLowerCase();
    return !!incident.evaluation && /alarm/.test(note) && /missing/.test(note)
      && /notbreaching|not breaching|non.?breach/.test(note) && /(2 of 3|2\/3|two of three)/.test(note);
  }
  if (lessonIndex === 1) {
    if (taskIndex === 0) return incident.compositeInspected && incident.serviceInspected && incident.serviceEvidence.state === 'degraded';
    if (taskIndex === 1) return incident.groupedNotifications?.length === 2
      && incident.groupedNotifications.reduce((sum, group) => sum + group.count, 0) === incident.notifications.length
      && incident.groupedNotifications.some((group) => group.incidentId === 'INC-704' && group.count === 2);
    const note = (incident.correlationNote || '').toLowerCase();
    return !!incident.groupedNotifications && /alarm/.test(note) && /notification/.test(note) && /incident/.test(note)
      && /no verified mapping|mapping.*unknown|mapping.*unconfirmed|mapping.*not supplied/.test(note);
  }
  if (lessonIndex === 2) {
    if (taskIndex === 0) {
      const events = incident.timeline?.events || [];
      return incident.timeline?.timezone === 'UTC' && events.length === incident.timelineEvents.length
        && events.map((item) => item.time).join(',') === [...events].map((item) => item.time).sort().join(',')
        && ['metric', 'log', 'notification', 'service'].every((type) => events.some((item) => item.type === type));
    }
    if (taskIndex === 1) {
      const fields = incident.reportFields || {};
      return incident.reportSaved && incident.timeline?.timezone === 'UTC' && reportKeys.every((key) => fields[key])
        && /UTC/.test(fields.timeAndTimezone) && /WEB-3/.test(fields.resource)
        && /WEB-3-CPU-high/.test(fields.alarmAndMetric) && /CPUUtilization/.test(fields.alarmAndMetric)
        && /degraded/i.test(fields.impact) && /12\/100/.test(fields.impact)
        && /71|74|notice|health/i.test(fields.evidence) && /inspect|correlat|page|escalat/i.test(fields.actions)
        && /training-on-call/i.test(fields.escalationAndOwner) && /not verified|unverified/i.test(fields.recovery)
        && /verify|review|repeat|monitor/i.test(fields.nextAction);
    }
    const note = (incident.handoverNote || '').toLowerCase();
    return incident.reportSaved && !!incident.reportCsv && incident.reportCsv.startsWith(reportKeys.join(','))
      && /3.?hour/.test(note) && /urgent|serious/.test(note) && /not delay|do not wait|immediately|without delay/.test(note)
      && /uncertain|unconfirmed|not verified/.test(note);
  }
  return false;
}
