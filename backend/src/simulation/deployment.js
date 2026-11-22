const ok = (stdout) => ({ stdout, stderr: '', exitCode: 0 });
const fail = (stderr, exitCode = 2) => ({ stdout: '', stderr, exitCode });
function note(command, prefix) {
  const match = command.match(new RegExp('^' + prefix + ' note=(.*)$'));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function executeDeploymentCommand(env, command) {
  const d = env.deployment;
  if (!d) return fail('release: this attempt has no deployment workspace', 1);
  if (command === 'release inspect-layers') {
    d.layersInspected = true;
    return ok([
      `AMI=${d.ami.id} config=${d.ami.configRevision}`,
      `Container registry=${d.registry.image} digest=${d.registry.digest}`,
      `Launch template=${d.launchTemplate.id} AMI=${d.launchTemplate.amiId} userData=${d.launchTemplate.configRevision}`,
      `Task definition=${d.taskDefinition.image} revision=${d.taskDefinition.revision} config=${d.taskDefinition.configRevision}`,
      ...d.runningTasks.map((task) => `Running ${task.id}: ${task.image} config=${task.configRevision} status=${task.status}`),
      'A registry update does not replace already running tasks.',
    ].join('\n'));
  }
  const publish = command.match(/^release publish image=(linuxlab\/api:[0-9.]+)$/);
  if (publish) {
    d.registry.image = publish[1]; d.registry.digest = 'sha256:train-19'; d.published = true;
    return ok(`Published ${d.registry.image} (${d.registry.digest}). Running tasks are unchanged.`);
  }
  if (command === 'release update-task-definition') {
    if (!d.published) return fail('release: publish the reviewed image before updating the task definition', 1);
    d.taskDefinition.image = d.registry.image; d.taskDefinition.revision += 1;
    return ok(`Task definition revision ${d.taskDefinition.revision} now references ${d.taskDefinition.image}. Existing tasks remain on their current image until replaced.`);
  }
  const layerNote = note(command, 'release explain-layers');
  if (layerNote !== null) { d.layerNote = layerNote; return layerNote.trim() ? ok('Layer impact explanation saved.') : fail('release: add a change impact explanation'); }

  if (command === 'scale inspect') {
    d.scaling.inspected = true;
    return ok(`ECS cluster=${d.scaling.cluster} desired=${d.scaling.desired} running=${d.scaling.running} task family=${d.scaling.taskFamily}\nPartner rate ceiling=${d.scaling.partnerRateCeiling} requests/minute (fictional exercise limit)\nNaming convention: ${d.scaling.namingConvention}\nKubernetes comparison: Pods are scheduled onto nodes; replicas describe desired workload count. This fixture's ECS tasks are not Kubernetes objects.`);
  }
  if (command === 'scale compare') {
    const sets = d.scaling.requests;
    const gateway = new Set(sets.gateway);
    const responses = new Map(sets.responses.map((item) => [item.id, item.status]));
    const arrived = sets.sent.filter((id) => gateway.has(id));
    const succeeded = arrived.filter((id) => responses.get(id) === 200);
    const failed = arrived.filter((id) => responses.has(id) && responses.get(id) !== 200);
    d.scaling.comparison = { sent: [...sets.sent], arrived, succeeded, failed, missingAtGateway: sets.sent.filter((id) => !gateway.has(id)), missingResponse: arrived.filter((id) => !responses.has(id)) };
    return ok(`Sent ${sets.sent.length}: ${sets.sent.join(', ')}\nGateway arrived ${arrived.length}: ${arrived.join(', ')}\nSuccessful ${succeeded.length}: ${succeeded.join(', ')}\nFailed response ${failed.length}: ${failed.join(', ')}\nMissing at gateway: ${d.scaling.comparison.missingAtGateway.join(', ') || 'none'}\nArrived without response: ${d.scaling.comparison.missingResponse.join(', ') || 'none'}`);
  }
  const scaleNote = note(command, 'scale explain');
  if (scaleNote !== null) { d.scaling.note = scaleNote; return scaleNote.trim() ? ok('Capacity and request evidence assessment saved.') : fail('scale: add a data-based explanation'); }

  if (command === 'rollout inspect') {
    d.rollout.inspected = true;
    return ok(`Registry image=${d.rollout.registryImage}\nTask definition=${d.rollout.taskDefinitionImage} revision=${d.rollout.taskDefinitionRevision}\n${d.rollout.runningVersions.map((task) => `${task.id} running=${task.image} health=${task.health}`).join('\n')}\nHealth responses: ${d.rollout.healthResponses.map((item) => `${item.time} ${item.path} HTTP ${item.status}`).join('; ')}\nRecent log: ${d.rollout.log}\nMetric: ${d.rollout.metric}\nScript workload=${d.rollout.script.path}; trigger=${d.rollout.script.trigger}; last event=${d.rollout.script.lastEvent}`);
  }
  if (command === 'rollout verify') {
    if (!d.rollout.inspected) return fail('rollout: inspect registry, definition, running versions, and script trigger first', 1);
    const target = d.rollout.taskDefinitionImage;
    const staleTasks = d.rollout.runningVersions.filter((task) => task.image !== target).map((task) => task.id);
    const unhealthy = d.rollout.healthResponses.filter((item) => item.status !== 200).length;
    d.rollout.verification = { target, staleTasks, unhealthy, log: d.rollout.log, metric: d.rollout.metric, trigger: d.rollout.script.trigger };
    return ok(`Target=${target}; stale running tasks=${staleTasks.join(', ') || 'none'}; non-200 health responses=${unhealthy}; evidence=${d.rollout.log}; ${d.rollout.metric}; script trigger=${d.rollout.script.trigger}`);
  }
  const rolloutNote = note(command, 'rollout handover');
  if (rolloutNote !== null) { d.rollout.handover = rolloutNote; return rolloutNote.trim() ? ok('Rollout handover saved.') : fail('rollout: report verified status and remaining work'); }
  return fail('release: unsupported action. Use release inspect-layers, publish, update-task-definition, scale inspect/compare, or rollout inspect/verify/handover.');
}

export function validateDeploymentTask(lessonIndex, taskIndex, env, result) {
  const d = env.deployment;
  if (!d || result?.exitCode !== 0) return false;
  if (lessonIndex === 0) {
    if (taskIndex === 0) return d.layersInspected && d.ami.id && d.registry.image && d.launchTemplate.amiId && d.taskDefinition.image && d.runningTasks.length > 0;
    if (taskIndex === 1) return d.published && d.registry.image === 'linuxlab/api:1.9' && d.taskDefinition.image === 'linuxlab/api:1.9' && d.runningTasks.some((task) => task.image !== d.registry.image);
    const n = (d.layerNote || '').toLowerCase();
    return d.published && /ami/.test(n) && /launch template/.test(n) && /task definition/.test(n) && /new launch/.test(n) && /existing/.test(n) && /unchanged|remain|not updated/.test(n);
  }
  if (lessonIndex === 1) {
    if (taskIndex === 0) return d.scaling.inspected && d.scaling.desired === 4 && d.scaling.running === 3 && d.scaling.partnerRateCeiling === 120;
    if (taskIndex === 1) return d.scaling.comparison?.sent.length === d.scaling.requests.sent.length && d.scaling.comparison.arrived.length === d.scaling.requests.gateway.length && d.scaling.comparison.succeeded.length === 3;
    const n = (d.scaling.note || '').toLowerCase();
    return !!d.scaling.comparison && /task capacity/.test(n) && /partner/.test(n) && /kubernetes/.test(n) && /pod/.test(n) && /node/.test(n) && /replica/.test(n) && /not.*same|separate/.test(n);
  }
  if (lessonIndex === 2) {
    if (taskIndex === 0) return d.rollout.inspected && d.rollout.registryImage === d.rollout.taskDefinitionImage && d.rollout.runningVersions.some((task) => task.image !== d.rollout.registryImage);
    if (taskIndex === 1) return !!d.rollout.verification && d.rollout.verification.staleTasks.includes('task-17') && d.rollout.verification.unhealthy > 0 && /eventbridge/i.test(d.rollout.verification.trigger);
    const n = (d.rollout.handover || '').toLowerCase();
    return !!d.rollout.verification && /verified/.test(n) && /task-17/.test(n) && /health/.test(n) && /log/.test(n) && /metric/.test(n) && /eventbridge/.test(n) && /trigger/.test(n) && /remaining|stale|follow.up/.test(n);
  }
  return false;
}
