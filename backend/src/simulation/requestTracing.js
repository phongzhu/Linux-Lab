const success = (stdout) => ({ stdout, stderr: '', exitCode: 0 });
const fail = (stderr, exitCode = 2) => ({ stdout: '', stderr, exitCode });

export function executeRequestLabCommand(env, command) {
  const lab = env.requestLab;
  if (!lab) return fail('training: this attempt has no request-tracing workspace', 1);

  if (command === 'trace inspect REQ-7F21') {
    lab.traceInspected = true;
    return success(lab.trace.events.map((event) => `${event.time} | ${event.service} | ${event.kind} | ${event.detail}`).join('\n') + `\nMissing stage: ${lab.trace.missingStage}`);
  }
  const traceNote = command.match(/^trace explain note=(.*)$/);
  if (traceNote) {
    try { lab.traceNote = decodeURIComponent(traceNote[1]); } catch { return fail('trace: note must be URI encoded'); }
    return lab.traceNote.trim() ? success('Request path explanation saved.') : fail('trace: add an evidence-based explanation');
  }

  if (command === 'routing inspect') {
    lab.routingInspected = true;
    return success(lab.routing.behaviors.map((behavior, index) => `${index + 1}. ${behavior.pattern} -> ${behavior.origin}; headers=${behavior.forwardHeaders.join('|') || 'none'}; query=${behavior.forwardQuery}; cache=${behavior.cachePolicy}`).join('\n') + `\nDownstream load balancer: ${lab.routing.loadBalancer}`);
  }
  if (command === 'routing fix-order') {
    if (!lab.routingInspected) return fail('routing: inspect the current behavior order first', 1);
    lab.routing.behaviors = [...lab.routing.behaviors].sort((a, b) => b.pattern.length - a.pattern.length);
    lab.routing.fixedOrder = true;
    return success('Specific invoice behaviors now precede /invoice/*. Body fields still require application logic; the load balancer remains a separate routing layer.');
  }
  const routeTest = command.match(/^routing test path=(\/invoice\/(?:1|21)\/[^ ]+)$/);
  if (routeTest) {
    const selected = lab.routing.behaviors.find((behavior) => {
      const prefix = behavior.pattern.replace('*', '');
      return routeTest[1].startsWith(prefix);
    });
    lab.routing.tests = { ...(lab.routing.tests || {}), [routeTest[1]]: selected?.pattern || null };
    return selected ? success(`${routeTest[1]} selects ${selected.pattern} -> ${selected.origin}; query forwarded=${selected.forwardQuery}; cache=${selected.cachePolicy}`) : fail('routing: no behavior matched this path', 1);
  }
  const routeNote = command.match(/^routing explain note=(.*)$/);
  if (routeNote) {
    try { lab.routingNote = decodeURIComponent(routeNote[1]); } catch { return fail('routing: note must be URI encoded'); }
    return lab.routingNote.trim() ? success('Routing diagnosis saved.') : fail('routing: add a routing diagnosis');
  }

  if (command === 'proxy inspect') {
    lab.proxyInspected = true;
    const p = lab.proxy;
    return success(`Client URL: ${p.clientUrl}\nURL hostname=${new URL(p.clientUrl).hostname}; path=${new URL(p.clientUrl).pathname}\nDNS: ${p.dns.hostname} -> ${p.dns.address}\nTLS terminator: ${p.tls.terminator}; certificate names=${p.tls.names.join(', ')}; valid=${p.tls.valid}${p.tls.valid ? '' : ' (hostname mismatch)'}\nProxy mapping: ${p.mapping.host}:${p.mapping.port} -> ${p.mapping.backend}\nBackend=${p.backend.name}; response=${p.backend.status}; QR=${p.backend.qrResponse}; payment completion=${p.backend.cashInCompletion}`);
  }
  if (command === 'proxy repair training-route') {
    if (!lab.proxyInspected) return fail('proxy: inspect URL, DNS, TLS and mapping first', 1);
    lab.proxy.clientUrl = 'https://api.training.test/v1/qr';
    lab.proxy.dns = { hostname: 'api.training.test', address: '192.0.2.50' };
    lab.proxy.tls.valid = true;
    lab.proxy.mapping = { host: 'api.training.test', port: 8080, backend: 'api-core.training.internal' };
    lab.proxy.routeRepaired = true;
    return success('Training client URL, TLS hostname, and proxy mapping now agree. This changes the fictional fixture only.');
  }
  if (command === 'proxy restart api-core') {
    if (!lab.proxy.routeRepaired) return fail('proxy: repair the training route before restarting the backend', 1);
    lab.proxy.restartCount += 1;
    lab.proxy.restartTimeline = [
      { time: '2026-11-22T10:04:00Z', status: 503, phase: 'controlled restart begins' },
      { time: '2026-11-22T10:04:12Z', status: 200, phase: 'API Core healthy' },
    ];
    return success(lab.proxy.restartTimeline.map((event) => `${event.time} | HTTP ${event.status} | ${event.phase}`).join('\n'));
  }
  if (command === 'proxy test training-route') {
    const url = new URL(lab.proxy.clientUrl);
    const hostMatches = url.hostname === lab.proxy.dns.hostname && url.hostname === lab.proxy.mapping.host && lab.proxy.tls.names.includes(url.hostname) && lab.proxy.tls.valid;
    const response = hostMatches && lab.proxy.restartTimeline?.some((item) => item.status === 200) ? 200 : hostMatches ? 503 : 502;
    lab.proxy.lastTest = { hostname: url.hostname, path: url.pathname, response, qrResponse: response === 200 ? lab.proxy.backend.qrResponse : null };
    return success(`hostname=${url.hostname} path=${url.pathname} TLS=${hostMatches ? 'valid' : 'hostname mismatch'} proxy=${lab.proxy.mapping.host}:${lab.proxy.mapping.port} backend=${lab.proxy.mapping.backend} response=${response}${response === 200 ? ` QR=${lab.proxy.backend.qrResponse}; cash-in completion=${lab.proxy.backend.cashInCompletion}` : ''}`);
  }
  const proxyNote = command.match(/^proxy explain note=(.*)$/);
  if (proxyNote) {
    try { lab.proxyNote = decodeURIComponent(proxyNote[1]); } catch { return fail('proxy: note must be URI encoded'); }
    return lab.proxyNote.trim() ? success('Proxy investigation saved.') : fail('proxy: add an evidence-based explanation');
  }
  return fail('training: unsupported request lab action');
}

export function validateRequestLabTask(lessonIndex, taskIndex, env, result) {
  const lab = env.requestLab;
  if (!lab || result?.exitCode !== 0) return false;
  if (lessonIndex === 0) {
    if (taskIndex === 0) return lab.traceInspected && lab.trace.events.length === 3 && lab.trace.events.every((event) => event.correlationId === 'REQ-7F21');
    if (taskIndex === 1) return lab.traceInspected && lab.trace.events.some((event) => event.service === 'QR Service' && event.kind === 'response') && !lab.trace.events.some((event) => event.kind === 'cash-in completion');
    const note = (lab.traceNote || '').toLowerCase();
    return /kiosk/.test(note) && /api core/.test(note) && /qr/.test(note) && /missing|not observed|unverified/.test(note)
      && /afod/.test(note) && /gw2/.test(note) && /ecpay/.test(note) && /not.*same server|not confirmed.*server|confirm.*server/.test(note);
  }
  if (lessonIndex === 1) {
    if (taskIndex === 0) return lab.routingInspected && lab.routing.behaviors.some((b) => b.pattern === '/invoice/1/*') && lab.routing.behaviors.some((b) => b.pattern === '/invoice/21/*') && lab.routing.behaviors.some((b) => b.pattern === '/invoice/*');
    if (taskIndex === 1) return lab.routing.fixedOrder && lab.routing.tests?.['/invoice/1/INV-10'] === '/invoice/1/*' && lab.routing.tests?.['/invoice/21/INV-21'] === '/invoice/21/*';
    const note = (lab.routingNote || '').toLowerCase();
    return /invoice\/21/.test(note) && /order|before|specific/.test(note) && /load balancer/.test(note) && /body/.test(note) && /header/.test(note) && /query/.test(note);
  }
  if (lessonIndex === 2) {
    if (taskIndex === 0) return lab.proxyInspected && new URL(lab.proxy.clientUrl).hostname === lab.proxy.dns.hostname && new URL(lab.proxy.clientUrl).pathname === '/v1/qr';
    if (taskIndex === 1) return lab.proxy.routeRepaired && lab.proxy.tls.valid && lab.proxy.mapping.host === new URL(lab.proxy.clientUrl).hostname
      && lab.proxy.dns.hostname === lab.proxy.mapping.host && lab.proxy.mapping.backend === 'api-core.training.internal'
      && lab.proxy.restartTimeline?.some((event) => event.status === 503) && lab.proxy.restartTimeline?.some((event) => event.status === 200)
      && lab.proxy.lastTest?.response === 200 && lab.proxy.lastTest.qrResponse === 'QR-TRAINING-7F21';
    const note = (lab.proxyNote || '').toLowerCase();
    return lab.proxy.lastTest?.response === 200 && lab.proxy.lastTest.qrResponse && lab.proxy.restartTimeline?.some((item) => item.status === 503)
      && /hostname/.test(note) && /path/.test(note) && /tls/.test(note) && /worker/.test(note) && /cache/.test(note)
      && /qr/.test(note) && /cash.in|cash in/.test(note) && /not.*completion|does not prove.*completion|not proof.*completion/.test(note);
  }
  return false;
}
