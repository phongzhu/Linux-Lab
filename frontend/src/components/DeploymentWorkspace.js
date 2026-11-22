import { useState } from 'react';
import './DeploymentWorkspace.css';

export default function DeploymentWorkspace({ lesson, attempt, busy, requestError, onAction }) {
  const deployment = attempt.state.deployment || {};
  const index = lesson.lessonNumber || lesson.lessonIndex + 1;
  const [note, setNote] = useState('');
  const history = (attempt.commands || []).slice(-5).reverse();
  const submit = (prefix) => onAction(`${prefix} note=${encodeURIComponent(note)}`);
  return <section className="deployment-workspace" aria-label="Deployment verification workspace">
    <header><div><span>SIMULATED RELEASE OPERATIONS</span><b>{['Image and configuration layers','Capacity and request evidence','Rollout verification'][index - 1]}</b></div><small>Fictional environment</small></header>
    <div className="deployment-body">
      {index === 1 && <>
        <div className="deploy-toolbar"><div><small>VERSIONED RESOURCE LAYERS</small><b>AMI → launch template · image → task definition → running tasks</b></div><button disabled={busy} onClick={() => onAction('release inspect-layers')}>Inspect layers</button></div>
        {deployment.layersInspected && <div className="deploy-grid"><article><small>AMI</small><b>{deployment.ami.id}</b><span>Bootstrap {deployment.ami.configRevision}</span></article><article><small>Container registry</small><b>{deployment.registry.image}</b><span>{deployment.registry.digest}</span></article><article><small>Launch template</small><b>{deployment.launchTemplate.id}</b><span>{deployment.launchTemplate.amiId} · {deployment.launchTemplate.configRevision}</span></article><article><small>Task definition</small><b>Revision {deployment.taskDefinition.revision}</b><span>{deployment.taskDefinition.image} · {deployment.taskDefinition.configRevision}</span></article>{deployment.runningTasks.map((task) => <article key={task.id}><small>RUNNING · {task.id}</small><b>{task.image}</b><span>{task.configRevision}</span></article>)}</div>}
        <div className="deploy-actions"><button disabled={busy || !deployment.layersInspected} onClick={() => onAction('release publish image=linuxlab/api:1.9')}>Publish proposed image</button><button disabled={busy || !deployment.published} onClick={() => onAction('release update-task-definition')}>Update task definition</button></div>
        <label>Explain which layers change<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Separate AMI, launch-template, registry, task-definition, and running-task effects. Explain new launches versus existing tasks."/></label>
        <button className="deploy-primary" disabled={busy || !note.trim()} onClick={() => submit('release explain-layers')}>Submit layer analysis</button>
      </>}
      {index === 2 && <>
        <div className="deploy-toolbar"><div><small>CAPACITY AND RATE LIMITS</small><b>Prepared fictional request batch</b></div><button disabled={busy} onClick={() => onAction('scale inspect')}>Inspect ECS setup</button></div>
        {deployment.scaling.inspected && <div className="deploy-stats"><article><small>ECS desired / running</small><b>{deployment.scaling.desired} / {deployment.scaling.running}</b></article><article><small>Partner ceiling</small><b>{deployment.scaling.partnerRateCeiling} requests/min</b></article><article><small>Task family</small><b>{deployment.scaling.taskFamily}</b></article></div>}
        <p className="deploy-naming">Request IDs use: {deployment.scaling.namingConvention}</p>
        <button disabled={busy || !deployment.scaling.inspected} onClick={() => onAction('scale compare')}>Compare sent, arrived, and successful requests</button>
        {deployment.scaling.comparison && <div className="deploy-comparison"><div><small>Sent</small><b>{deployment.scaling.comparison.sent.length}</b></div><div><small>Gateway</small><b>{deployment.scaling.comparison.arrived.length}</b></div><div><small>HTTP 200</small><b>{deployment.scaling.comparison.succeeded.length}</b></div><div><small>Missing at gateway</small><b>{deployment.scaling.comparison.missingAtGateway.join(', ')}</b></div><div><small>No response</small><b>{deployment.scaling.comparison.missingResponse.join(', ') || 'none'}</b></div></div>}
        <label>Explain capacity, partner limits, and control planes<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Distinguish ECS task capacity from the partner rate ceiling and end-to-end success. Compare Pods, nodes, and replicas without equating Kubernetes and ECS."/></label>
        <button className="deploy-primary" disabled={busy || !note.trim()} onClick={() => submit('scale explain')}>Submit capacity assessment</button>
      </>}
      {index === 3 && <>
        <div className="deploy-toolbar"><div><small>ROLLOUT EVIDENCE</small><b>Registry vs deployed vs running versions</b></div><button disabled={busy} onClick={() => onAction('rollout inspect')}>Inspect rollout</button></div>
        {deployment.rollout.inspected && <><div className="deploy-versions"><article><small>Registry</small><b>{deployment.rollout.registryImage}</b></article><article><small>Task definition r{deployment.rollout.taskDefinitionRevision}</small><b>{deployment.rollout.taskDefinitionImage}</b></article>{deployment.rollout.runningVersions.map((task) => <article key={task.id}><small>{task.id} · {task.health}</small><b>{task.image}</b></article>)}</div><div className="deploy-checks"><b>Health, logs, and metrics</b>{deployment.rollout.healthResponses.map((item) => <span key={item.time}>{item.time} · {item.path} · HTTP {item.status}</span>)}<span>{deployment.rollout.log}</span><span>{deployment.rollout.metric}</span><small>Script trigger: {deployment.rollout.script.trigger}</small></div></>}
        <button disabled={busy || !deployment.rollout.inspected} onClick={() => onAction('rollout verify')}>Verify current adoption</button>
        {deployment.rollout.verification && <div className="deploy-warning">{deployment.rollout.verification.staleTasks.length ? `Still stale: ${deployment.rollout.verification.staleTasks.join(', ')}` : 'All tasks match target.'} · {deployment.rollout.verification.unhealthy} unhealthy health responses</div>}
        <label>Handover verified status and remaining work<textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Report running versions, health, log and metric evidence, stale tasks, and the explicitly supplied EventBridge script trigger."/></label>
        <button className="deploy-primary" disabled={busy || !note.trim()} onClick={() => submit('rollout handover')}>Submit rollout handover</button>
      </>}
      {requestError && <div role="alert" className="deploy-error">{requestError}</div>}
      <section className="deploy-history"><small>RECENT SIMULATED ACTIONS</small>{history.length ? history.map((item) => <pre key={item.id || item.command}>{item.stderr || item.stdout || item.command}</pre>) : <p>Inspect the release records to begin.</p>}</section>
    </div>
  </section>;
}
