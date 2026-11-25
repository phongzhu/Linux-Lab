import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { createPublicClient } from '../config/database.js';

const TABLE = 'linuxlab_sre_kiosk_attempts';
const FLEET = [
  { id: 'KIOSK-LAB-017', ip: '10.40.6.17', network: 'Operations-East', backend: 'WEB-2', host: 'kiosk-017' },
  { id: 'KIOSK-LAB-018', ip: '10.40.6.18', network: 'Operations-East', backend: 'WEB-2', host: 'kiosk-018' },
  { id: 'KIOSK-LAB-031', ip: '10.50.6.31', network: 'Operations-West', backend: 'WEB-1', host: 'kiosk-031' },
  { id: 'KIOSK-LAB-042', ip: '10.60.6.42', network: 'Admin-Lab', backend: 'WEB-3', host: 'kiosk-042' },
];
const RESOURCES = [
  { id: 'i-0web001', name: 'WEB-1', ip: '10.50.20.11', network: 'Operations-West', region: 'us-west-2', kiosks: ['KIOSK-LAB-031'] },
  { id: 'i-0web002', name: 'WEB-2', ip: '10.40.20.12', network: 'Operations-East', region: 'us-east-1', kiosks: ['KIOSK-LAB-017', 'KIOSK-LAB-018'] },
  { id: 'i-0web003', name: 'WEB-3', ip: '10.60.20.13', network: 'Admin-Lab', region: 'us-east-1', kiosks: ['KIOSK-LAB-042'] },
];
const PROFILES = [
  { name: 'Operations-East', route: '10.40.0.0/16', address: '10.40.0.24' },
  { name: 'Operations-West', route: '10.50.0.0/16', address: '10.50.0.24' },
  { name: 'Admin-Lab', route: '10.60.0.0/16', address: '10.60.0.24' },
];
const history = [
  ['08:45', 18, 12, 10], ['08:50', 20, 13, 11], ['08:55', 22, 14, 12],
  ['09:00', 65, 70, 66], ['09:05', 94, 180, 160], ['09:10', 97, 220, 190], ['09:15', 95, 210, 180],
];
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const stamp = (time) => new Date(`${day}T${time}:00+08:00`).toISOString();
const sample = (time, cpu, netInMiB, netOutMiB, extra = {}) => ({
  start: stamp(time), end: new Date(new Date(stamp(time)).getTime() + 300000).toISOString(),
  cpu, networkInBytes: Math.round(netInMiB * 1048576), networkOutBytes: Math.round(netOutMiB * 1048576),
  memory: cpu > 50 ? 82 : 48, disk: 51, requests: cpu > 50 ? Math.round(cpu * 74) : 420,
  errors: cpu > 50 ? 4.2 : 0.2, latencyMs: cpu > 50 ? Math.round(cpu * 31) : 115, ...extra,
});
const line = (id, time, resource, kiosk, severity, service, message, extra = {}) => ({ id, at: stamp(time), resource, kiosk, severity, service, message, ...extra });

function makeInitial(scenario = 'cpu-network') {
  const samples = Object.fromEntries(RESOURCES.map((resource) => [resource.name, []]));
  history.forEach(([time, cpu, incoming, outgoing]) => {
    samples['WEB-2'].push(sample(time, cpu, incoming, outgoing));
    samples['WEB-1'].push(sample(time, 19, 16, 12, { memory: 46, requests: 390, errors: 0, latencyMs: 108 }));
    samples['WEB-3'].push(sample(time, 23, 18, 14, { memory: 52, requests: 460, errors: 0.1, latencyMs: 121 }));
  });
  if (scenario === 'vpn-access') for (const resource of RESOURCES) samples[resource.name] = history.map(([time]) => sample(time, resource.name === 'WEB-1' ? 19 : resource.name === 'WEB-2' ? 21 : 23, 16, 12, { errors: 0, latencyMs: 112 }));
  if (scenario === 'storage') for (const resource of RESOURCES) samples[resource.name] = history.map(([time]) => sample(time, 20, 15, 12, { disk: resource.name === 'WEB-2' ? 51 : 42, errors: 0, latencyMs: 112 }));
  let logs = [
    line('EV-001', '08:56', 'i-0web002', 'KIOSK-LAB-017', 'INFO', 'checkout-api', 'Retry worker started; retry_delay_ms=0, max_attempts=unbounded', { requestId: 'req-7710', retryCount: 0, status: 200, durationMs: 118 }),
    line('EV-002', '09:00', 'i-0web002', 'KIOSK-LAB-017', 'WARN', 'checkout-api', 'Repeated retry burst began after upstream timeout; 42 requests in 10 seconds', { requestId: 'req-7711', retryCount: 8, status: 200, durationMs: 822 }),
    line('EV-003', '09:04', 'i-0web002', 'KIOSK-LAB-018', 'WARN', 'checkout-api', 'Shared WEB-2 response latency elevated for East kiosk', { requestId: 'req-8122', retryCount: 0, status: 503, durationMs: 2902 }),
    line('EV-004', '09:15', 'i-0web002', null, 'ALARM', 'cloudwatch-training', 'WEB-2 CPU average exceeded 85% for two complete 5-minute periods', { requestId: null }),
    line('EV-005', '09:16', 'i-0web001', 'KIOSK-LAB-031', 'INFO', 'checkout-api', 'Health check passed; West service remains within baseline', { requestId: 'req-8301', retryCount: 0, status: 200, durationMs: 106 }),
    line('EV-006', '09:17', 'i-0web002', 'KIOSK-LAB-017', 'ERROR', 'retry-worker', 'Retry queue depth rising; source kiosk KIOSK-LAB-017', { requestId: 'req-7712', retryCount: 16, status: 504, durationMs: 5030 }),
    line('EV-007', '09:18', 'i-0web003', 'KIOSK-LAB-042', 'INFO', 'checkout-api', 'Health check passed; Training service remains within baseline', { requestId: 'req-8411', retryCount: 0, status: 200, durationMs: 119 }),
  ];
  if (scenario === 'vpn-access') logs = [
    line('VPN-001', '09:14', 'i-0web002', 'KIOSK-LAB-017', 'INFO', 'health-agent', 'Kiosk heartbeat healthy; last check returned 200', { status: 200, durationMs: 110 }),
    line('VPN-002', '09:16', 'i-0web002', 'KIOSK-LAB-017', 'INFO', 'checkout-api', 'Cloud request rate and latency within baseline', { requestId: 'req-9011', status: 200, durationMs: 112 }),
    line('VPN-003', '09:18', 'operator-workstation', 'KIOSK-LAB-017', 'WARN', 'openvpn-client', 'Private request failed: route to 10.40.6.17 unavailable; current route 10.60.0.0/16', {}),
  ];
  if (scenario === 'storage') logs = [
    line('ST-001', '09:08', 'KIOSK-LAB-017', 'KIOSK-LAB-017', 'WARN', 'filesystem-agent', 'Root filesystem usage reached 99%; free space 420 MiB', {}),
    line('ST-002', '09:12', 'KIOSK-LAB-017', 'KIOSK-LAB-017', 'ERROR', 'clamav', 'Scan could not create temporary data: no space left on device', {}),
    line('ST-003', '09:13', 'KIOSK-LAB-017', 'KIOSK-LAB-017', 'INFO', 'archive-indexer', 'Closed archive /var/lib/closed-archive.tar is 4.2 GiB; record checksum available', {}),
  ];
  const now = stamp('09:20');
  return {
    id: null, scenario, startedAt: now, clock: now, paused: false, fleet: FLEET, resources: RESOURCES,
    vpn: { selectedProfile: scenario === 'vpn-access' ? 'Admin-Lab' : 'Operations-East', connected: true, connectedAt: scenario === 'vpn-access' ? stamp('09:20') : stamp('08:40'), events: [] },
    selectedResource: 'WEB-2', selectedKiosk: 'KIOSK-LAB-017',
    range: 'all', samples, logs, events: scenario === 'cpu-network' ? [{ at: stamp('09:15'), type: 'alarm', label: 'CPU alarm created', resource: 'WEB-2' }] : [], evidence: [],
    terminal: { host: 'operator-workstation', history: [], currentHost: 'operator-workstation', files: { '/etc/kiosk/retry.json': '{\n  "retry_delay_ms": 0,\n  "max_attempts": 0\n}', '/var/log/clamav/scan.log': 'ERROR: no space left on device while creating scan temporary file\n', '/var/lib/closed-archive.tar': 'LinuxLab training archive manifest\nrecords: 128\nchecksum: simulated-training-dataset\n' }, services: { retryWorker: 'running' } },
    configDraft: '{\n  "retry_delay_ms": 0,\n  "max_attempts": 0\n}', repaired: false, repairedAt: null, restartCount: 0, recoveryMinutes: 0, recoveredAt: null,
    workbook: { fields: { severity: '', observedSymptom: '', currentFindings: '', actionTaken: '', nextAction: '', reporter: '', rootCause: '', faultSource: '', resolution: '' }, updates: [], revisions: [] },
    acknowledged: false, completed: false, storage: { archivedRecordsPreserved: false, archiveMoved: false, scanPassed: false },
  };
}

function toManila(value) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date(value)); }
function expectedAlarm(samples) {
  const series = samples['WEB-2'] || [];
  let streak = 0;
  for (const item of series) { streak = item.cpu >= 85 ? streak + 1 : 0; if (streak === 2) return item.end; }
  return null;
}
function stateView(state) {
  const alarmAt = expectedAlarm(state.samples);
  const resources = state.resources.map((resource) => ({ ...resource, samples: state.samples[resource.name], health: state.scenario === 'cpu-network' && resource.name === 'WEB-2' && !state.recoveredAt ? 'Degraded' : 'Healthy', lastReceivedAt: state.samples[resource.name]?.at(-1)?.end || null }));
  const target = state.resources.find((r) => r.name === state.selectedResource) || state.resources[0];
  const route = PROFILES.find((p) => p.name === state.vpn.selectedProfile);
  const reachable = Boolean(state.vpn.connected && route && target.network === route.name);
  const fleet = state.fleet.map((kiosk) => ({ ...kiosk, metrics: { disk: state.scenario === 'storage' && kiosk.id === 'KIOSK-LAB-017' ? (state.storage.archiveMoved ? 88 : 99) : 53, freeMiB: state.scenario === 'storage' && kiosk.id === 'KIOSK-LAB-017' ? (state.storage.archiveMoved ? 4600 : 420) : 4200, heartbeat: true } }));
  return { ...state, fleet, resources, alarm: { state: alarmAt ? (state.recoveredAt ? 'RECOVERED' : 'ALARM') : 'OK', createdAt: alarmAt, threshold: 85, periods: 2 }, vpn: { ...state.vpn, profiles: PROFILES, reachable }, timezone: 'Asia/Manila (UTC+08:00)', clockLabel: toManila(state.clock) };
}

export async function loadAttempt(userId, accessToken) {
  const client = createPublicClient(accessToken);
  const { data, error } = await client.from(TABLE).select('id,scenario_id,state,updated_at').eq('app_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Kiosk workspace could not be loaded: ${error.message}`);
  if (data) return { ...data.state, id: data.id, scenario: data.scenario_id };
  const state = makeInitial();
  const saved = await saveAttempt(userId, accessToken, state);
  return saved;
}

async function saveAttempt(userId, accessToken, state) {
  const client = createPublicClient(accessToken);
  const { data, error } = await client.from(TABLE).upsert({ app_user_id: userId, id: state.id || undefined, scenario_id: state.scenario, state: { ...state, id: undefined } }, { onConflict: 'app_user_id,id' }).select('id').single();
  if (error) throw new Error(`Kiosk workspace could not be saved: ${error.message}`);
  return { ...state, id: data.id };
}

function scopedTerminal(state, command) {
  const text = String(command || '').trim();
  const host = state.terminal.currentHost;
  const prompt = `${host} $ ${text}`;
  let output = '';
  const words = text.split(/\s+/);
  const [cmd, ...args] = words;
  if (!text) return { prompt, output: '' };
  if (cmd === 'help') output = 'Supported: hostname, whoami, ip addr, ip route, ssh HOST, exit, ls, cat FILE, ps aux, top, free -h, df -h, du, grep, tail, sha256sum FILE, mv, systemctl status|restart retry-worker, journalctl, curl health, sudo nano /etc/kiosk/retry.json, clamdscan PATH, clear';
  else if (cmd === 'hostname') output = host;
  else if (cmd === 'whoami') output = host === 'operator-workstation' ? 'operator' : host;
  else if (cmd === 'ip' && args[0] === 'route') output = state.vpn.connected ? `${PROFILES.find((p) => p.name === state.vpn.selectedProfile)?.route} dev tun0` : 'default via 192.168.1.1 dev eth0';
  else if (cmd === 'ip' && args[0] === 'addr') output = host === 'operator-workstation' ? `tun0 ${PROFILES.find((p) => p.name === state.vpn.selectedProfile)?.address || 'disconnected'}` : `${host} ${FLEET.find((k) => k.host === host)?.ip || '10.40.20.12'}`;
  else if (cmd === 'ssh') {
    const target = args.at(-1)?.replace(/^.*@/, '');
    if (!target) { output = 'ssh: missing target host'; return { prompt, output }; }
    const kiosk = FLEET.find((item) => item.id.toLowerCase() === target.toLowerCase() || item.host.toLowerCase() === target.toLowerCase() || item.ip === target);
    const resource = RESOURCES.find((item) => item.name.toLowerCase() === target.toLowerCase() || item.id === target);
    const network = kiosk?.network || resource?.network;
    if (!network) output = `ssh: Could not resolve hostname ${target}: Name or service not known`;
    else if (!state.vpn.connected || state.vpn.selectedProfile !== network) output = `ssh: connect to host ${target} port 22: No route to host (connect ${network} VPN)`;
    else { state.terminal.currentHost = kiosk?.host || resource.name.toLowerCase(); output = `Connected to ${target} (fictional training host).`; }
  } else if (cmd === 'exit') { state.terminal.currentHost = 'operator-workstation'; output = 'Connection closed.'; }
  else if (cmd === 'ls') output = host === 'operator-workstation' ? 'fleet  reports' : '/etc/kiosk  /var/log  /var/lib';
  else if (cmd === 'cat') output = args[0] === '/etc/kiosk/retry.json' && host !== 'kiosk-017' ? 'cat: /etc/kiosk/retry.json: Permission denied (connect to KIOSK-LAB-017)' : (state.terminal.files[args[0]] ?? `cat: ${args[0] || 'missing operand'}: No such file`);
  else if (cmd === 'ps') output = host === 'kiosk-017' ? 'PID COMMAND\n210 retry-worker --config /etc/kiosk/retry.json' : 'PID COMMAND\n1 systemd\n118 kiosk-agent';
  else if (cmd === 'top') output = `CPU ${state.repaired ? '21' : '95'}% · memory ${state.repaired ? '48' : '82'}%`;
  else if (cmd === 'free') output = 'Mem: 8.0Gi total, 3.8Gi used, 4.2Gi available';
  else if (cmd === 'df') output = state.scenario === 'storage' && host === 'kiosk-017' && !state.storage.archiveMoved ? 'Filesystem Size Used Avail Use% Mounted on\n/dev/training 40G 39.6G 420M 99% /' : 'Filesystem Size Used Avail Use% Mounted on\n/dev/training 40G 21G 19G 53% /';
  else if (cmd === 'du') output = state.storage.archiveMoved ? '4.2G /mnt/archive/closed-archive.tar' : '4.2G /var/lib/closed-archive.tar';
  else if (cmd === 'tail') { const source = state.terminal.files[args.at(-1)] || state.logs.map((entry) => `${entry.at} ${entry.service} ${entry.message}`).join('\n'); output = source.split('\n').slice(-10).join('\n'); }
  else if (cmd === 'grep') { const pattern = args[0] || ''; const source = args[1] ? (state.terminal.files[args[1]] || '') : state.logs.map((entry) => `${entry.at} ${entry.kiosk || ''} ${entry.service} ${entry.message}`).join('\n'); output = source.split('\n').filter((entry) => entry.toLowerCase().includes(pattern.toLowerCase())).join('\n') || 'No matching lines.'; }
  else if (cmd === 'sha256sum') { const content = state.terminal.files[args[0]]; output = content == null ? `sha256sum: ${args[0] || 'missing file'}: No such file` : `${createHash('sha256').update(content).digest('hex')}  ${args[0]}`; }
  else if (cmd === 'journalctl') output = state.logs.filter((entry) => !entry.kiosk || entry.kiosk.endsWith('017')).map((entry) => `${toManila(entry.at)} ${entry.severity} ${entry.service}: ${entry.message}`).join('\n') || 'No matching journal entries.';
  else if (cmd === 'curl') { const targetResource = RESOURCES.find((resource) => resource.name === state.selectedResource) || RESOURCES[1]; const route = PROFILES.find((profile) => profile.name === state.vpn.selectedProfile); const reachable = Boolean(state.vpn.connected && route?.name === targetResource.network); const unhealthy = targetResource.name === 'WEB-2' && state.scenario === 'cpu-network' && !state.repaired; output = args.some((arg) => arg.includes('health')) ? (!reachable ? 'curl: (7) Failed to connect: no route to host' : unhealthy ? 'HTTP/1.1 503 Service Unavailable · WEB-2 slow response; review server and application logs' : 'HTTP/1.1 200 OK · service healthy') : 'curl: supported endpoint: http://health.local/health'; }
  else if (cmd === 'systemctl') {
    if (args[0] === 'status') output = `retry-worker.service: ${state.terminal.services.retryWorker}`;
    else if (args[0] === 'restart' && args[1] === 'retry-worker') {
      if (host !== 'kiosk-017') output = 'Permission denied: retry-worker repair is scoped to the fault-source kiosk KIOSK-LAB-017.';
      else { state.restartCount += 1; const valid = (() => { try { const c = JSON.parse(state.terminal.files['/etc/kiosk/retry.json'] || '{}'); return c.retry_delay_ms >= 1000 && c.retry_delay_ms <= 30000 && c.max_attempts >= 1 && c.max_attempts <= 5; } catch { return false; } })(); state.terminal.services.retryWorker = 'running'; state.repaired = valid; state.repairedAt = valid ? state.clock : null; state.recoveryMinutes = 0; state.recoveredAt = null; state.events.push({ at: state.clock, type: 'restart', label: 'retry-worker restarted', resource: 'KIOSK-LAB-017' }); output = valid ? 'retry-worker restarted with bounded retry policy.' : 'retry-worker restarted, but configuration is still unsafe; retry burst continues.'; }
    } else output = 'systemctl: use status or restart retry-worker';
  } else if (cmd === 'sudo' && args[0] === 'nano' && args[1] === '/etc/kiosk/retry.json') output = 'Use the configuration editor in this workspace to save the virtual retry.json file, then run systemctl restart retry-worker.';
  else if (cmd === 'mv') {
    const source = args[0], destination = args[1];
    if (host !== 'kiosk-017') output = 'mv: Permission denied: connect to KIOSK-LAB-017 first.';
    else if (source !== '/var/lib/closed-archive.tar' || destination !== '/mnt/archive/closed-archive.tar') output = 'mv: use the documented training archive path after confirming its checksum.';
    else { state.storage.archiveMoved = true; state.storage.archivedRecordsPreserved = true; const archive = state.terminal.files['/var/lib/closed-archive.tar']; delete state.terminal.files['/var/lib/closed-archive.tar']; state.terminal.files['/mnt/archive/closed-archive.tar'] = archive; state.events.push({ at: state.clock, type: 'repair', label: 'Closed archive moved to training archive volume; source records preserved', resource: 'KIOSK-LAB-017' }); output = 'Moved 4.2 GiB archive to /mnt/archive; records preserved. Root filesystem space recovered.'; }
  }
  else if (cmd === 'clamdscan') {
    if (host !== 'kiosk-017') output = 'clamdscan: connect to KIOSK-LAB-017 to run the scan on the affected host.';
    else if (!state.storage.archiveMoved || !state.storage.archivedRecordsPreserved) output = 'ERROR: cannot create scan temporary file: no space left on device';
    else { state.storage.scanPassed = true; state.events.push({ at: state.clock, type: 'scan', label: 'Fresh ClamAV scan completed with records preserved', resource: 'KIOSK-LAB-017' }); output = 'SCAN SUMMARY: 1 file scanned, 0 infected, records preserved.'; }
  }
  else if (cmd === 'clear') output = '';
  else output = `command not found: ${cmd}. Type help for supported training commands.`;
  return { prompt, output };
}

function recordSample(state) {
  const end = state.clock;
  const start = new Date(new Date(end).getTime() - 300000).toISOString();
  const healthyPeriod = Boolean(state.repaired && state.repairedAt && new Date(start) >= new Date(state.repairedAt));
  const step = { start, end, cpu: healthyPeriod ? 22 : 96, networkInBytes: Math.round((healthyPeriod ? 16 : 210) * 1048576), networkOutBytes: Math.round((healthyPeriod ? 13 : 180) * 1048576), memory: healthyPeriod ? 49 : 83, disk: 51, requests: healthyPeriod ? 440 : 6800, errors: healthyPeriod ? 0.1 : 4.1, latencyMs: healthyPeriod ? 118 : 2970 };
  state.samples['WEB-2'].push(step);
  for (const name of ['WEB-1', 'WEB-3']) { const healthy = sample('09:20', name === 'WEB-1' ? 19 : 23, 16, 12, { requests: 420, errors: 0, latencyMs: 110 }); healthy.start = start; healthy.end = end; state.samples[name].push(healthy); }
  if (healthyPeriod) state.recoveryMinutes += 5; else state.recoveryMinutes = 0;
  if (state.repaired && state.recoveryMinutes >= 15 && !state.recoveredAt) { state.recoveredAt = end; state.events.push({ at: end, type: 'recovery', label: 'Sustained recovery window verified', resource: 'WEB-2' }); }
}

export async function dispatch(userId, accessToken, state, action) {
  const next = structuredClone(state);
  const type = action?.type;
  if (type === 'scenario') return saveAttempt(userId, accessToken, makeInitial(['cpu-network', 'storage', 'vpn-access'].includes(action.scenario) ? action.scenario : 'cpu-network'));
  if (type === 'select-resource') { if (RESOURCES.some((r) => r.name === action.resource) || FLEET.some((k) => k.id === action.resource)) next.selectedResource = action.resource; }
  else if (type === 'range-select') { if (['all', '30m', '15m'].includes(action.range)) next.range = action.range; }
  else if (type === 'select-kiosk') { if (FLEET.some((k) => k.id === action.kiosk)) { next.selectedKiosk = action.kiosk; next.selectedResource = FLEET.find((k) => k.id === action.kiosk).backend; } }
  else if (type === 'vpn-select') { if (PROFILES.some((p) => p.name === action.profile)) next.vpn.selectedProfile = action.profile; }
  else if (type === 'vpn-connect') { const p = PROFILES.find((item) => item.name === next.vpn.selectedProfile); next.vpn.connected = true; next.vpn.connectedAt = next.clock; next.vpn.events.push({ at: next.clock, message: `Connected to ${p.name}; route ${p.route} installed.` }); next.events.push({ at: next.clock, type: 'vpn', label: `VPN connected: ${p.name}`, resource: 'operator-workstation' }); }
  else if (type === 'vpn-disconnect') { next.vpn.connected = false; next.vpn.events.push({ at: next.clock, message: 'VPN disconnected.' }); next.events.push({ at: next.clock, type: 'vpn', label: 'VPN disconnected', resource: 'operator-workstation' }); }
  else if (type === 'acknowledge') next.acknowledged = true;
  else if (type === 'clock-pause') next.paused = true;
  else if (type === 'clock-resume') next.paused = false;
  else if (type === 'clock-advance') { const minutes = Number(action.minutes) === 5 ? 5 : 1; for (let i = 0; i < minutes; i += 1) { next.clock = new Date(new Date(next.clock).getTime() + 60000).toISOString(); if (((new Date(next.clock).getUTCMinutes() + 8) % 5) === 0) recordSample(next); } }
  else if (type === 'terminal') { const result = scopedTerminal(next, String(action.command || '').slice(0, 256)); next.terminal.history.push({ ...result, at: next.clock }); next.terminal.history = next.terminal.history.slice(-200); }
  else if (type === 'config-save') { if (next.terminal.currentHost === 'kiosk-017' && typeof action.content === 'string' && action.content.length <= 4096) { next.configDraft = action.content; next.terminal.files['/etc/kiosk/retry.json'] = action.content; next.events.push({ at: next.clock, type: 'config', label: 'retry.json configuration saved', resource: 'KIOSK-LAB-017' }); } else { next.terminal.history.push({ prompt: 'config save', output: 'Permission denied: SSH to KIOSK-LAB-017 before editing its retry configuration.', at: next.clock }); } }
  else if (type === 'add-evidence') { const evidence = action.evidence; if (evidence && typeof evidence === 'object' && ['metric', 'log'].includes(evidence.kind) && next.evidence.length < 100) { const safeEvidence = Object.fromEntries(['kind', 'resourceId', 'resource', 'metric', 'source', 'statistic', 'period', 'start', 'end', 'value', 'unit', 'sourceId', 'kioskId', 'timestamp', 'severity', 'service', 'message', 'label'].filter((key) => evidence[key] !== undefined).map((key) => [key, String(evidence[key]).slice(0, 1000)])); next.evidence.push({ ...safeEvidence, id: `E-${String(next.evidence.length + 1).padStart(3, '0')}`, at: next.clock }); } }
  else if (type === 'workbook-field') { const { field, value } = action; if (Object.hasOwn(next.workbook.fields, field) && typeof value === 'string') next.workbook.fields[field] = value.slice(0, 1000); }
  else if (type === 'workbook-update') { const { stage, finding, action: updateAction, status } = action; next.workbook.updates.push({ at: next.clock, stage: String(stage || '').slice(0, 80), finding: String(finding || '').slice(0, 1200), action: String(updateAction || '').slice(0, 1200), status: String(status || '').slice(0, 80) }); }
  else if (type === 'storage-move' || type === 'storage-scan') { const command = type === 'storage-move' ? 'mv /var/lib/closed-archive.tar /mnt/archive/closed-archive.tar' : 'clamdscan /var/lib'; const result = scopedTerminal(next, command); next.terminal.history.push({ ...result, at: next.clock }); }
  else if (type === 'attempt-complete') {
    const stages = new Set(next.workbook.updates.map((entry) => entry.stage));
    const reportedStages = ['Initial acknowledgment', 'Investigation findings', 'Repair performed', 'Recovery verification'].every((stage) => stages.has(stage));
    if (state.scenario === 'cpu-network') next.completed = Boolean(next.recoveredAt && next.evidence.some((e) => e.kind === 'metric' && e.resource === 'WEB-2') && next.evidence.some((e) => e.kind === 'log' && e.kioskId === 'KIOSK-LAB-017') && reportedStages && /KIOSK-LAB-017/i.test(next.workbook.fields.rootCause) && /WEB-2/i.test(next.workbook.fields.rootCause));
    else if (state.scenario === 'vpn-access') next.completed = Boolean(next.vpn.connected && next.vpn.selectedProfile === 'Operations-East' && next.evidence.some((e) => e.kind === 'log' && e.sourceId === 'VPN-003') && reportedStages && /route|vpn/i.test(next.workbook.fields.currentFindings) && !next.events.some((e) => e.type === 'restart'));
    else next.completed = Boolean(next.storage.scanPassed && next.storage.archivedRecordsPreserved && next.evidence.some((e) => e.kind === 'log' && e.sourceId === 'ST-002') && next.evidence.some((e) => e.kind === 'log' && e.sourceId === 'ST-003') && reportedStages && /archive|storage/i.test(next.workbook.fields.rootCause));
  }
  return saveAttempt(userId, accessToken, next);
}

export function present(state) { return stateView(state); }
export function createSreAttempt(scenario = 'cpu-network') { return makeInitial(scenario); }
export function runSreTerminalCommand(state, command) { return scopedTerminal(state, command); }
export function getSreAlarmTime(samples) { return expectedAlarm(samples); }

export async function exportWorkbook(state) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LinuxLab SRE Training'; workbook.subject = 'Fictional incident response exercise'; workbook.created = new Date();
  const sheets = {
    'Incident Log': [
      ['Field', 'Value'], ['Incident ID', state.id || 'Draft'], ['Reporting date', state.startedAt], ['Update time', state.clock], ['Timezone', 'Asia/Manila (UTC+08:00)'],
      ['Affected kiosk IDs', state.scenario === 'cpu-network' ? 'KIOSK-LAB-017, KIOSK-LAB-018' : state.scenario === 'storage' ? 'KIOSK-LAB-017' : 'No kiosk outage confirmed'], ['Fault-source kiosk', state.workbook.fields.faultSource || 'Unknown / unconfirmed'], ['Backend name and resource ID', state.scenario === 'cpu-network' ? 'WEB-2 / i-0web002' : 'No backend fault confirmed'], ['VPN profile used', state.vpn.selectedProfile], ['Severity', state.workbook.fields.severity], ['Observed symptom', state.workbook.fields.observedSymptom], ['Status', state.recoveredAt ? 'Recovery verified' : 'Investigating'], ['Current findings', state.workbook.fields.currentFindings], ['Action taken', state.workbook.fields.actionTaken], ['Next action', state.workbook.fields.nextAction], ['Reporter', state.workbook.fields.reporter], ['Recovery verification time', state.recoveredAt || 'Not verified'], ['Root cause', state.workbook.fields.rootCause], ['Final resolution', state.workbook.fields.resolution],
      ...state.workbook.updates.map((u) => [u.stage, u.at, u.finding, u.action, u.status]),
    ],
    Timeline: [['Event time (Asia/Manila)', 'Event type', 'Resource', 'Evidence reference', 'Observation or action', 'Outcome'], ...state.events.map((e) => [e.at, e.type, e.resource, '', e.label, 'Recorded'])],
    'Metric Evidence': [['Resource ID', 'Metric name', 'Source / namespace', 'Statistic', 'Period', 'Period start', 'Period end', 'Value', 'Unit', 'Evidence reference'], ...state.evidence.filter((e) => e.kind === 'metric').map((e) => [e.resourceId, e.metric, e.source, e.statistic, e.period, e.start, e.end, e.value, e.unit, e.id])],
    'Asset Map': [['Kiosk', 'Private network', 'Backend', 'Resource ID', 'Relevant VPN profile'], ...FLEET.map((k) => [k.id, k.network, k.backend, RESOURCES.find((r) => r.name === k.backend).id, k.network])],
  };
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row.map((value) => typeof value === 'string' && /^[=+@-]/.test(value) ? `'${value}` : value)));
    sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF342738' } };
    sheet.columns.forEach((column) => { column.width = Math.min(48, Math.max(14, ...sheet.getColumn(column.number).values.map((v) => String(v ?? '').length + 2))); });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
