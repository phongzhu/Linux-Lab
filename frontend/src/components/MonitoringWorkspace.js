import { useMemo, useState } from 'react';
import Icon from './Icon';
import './MonitoringWorkspace.css';

const windowLabels = {
  'monday-09': 'Monday · 09:00 UTC',
  'wednesday-09': 'Wednesday · 09:00 UTC',
  monthly: 'Monthly aggregate',
};

export default function MonitoringWorkspace({ lesson, attempt, busy, requestError, onAction }) {
  const monitoring = attempt.state.monitoring || {};
  const index = lesson.lessonNumber || lesson.lessonIndex + 1;
  const [account, setAccount] = useState(monitoring.scopeOptions?.account || '');
  const [role, setRole] = useState(monitoring.scopeOptions?.role || '');
  const [region, setRegion] = useState(monitoring.scopeOptions?.region || '');
  const [timezone, setTimezone] = useState(monitoring.scopeOptions?.timezone || 'UTC');
  const [resource, setResource] = useState('WEB-1');
  const [window, setWindow] = useState('monday-09');
  const [note, setNote] = useState('');
  const [points, setPoints] = useState('5');
  const [relative, setRelative] = useState('5');
  const [dashboardId, setDashboardId] = useState(monitoring.selection?.dashboard || 'fleet');
  const lastCommands = (attempt.commands || []).slice(-4).reverse();

  const dashboard = monitoring.dashboards?.find((item) => item.id === dashboardId);
  const comparison = monitoring.comparison;
  const baseline = monitoring.baseline;
  const metricCards = useMemo(() => Object.entries(monitoring.metrics || {}), [monitoring.metrics]);
  const inspections = monitoring.inspections || [];
  const invoke = (command) => onAction(command);
  const submitNote = () => invoke('dashboard submit note=' + encodeURIComponent(note));

  return <section className="monitor-workspace" aria-label="Training monitoring dashboard">
    <header className="monitor-header">
      <div className="monitor-mark"><Icon name="terminal" size={16}/></div>
      <div><b>LinuxLab Metrics</b><small>Fictional training data · read-only workspace</small></div>
      <span className="monitor-sim-pill"><i/> SIMULATED</span>
    </header>
    <div className="monitor-body">
      <div className="monitor-account-row">
        <span>TRAINING ACCOUNT</span><strong>{monitoring.scope?.account || 'Select a training scope'}</strong>
        <span className="monitor-region">{monitoring.scope?.region || 'Scope not applied'}</span>
      </div>

      {index === 1 && <section className="monitor-panel monitor-scope-panel">
        <div className="monitor-section-heading"><div><small>ACCESS SCOPE</small><h3>Choose your read-only view</h3></div><span>Fictional account</span></div>
        <div className="monitor-scope-fields">
          <label>Account<select value={account} onChange={(event) => setAccount(event.target.value)}><option value="linuxlab-training">linuxlab-training</option><option value="sandbox-observer">sandbox-observer</option></select></label>
          <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="MetricsReadOnly">MetricsReadOnly</option><option value="BillingViewer">BillingViewer</option></select></label>
          <label>Region<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="training-west-1">training-west-1</option><option value="training-east-1">training-east-1</option></select></label>
          <label>Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="UTC">UTC</option><option value="Asia/Manila">Asia/Manila</option></select></label>
        </div>
        <button className="monitor-primary" disabled={busy} onClick={() => invoke('dashboard scope account=' + account + ' role=' + role + ' region=' + region + ' timezone=' + timezone)}>Apply scope</button>
      </section>}

      <nav className="monitor-dashboard-tabs" aria-label="Training dashboards">
        {monitoring.dashboards?.map((item) => <button key={item.id} className={dashboardId === item.id ? 'active' : ''} disabled={busy} onClick={() => { setDashboardId(item.id); invoke('dashboard open ' + item.id); }}>
          <span>{item.name}</span>{monitoring.openedDashboards?.includes(item.id) && <b aria-label="Opened">✓</b>}
        </button>)}
      </nav>
      {dashboard && <div className="monitor-source-line"><span>{dashboard.source}</span><span>Updated {dashboard.freshness}</span></div>}

      {index === 1 && <section className="monitor-panel">
        <div className="monitor-section-heading"><div><small>FLEET OVERVIEW</small><h3>Inspect host metrics</h3></div><label className="monitor-compact-select">Resource<select value={resource} onChange={(event) => setResource(event.target.value)}><option>WEB-1</option><option>WEB-2</option><option>WEB-3</option></select></label></div>
        <div className="monitor-metric-grid">
          {metricCards.map(([name, definition]) => {
            const reading = inspections.find((item) => item.metric === name && item.resource === resource);
            return <article className="monitor-metric-card" key={name}>
              <small>{name}</small><strong>{reading ? reading.value + ' ' + reading.unit : '—'}</strong>
              <span>{definition.statistic} · {definition.period}</span>
              <button disabled={busy} onClick={() => invoke('dashboard metric ' + name + ' resource=' + resource + ' statistic=' + definition.statistic + ' period=' + definition.period)}>Inspect metric</button>
            </article>;
          })}
        </div>
        <button className="monitor-secondary" disabled={busy} onClick={() => invoke('dashboard verify freshness')}>Check freshness and metric sources</button>
      </section>}

      {index === 2 && <section className="monitor-panel">
        <div className="monitor-section-heading"><div><small>REQUEST OUTCOMES</small><h3>Compare the same window</h3></div><label className="monitor-compact-select">Window<select value={window} onChange={(event) => setWindow(event.target.value)}>{Object.entries(windowLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <p className="monitor-help">Counts are fictional records. A blank log sample means reporting coverage is missing for that resource.</p>
        {comparison && <div className="monitor-table-wrap"><table className="monitor-table"><thead><tr><th>Resource</th><th>Attempts</th><th>Success</th><th>Failed</th><th>Logs</th></tr></thead><tbody>{comparison.resources.map((row) => <tr key={row.resource}><th>{row.resource}</th><td>{row.attempts.toLocaleString()}</td><td>{row.successes.toLocaleString()}</td><td>{row.failures.toLocaleString()}</td><td>{row.logSamples == null ? 'Missing' : row.logSamples.toLocaleString()}</td></tr>)}</tbody></table>
          <div className="monitor-rate"><span>Success rate <b>{comparison.totals.successRate.toFixed(2)}%</b></span><span>Failure rate <b>{comparison.totals.failureRate.toFixed(2)}%</b></span><small>{comparison.window} · {comparison.timezone}</small></div>
        </div>}
        <div className="monitor-actions"><button className="monitor-primary" disabled={busy} onClick={() => invoke('dashboard compare window=' + window)}>Compare WEB-1, WEB-2, WEB-3</button><button className="monitor-secondary" disabled={busy} onClick={() => invoke('dashboard calculate window=' + window)}>Calculate success and failure rates</button></div>
        <label className="monitor-note-field">Interpret the evidence<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe reduced demand, failed processing, and missing reporting. Is the recurring pattern harmless? Cite the selected window." rows={3}/></label>
        <button className="monitor-submit" disabled={busy || !note.trim()} onClick={submitNote}>Submit interpretation</button>
      </section>}

      {index === 3 && <section className="monitor-panel">
        <div className="monitor-section-heading"><div><small>HISTORICAL CPU BASELINE</small><h3>Compare a 90-day sample</h3></div><span className="monitor-history-tag">Training archive</span></div>
        <p className="monitor-help">Use the same resource, Average statistic, and 15-day sample buckets. One expected sample is absent.</p>
        <label className="monitor-compact-select">Resource<select value={resource} onChange={(event) => setResource(event.target.value)}><option>WEB-1</option><option>WEB-2</option><option>WEB-3</option></select></label>
        <button className="monitor-primary" disabled={busy} onClick={() => invoke('dashboard baseline resource=' + resource + ' window=90d statistic=Average period=15d')}>Calculate 90-day baseline</button>
        {baseline && <div className="monitor-baseline-result"><div><span>{baseline.resource} · {baseline.statistic}</span><b>{baseline.mean.toFixed(2)}%</b></div><div className="monitor-sample-bars">{baseline.values.map((value, i) => <span key={i} title={value == null ? 'Missing sample' : 'Sample ' + value + '%'} className={value == null ? 'missing' : ''} style={{ '--sample-height': value == null ? '12%' : (value / 60 * 100) + '%' }}>{value == null ? '—' : value}</span>)}</div><small>{baseline.sampleCount}/{baseline.expectedSamples} samples · {baseline.missingSamples} missing · {baseline.period} resolution</small></div>}
        <div className="monitor-buffer-fields"><label>Buffer in percentage points<input value={points} inputMode="decimal" onChange={(event) => setPoints(event.target.value)}/></label><label>Buffer as relative percent<input value={relative} inputMode="decimal" onChange={(event) => setRelative(event.target.value)}/></label></div>
        <button className="monitor-secondary" disabled={busy || !baseline} onClick={() => invoke('dashboard buffer percentage-points=' + points + ' relative-percent=' + relative)}>Compare both buffer calculations</button>
        {monitoring.buffer && <div className="monitor-buffer-readout"><span>+{monitoring.buffer.percentagePoints} percentage points <b>{monitoring.buffer.threshold.toFixed(2)}%</b></span><span>+{monitoring.buffer.relativePercent}% relative <b>{monitoring.buffer.relativeThreshold.toFixed(2)}%</b></span></div>}
        <label className="monitor-note-field">Baseline notes<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the missing sample and 15-day resolution. Distinguish percentage points from a relative percent." rows={3}/></label>
        <button className="monitor-submit" disabled={busy || !note.trim()} onClick={submitNote}>Submit baseline notes</button>
      </section>}

      {requestError && <div className="monitor-error" role="alert">{requestError}</div>}
      <section className="monitor-activity" aria-label="Dashboard activity">
        <div><small>RECENT DASHBOARD ACTIVITY</small><span>Actions are simulated and saved with this attempt.</span></div>
        {lastCommands.length ? lastCommands.map((item) => <pre key={item.id || item.command}>{item.stderr || item.stdout || item.command}</pre>) : <p>Choose a dashboard action to inspect the supplied training data.</p>}
      </section>
    </div>
  </section>;
}
