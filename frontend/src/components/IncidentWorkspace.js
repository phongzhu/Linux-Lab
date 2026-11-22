import { useState } from 'react';
import Icon from './Icon';
import './IncidentWorkspace.css';

const reportFields = [
  ['timeAndTimezone', 'Time and timezone', '2026-11-22 09:00–09:18 UTC'],
  ['resource', 'Affected resource', 'WEB-3'],
  ['alarmAndMetric', 'Alarm and metric settings', 'Alarm name, metric, statistic, period, threshold'],
  ['impact', 'Observed impact', 'Service state and observed request errors'],
  ['evidence', 'Evidence', 'Metric readings, missing sample, log and notice IDs'],
  ['actions', 'Actions taken', 'Only actions actually performed in this exercise'],
  ['escalationAndOwner', 'Escalation and current owner', 'Training on-call route and owner'],
  ['recovery', 'Recovery status', 'Say if recovery is verified or still unknown'],
  ['nextAction', 'Recommended next action', 'A specific verification or follow-up'],
];

export default function IncidentWorkspace({ lesson, attempt, busy, requestError, onAction }) {
  const incident = attempt.state.incident || {};
  const index = lesson.lessonNumber || lesson.lessonIndex + 1;
  const [note, setNote] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [fields, setFields] = useState(incident.reportFields || {});
  const lastCommands = (attempt.commands || []).slice(-4).reverse();
  const action = (command) => onAction(command);
  const sendNote = (command) => command + ' note=' + encodeURIComponent(note);
  const saveReport = () => action('incident save-report data=' + encodeURIComponent(JSON.stringify(fields)));
  const copyCsv = async () => {
    if (incident.reportCsv && navigator.clipboard?.writeText) await navigator.clipboard.writeText(incident.reportCsv);
  };

  return <section className="incident-workspace" aria-label="Training incident workspace">
    <header className="incident-header">
      <span className="incident-header-icon"><Icon name="bolt" size={17}/></span>
      <div><b>LinuxLab Incident Desk</b><small>Simulated alarm and handover workspace</small></div>
      <span className="incident-sim-tag"><i/> TRAINING</span>
    </header>
    <div className="incident-body">
      <div className="incident-case-line"><span>CASE</span><b>WEB-3 · training-web</b><span>All timestamps UTC</span></div>

      {index === 1 && <>
        <section className="incident-panel">
          <div className="incident-panel-heading"><div><small>ALARM CONFIGURATION</small><h3>{incident.alarm?.name}</h3></div><span className="incident-state-pill">{incident.evaluation?.state || 'NOT EVALUATED'}</span></div>
          <div className="incident-config-grid">
            <div><small>Metric / statistic</small><b>{incident.alarm?.metric} · {incident.alarm?.statistic}</b></div>
            <div><small>Period / threshold</small><b>{incident.alarm?.periodSeconds}s · ≥ {incident.alarm?.threshold}%</b></div>
            <div><small>Evaluation</small><b>{incident.alarm?.datapointsToAlarm} of {incident.alarm?.evaluationPeriods} datapoints</b></div>
            <div><small>Missing data</small><b>{incident.alarm?.missingDataTreatment}</b></div>
          </div>
          <div className="incident-datapoints" aria-label="Supplied metric datapoints">{incident.alarm?.points?.map((point) => <div key={point.time}><small>{point.time.slice(11, 16)} UTC</small><b className={point.value == null ? 'missing' : ''}>{point.value == null ? 'Missing sample' : point.value + '%'}</b></div>)}</div>
          <div className="incident-actions"><button disabled={busy} onClick={() => action('incident inspect-alarm')}>Inspect full alarm settings</button><button className="primary" disabled={busy || !incident.alarmInspected} onClick={() => action('incident evaluate-alarm')}>Evaluate supplied datapoints</button></div>
        </section>
        {incident.evaluation && <div className="incident-evaluation"><b>{incident.evaluation.state}</b><span>{incident.evaluation.breaching} of {incident.evaluation.periodCount} breach · {incident.evaluation.missing} missing · {incident.alarm.missingDataTreatment} policy</span></div>}
        <label className="incident-note">Explain the alarm state<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="State why this is OK, ALARM, or INSUFFICIENT_DATA. Explain how the missing datapoint is treated."/></label>
        <button className="incident-submit" disabled={busy || !note.trim()} onClick={() => action(sendNote('incident submit-alarm'))}>Submit alarm interpretation</button>
      </>}

      {index === 2 && <>
        <div className="incident-two-column">
          <section className="incident-panel">
            <div className="incident-panel-heading"><div><small>COMPOSITE RULE</small><h3>{incident.compositeRule?.name}</h3></div><span className="incident-small-tag">fictional rule</span></div>
            <p className="incident-expression">{incident.compositeRule?.expression}</p>
            <button disabled={busy} onClick={() => action('incident inspect-composite')}>Inspect alarm relationship</button>
          </section>
          <section className="incident-panel">
            <div className="incident-panel-heading"><div><small>SERVICE EVIDENCE</small><h3>{incident.serviceEvidence?.service}</h3></div><span className="incident-state-pill">{incident.serviceEvidence?.state}</span></div>
            <p className="incident-expression">{incident.serviceEvidence?.evidence}</p>
            <button disabled={busy} onClick={() => action('incident inspect-service')}>Inspect service impact</button>
          </section>
        </div>
        <section className="incident-panel">
          <div className="incident-panel-heading"><div><small>NOTIFICATION TIMELINE</small><h3>Notices are not incident counts</h3></div><span className="incident-small-tag">{incident.notifications?.length} notices</span></div>
          <div className="incident-notification-list">{incident.notifications?.map((notice) => <div key={notice.id}><b>{notice.id}</b><span>{notice.incidentId}</span><small>{notice.time} · {notice.channel}</small></div>)}</div>
          <button className="primary" disabled={busy} onClick={() => action('incident group-notifications')}>Group by incident ID</button>
          {incident.groupedNotifications && <div className="incident-groups"><b>{incident.groupedNotifications.length} distinct incidents</b>{incident.groupedNotifications.map((group) => <span key={group.incidentId}>{group.incidentId}: {group.count} notification{group.count === 1 ? '' : 's'}</span>)}</div>}
        </section>
        <aside className="incident-label-note"><b>Status labels stay separate:</b> Cloud alarm state is OK / ALARM / INSUFFICIENT_DATA. Training status labels are {incident.statusLabels?.join(', ')}. No verified mapping is supplied.</aside>
        <label className="incident-note">Correlation finding<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Separate the alarm, each notification, and the distinct incident IDs. State whether a mapping to Normal/Cautious/Serious is verified."/></label>
        <button className="incident-submit" disabled={busy || !note.trim()} onClick={() => action(sendNote('incident submit-correlation'))}>Submit correlation finding</button>
      </>}

      {index === 3 && <>
        <section className="incident-panel">
          <div className="incident-panel-heading"><div><small>EVIDENCE TIMELINE</small><h3>Metrics, logs, service, notices</h3></div><span className="incident-small-tag">{incident.timeline?.timezone || 'Select timezone'}</span></div>
          <button disabled={busy} onClick={() => action('incident build-timeline timezone=UTC')}>Build UTC timeline</button>
          {incident.timeline && <ol className="incident-timeline">{incident.timeline.events.map((event, i) => <li key={event.time + event.type}><time>{event.time.slice(11, 19)}</time><span className={'event-dot ' + event.type}/><div><b>{event.type} · {event.resource}</b><small>{event.detail}</small></div>{i < incident.timeline.events.length - 1 && <i className="timeline-connector"/>}</li>)}</ol>}
        </section>
        <section className="incident-panel">
          <div className="incident-panel-heading"><div><small>INCIDENT REPORT</small><h3>Record evidence and handover</h3></div><span className="incident-small-tag">Required fields</span></div>
          <div className="incident-report-fields">{reportFields.map(([key, label, placeholder]) => <label key={key}>{label}<textarea rows={key === 'impact' || key === 'evidence' || key === 'nextAction' ? 2 : 1} value={fields[key] || ''} placeholder={placeholder} onChange={(event) => setFields((previous) => ({ ...previous, [key]: event.target.value }))}/></label>)}</div>
          <button className="primary" disabled={busy || !incident.timeline} onClick={saveReport}>Save incident report</button>
          {incident.reportSaved && <div className="incident-copyable"><div><b>Copyable report</b><button type="button" onClick={() => navigator.clipboard?.writeText(incident.reportText)}>Copy text</button></div><pre>{incident.reportText}</pre></div>}
          <div className="incident-export-row"><button disabled={busy || !incident.reportSaved} onClick={() => action('incident export-csv')}>Export report CSV</button>{incident.reportCsv && <button type="button" onClick={copyCsv}>Copy CSV</button>}</div>
          {incident.reportCsv && <pre className="incident-csv" aria-label="CSV export">{incident.reportCsv}</pre>}
        </section>
        <div className="incident-cadence">The fictional reporting routine is every three hours. Respond to a serious condition promptly; the reporting interval is not a waiting period.</div>
        <label className="incident-note">Handover cadence and uncertainty<textarea value={handoverNote} onChange={(event) => setHandoverNote(event.target.value)} rows={2} placeholder="State the 3-hour reporting routine, immediate escalation, and remaining uncertainty."/></label>
        <button className="incident-submit" disabled={busy || !handoverNote.trim()} onClick={() => action('incident submit-handover note=' + encodeURIComponent(handoverNote))}>Submit handover note</button>
      </>}

      {requestError && <div className="incident-error" role="alert">{requestError}</div>}
      <section className="incident-activity" aria-label="Incident workspace activity"><small>RECENT WORKSPACE ACTIVITY</small>{lastCommands.length ? lastCommands.map((item) => <pre key={item.id || item.command}>{item.stderr || item.stdout || item.command}</pre>) : <p>Inspect the supplied training evidence to begin.</p>}</section>
    </div>
  </section>;
}
