import { useState } from 'react';
import './RequestWorkspace.css';

export default function RequestWorkspace({ lesson, attempt, busy, requestError, onAction }) {
  const lab = attempt.state.requestLab || {};
  const index = lesson.lessonNumber || lesson.lessonIndex + 1;
  const [note, setNote] = useState('');
  const activity = (attempt.commands || []).slice(-5).reverse();
  const submit = (prefix) => onAction(`${prefix} note=${encodeURIComponent(note)}`);

  return <section className="request-workspace" aria-label="Request tracing workspace">
    <header><div><span>SIMULATED SRE CONSOLE</span><b>{index === 1 ? 'Request trace' : index === 2 ? 'Routing behaviors' : 'Proxy and API route'}</b></div><small>Fictional training evidence</small></header>
    <div className="request-workspace-body">
      {index === 1 && <>
        <section className="request-panel"><div className="request-panel-heading"><div><small>TRACE SEARCH</small><h3>Correlation ID · REQ-7F21</h3></div><button disabled={busy} onClick={() => onAction('trace inspect REQ-7F21')}>Inspect trace</button></div>
          <p>Follow one request across the kiosk, API Core, and QR service. References that look alike do not prove they share a server.</p>
          {lab.traceInspected && <ol className="request-timeline">{lab.trace.events.map((event) => <li key={event.time}><time>{event.time.slice(11, 19)} UTC</time><b>{event.service}</b><span>{event.kind} · {event.detail}</span></li>)}<li className="request-gap"><time>—</time><b>Evidence gap</b><span>{lab.trace.missingStage}</span></li></ol>}
        </section>
        <label>Evidence-based trace interpretation<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe proven stages and the missing completion evidence. Mention AFOD, GW2, and ECPay as names requiring confirmation."/></label>
        <button className="request-primary" disabled={busy || !note.trim()} onClick={() => submit('trace explain')}>Submit trace interpretation</button>
      </>}

      {index === 2 && <>
        <section className="request-panel"><div className="request-panel-heading"><div><small>CLOUDFRONT BEHAVIOR ORDER</small><h3>Specific client paths and general fallback</h3></div><button disabled={busy} onClick={() => onAction('routing inspect')}>Inspect behaviors</button></div>
          {lab.routingInspected && <div className="request-behaviors">{lab.routing.behaviors.map((behavior, i) => <div key={behavior.pattern} className={lab.routing.fixedOrder ? 'behavior-fixed' : i === 0 ? 'behavior-warning' : ''}><b>{String(i + 1).padStart(2, '0')}</b><code>{behavior.pattern}</code><span>→ {behavior.origin}</span><small>Headers: {behavior.forwardHeaders.join(', ')} · query {behavior.forwardQuery ? 'on' : 'off'} · {behavior.cachePolicy}</small></div>)}</div>}
        </section>
        <div className="request-actions"><button disabled={busy || !lab.routingInspected} onClick={() => onAction('routing fix-order')}>Move specific paths first</button><button disabled={busy || !lab.routingInspected} onClick={() => onAction('routing test path=/invoice/1/INV-10')}>Test client 1 path</button><button disabled={busy || !lab.routingInspected} onClick={() => onAction('routing test path=/invoice/21/INV-21')}>Test client 21 path</button></div>
        <label>Explain the route and evidence<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain behavior ordering, the separate load balancer, forwarded headers and query, caching, and why body fields are not path patterns."/></label>
        <button className="request-primary" disabled={busy || !note.trim()} onClick={() => submit('routing explain')}>Submit routing diagnosis</button>
      </>}

      {index === 3 && <>
        <section className="request-panel"><div className="request-panel-heading"><div><small>CLIENT · DNS · TLS · PROXY · API</small><h3>Training route investigation</h3></div><button disabled={busy} onClick={() => onAction('proxy inspect')}>Inspect route</button></div>
          {lab.proxyInspected && <dl className="request-endpoint-grid"><dt>Client URL</dt><dd>{lab.proxy.clientUrl}</dd><dt>DNS</dt><dd>{lab.proxy.dns.hostname} → {lab.proxy.dns.address}</dd><dt>TLS</dt><dd>{lab.proxy.tls.terminator} · {lab.proxy.tls.names.join(', ')} · {lab.proxy.tls.valid ? 'valid' : 'hostname mismatch'}</dd><dt>Proxy</dt><dd>{lab.proxy.mapping.host}:{lab.proxy.mapping.port} → {lab.proxy.mapping.backend}</dd><dt>Components</dt><dd>Web UI → API Core → cache → worker roles are separately documented; no direct completion link is assumed.</dd></dl>}
        </section>
        <div className="request-actions"><button disabled={busy || !lab.proxyInspected} onClick={() => onAction('proxy repair training-route')}>Apply supplied training route</button><button disabled={busy || !lab.proxy.routeRepaired} onClick={() => onAction('proxy restart api-core')}>Run controlled restart</button><button disabled={busy || !lab.proxy.routeRepaired} onClick={() => onAction('proxy test training-route')}>Test client route</button></div>
        {lab.proxy.restartTimeline?.length > 0 && <ol className="request-timeline request-restart">{lab.proxy.restartTimeline.map((item) => <li key={item.time}><time>{item.time}</time><b>HTTP {item.status}</b><span>{item.phase}</span></li>)}</ol>}
        {lab.lastTest && <div className="request-result">HTTP {lab.lastTest.response} · hostname {lab.lastTest.hostname} · path {lab.lastTest.path} · QR {lab.lastTest.qrResponse || 'no response'}</div>}
        <label>Explain the verified route<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Separate URL hostname from path; explain TLS termination, proxy mapping, web/API/cache/worker roles, restart response, and why QR output does not prove cash-in completion."/></label>
        <button className="request-primary" disabled={busy || !note.trim()} onClick={() => submit('proxy explain')}>Submit investigation</button>
      </>}
      {requestError && <div role="alert" className="request-error">{requestError}</div>}
      <section className="request-activity"><small>RECENT SIMULATED ACTIONS</small>{activity.length ? activity.map((item) => <pre key={item.id || item.command}>{item.stderr || item.stdout || item.command}</pre>) : <p>Inspect the fictional request evidence to begin.</p>}</section>
    </div>
  </section>;
}
