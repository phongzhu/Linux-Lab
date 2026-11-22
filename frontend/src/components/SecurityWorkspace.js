import { useState } from 'react';
import './SecurityWorkspace.css';

export default function SecurityWorkspace({ lesson, attempt, busy, requestError, onAction }) {
  const security = attempt.state.security || {};
  const index = lesson.lessonNumber || lesson.lessonIndex + 1;
  const [note, setNote] = useState('');
  const activity = (attempt.commands || []).slice(-5).reverse();
  const send = (prefix) => onAction(`${prefix} note=${encodeURIComponent(note)}`);
  return <section className="security-workspace" aria-label="Security evidence workspace">
    <header><div><span>SIMULATED SECURITY OPERATIONS</span><b>{['Vulnerability findings','Event interpretation','Sign-in investigation'][index - 1]}</b></div><small>Training records only</small></header>
    <div className="security-body">
      {index === 1 && <>
        <div className="security-toolbar"><div><small>SCANNER FINDINGS</small><b>EC2 · ECR · Lambda</b></div><button disabled={busy} onClick={() => onAction('security inspect-findings')}>Inspect all findings</button></div>
        {security.findingsInspected && <div className="security-findings">{security.findings.map((finding) => <article key={finding.id}><div><b>{finding.id}</b><span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span></div><strong>{finding.resourceType} · {finding.resource}</strong><p>{finding.package} {finding.installedVersion}</p><small>Scanned {finding.scanTime}</small><small>Coverage: {finding.coverage}</small><small>Suggested: {finding.suggestedFix}</small><small>Owner: {finding.owner}</small></article>)}</div>}
        <label>Record supported finding details<textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture each resource, package/version, severity, scan time, coverage, suggested fix, and owner. State what a finding does not prove."/></label>
        <button className="security-primary" disabled={busy || !note.trim()} onClick={() => send('security record-findings')}>Submit finding review</button>
      </>}
      {index === 2 && <>
        <div className="security-toolbar"><div><small>RAW EVENT AND PARSED VIEW</small><b>Endpoint edge-07</b></div><button disabled={busy} onClick={() => onAction('security inspect-event')}>Inspect event</button></div>
        {security.eventInspected && <div className="security-event"><div><small>RAW LOG RECORD</small><pre>{JSON.stringify(security.event.raw, null, 2)}</pre></div><div><small>RULE-ASSIGNED FIELDS</small><pre>{JSON.stringify({ extracted: security.event.extracted, decoder: security.event.decoder, rule: security.event.rule }, null, 2)}</pre></div><p>Flow: {security.event.flow.join(' → ')}</p></div>}
        <label>Separate raw facts from interpretation<textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Identify decoder, rule, endpoint, severity, and time. Describe how collection and storage work; say which details are raw and which the rule assigned."/></label>
        <button className="security-primary" disabled={busy || !note.trim()} onClick={() => send('security record-event')}>Submit event interpretation</button>
      </>}
      {index === 3 && <>
        <div className="security-toolbar"><div><small>SIGN-IN EVENT REVIEW</small><b>Requested window · 09:00–10:00 UTC</b></div><button disabled={busy} onClick={() => onAction('security filter-signins window=09:00-10:00Z')}>Filter time window</button></div>
        {security.filteredSignins && <div className="security-table-wrap"><table className="security-table"><thead><tr><th>Time</th><th>User</th><th>Source</th><th>Endpoint</th><th>Result</th><th>Context</th></tr></thead><tbody>{security.filteredSignins.map((event) => <tr key={event.time}><td>{event.time.slice(11, 19)}</td><td>{event.user}</td><td>{event.source}</td><td>{event.endpoint}</td><td>{event.result}</td><td>{event.context}</td></tr>)}</tbody></table></div>}
        <button disabled={busy || !security.filteredSignins} onClick={() => onAction('security correlate-signins')}>Group by user, source, endpoint</button>
        {security.signInGroups && <div className="security-groups">{security.signInGroups.map((group) => <article key={`${group.user}-${group.source}-${group.endpoint}`}><b>{group.user} · {group.source}</b><span>{group.endpoint}</span><small>{group.events.map((event) => event.result).join(' → ')} · {group.events.some((event) => event.authorizedSupport) ? 'authorized support record present' : 'no support record in fixture'}</small></article>)}</div>}
        <label>Assessment, confidence, and next step<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="State the evidence, confidence level, and follow-up. Similar events may be unrelated; ‘not confirmed’ is acceptable when support evidence changes interpretation."/></label>
        <button className="security-primary" disabled={busy || !note.trim()} onClick={() => send('security report-signins')}>Submit sign-in assessment</button>
      </>}
      {requestError && <div className="security-error" role="alert">{requestError}</div>}
      <section className="security-activity"><small>RECENT SIMULATED ACTIONS</small>{activity.length ? activity.map((item) => <pre key={item.id || item.command}>{item.stderr || item.stdout || item.command}</pre>) : <p>Inspect the supplied evidence to begin.</p>}</section>
    </div>
  </section>;
}
