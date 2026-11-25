import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { executeMonitoringCommand } from './monitoring.js';
import { executeIncidentCommand } from './incident.js';
import { executeRequestLabCommand } from './requestTracing.js';
import { executeSecurityCommand } from './security.js';
import { executeDeploymentCommand } from './deployment.js';

const baseFiles = {
  '/home/learner/readme.txt': { type: 'file', content: 'Welcome to your Linux training machine. Start with pwd, then explore with ls.' },
  '/home/learner/.bashrc': { type: 'file', content: '# ~/.bashrc: shell settings for learner@learnbox\nexport PS1="\\u@\\h:\\w$ "' },
  '/home/learner/.profile': { type: 'file', content: '# ~/.profile: login shell settings for the LinuxLab training account' },
  '/home/learner/notes.txt': { type: 'file', content: 'Remember: commands are small tools that work together.' },
  '/home/learner/projects/README.md': { type: 'file', content: 'Training app workspace. Logs live in /var/log/training.' },
  '/var/log/training/app.log': { type: 'file', content: '2025-04-10 09:01:02 INFO  app boot sequence started\n2025-04-10 09:01:04 INFO  connected to training database\n2025-04-10 09:02:18 ERROR payment worker timeout\n2025-04-10 09:02:20 WARN  retry scheduled in 30s\n2025-04-10 09:03:11 ERROR payment worker timeout\n2025-04-10 09:04:00 INFO  health check passed\n2025-04-10 09:05:42 ERROR upstream API returned 503\n2025-04-10 09:06:10 INFO  request completed status=200\n2025-04-10 09:07:03 ERROR upstream API returned 503\n2025-04-10 09:08:18 INFO  worker queue ready' },
  '/var/log/training/auth.log': { type: 'file', content: '2025-04-10 09:01:10 INFO  user learner authenticated\n2025-04-10 09:03:22 WARN  invalid password for guest\n2025-04-10 09:04:15 INFO  session created id=tr-2048\n2025-04-10 09:06:42 INFO  token refreshed for learner' },
  '/var/log/training/system.log': { type: 'file', content: '2025-04-10 08:59:58 INFO  training kernel started\n2025-04-10 09:01:00 INFO  disk check complete\n2025-04-10 09:02:45 WARN  memory usage above 80 percent\n2025-04-10 09:07:22 INFO  scheduled cleanup finished' },
  '/etc/training/app.json': { type: 'file', content: '{\n  "name": "training-app",\n  "environment": "sandbox",\n  "port": 8080,\n  "healthPath": "/health"\n}' },
  '/etc/hostname': { type: 'file', content: 'learnbox' },
  '/etc/os-release': { type: 'file', content: 'PRETTY_NAME="Ubuntu 24.04.2 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nID_LIKE=debian' },
  '/var/log/syslog': { type: 'file', content: 'Training system initialized. All information in this simulator is fictional.' },
  '/tmp/.keep': { type: 'file', content: '' },
  '/home/learner/projects': { type: 'dir' }, '/home/learner': { type: 'dir' }, '/home': { type: 'dir' }, '/': { type: 'dir' },
  '/var': { type: 'dir' }, '/var/log': { type: 'dir' }, '/var/log/training': { type: 'dir' }, '/etc': { type: 'dir' }, '/etc/apt': { type: 'dir' }, '/tmp': { type: 'dir' },
  '/bin': { type: 'dir' }, '/usr': { type: 'dir' }, '/usr/bin': { type: 'dir' }, '/usr/local': { type: 'dir' }, '/usr/local/bin': { type: 'dir' },
  '/usr/share': { type: 'dir' }, '/opt': { type: 'dir' }, '/mnt': { type: 'dir' }, '/media': { type: 'dir' }, '/root': { type: 'dir' },
};

export function createEnvironment() {
  return normalizeEnvironment({ files: Object.fromEntries(Object.entries(baseFiles).map(([path, node]) => [path, { ...node }])), cwd: '/home/learner', oldpwd: '/home/learner', user: 'learner', host: 'learnbox', os: 'Ubuntu 24.04.2 LTS', services: { 'training-app': 'active (running)', 'nginx': 'active (running)', 'payment-worker': 'failed (Result: timeout)' }, processes: [{ pid: 1, user: 'root', cpu: 0.1, mem: 0.4, command: 'init' }, { pid: 412, user: 'app', cpu: 2.4, mem: 18.2, command: 'node training-app' }, { pid: 588, user: 'app', cpu: 0.0, mem: 4.6, command: 'nginx: worker' }, { pid: 701, user: 'app', cpu: 48.1, mem: 24.8, command: 'payment-worker --retry' }], disk: { total: 20, used: 17.2, available: 2.8 }, memory: { total: 4096, used: 3480, free: 616 } });
}

function tokenize(input) {
  const tokens = [];
  let word = '';
  let quote = null;
  let started = false;
  const flush = () => { if (started) tokens.push(word); word = ''; started = false; };
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && index + 1 < input.length) {
        const next = input[index + 1];
        if (next === '$') { word += '\uE000'; index += 1; }
        else if ('"\\`'.includes(next)) word += input[++index];
        else word += char;
      }
      else word += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; started = true; continue; }
    if (char === '\\') {
      if (index + 1 >= input.length) return { tokens: [], error: 'unexpected end of command after escape character' };
      const next = input[++index]; word += next === '$' ? '\uE000' : next; started = true; continue;
    }
    if (char === ';' || char === '&' || char === '<') return { tokens: [], error: `unsupported shell operator '${char}'` };
    if (char === '>' && input[index - 1] === '2') return { tokens: [], error: 'stderr redirection is not supported; use stdout redirection with > or >>' };
    if (char === '|' || char === '>') {
      flush();
      if (char === '>' && input[index + 1] === '>') { tokens.push('>>'); index += 1; }
      else tokens.push(char);
      continue;
    }
    if (/\s/.test(char)) { flush(); continue; }
    word += char; started = true;
  }
  if (quote) return { tokens: [], error: 'unclosed quoted string' };
  flush();
  if (tokens.some((token) => /\$(?:[A-Za-z_{(]|\d)/.test(token) || token.includes('`'))) return { tokens: [], error: 'variable and command substitution are not supported in this training shell' };
  return { tokens: tokens.map((token) => token.replaceAll('\uE000', '$')), error: null };
}
export function resolvePath(path, cwd = '/', user = 'learner') {
  path = String(path ?? '.').trim();
  const home = `/home/${user}`;
  if (path === '~') path = home;
  else if (path.startsWith('~/')) path = `${home}${path.slice(1)}`;
  const base = String(cwd || '/').startsWith('/') ? String(cwd || '/') : `/${cwd}`;
  const parts = (path.startsWith('/') ? path : `${base}/${path}`).split('/');
  const stack = [];
  parts.forEach((part) => { if (!part || part === '.') return; if (part === '..') stack.pop(); else stack.push(part); });
  return `/${stack.join('/')}` || '/';
}

export function normalizeEnvironment(environment) {
  const source = environment && typeof environment === 'object' ? environment : {};
  const files = {};
  const entries = Object.entries(source.files && typeof source.files === 'object' ? source.files : {})
    .map(([path, node]) => [resolvePath(path, '/', source.user || 'learner'), node])
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b));
  const ensureDirectory = (path) => {
    if (files[path]?.type === 'dir') return;
    if (files[path]?.type === 'file') {
      const displaced = files[path];
      delete files[path];
      const recoveryPath = `${path}.recovered-file`;
      files[recoveryPath] = { ...displaced, recoveredFromPath: path };
    }
    files[path] = { type: 'dir' };
  };
  ensureDirectory('/');
  entries.forEach(([path, original]) => {
    if (path === '/') return;
    const parts = path.slice(1).split('/');
    for (let index = 1; index < parts.length; index += 1) ensureDirectory(`/${parts.slice(0, index).join('/')}`);
    const node = original && typeof original === 'object' ? { ...original } : { type: 'file', content: String(original ?? '') };
    files[path] = node.type === 'dir' ? { ...node, type: 'dir' } : { ...node, type: 'file', content: String(node.content ?? '') };
  });
  const cwd = resolvePath(source.cwd || `/home/${source.user || 'learner'}`, '/', source.user || 'learner');
  let oldpwd = resolvePath(source.oldpwd || `/home/${source.user || 'learner'}`, '/', source.user || 'learner');
  const normalized = { ...source, files, cwd, oldpwd };
  normalized.evidence = Array.isArray(source.evidence) ? [...new Set(source.evidence)] : [];
  if (files[cwd]?.type !== 'dir') normalized.cwd = files[`/home/${source.user || 'learner'}`]?.type === 'dir' ? `/home/${source.user || 'learner'}` : '/';
  if (files[oldpwd]?.type !== 'dir') oldpwd = normalized.cwd;
  normalized.oldpwd = oldpwd;
  return normalized;
}
function parent(path) { return path.slice(0, path.lastIndexOf('/')) || '/'; }
function children(files, path) { return Object.keys(files).filter((key) => key !== path && parent(key) === path); }
function optionSet(args) { return new Set(args.filter((arg) => /^-[a-z]+$/i.test(arg)).flatMap((arg) => arg.length > 2 ? [...arg.slice(1)].map((flag) => `-${flag}`) : [arg])); }
function rejectOption(cmd, args, allowed) { const flags = optionSet(args); const invalid = [...flags].find((arg) => !allowed.includes(arg)); return invalid ? { output: `✖ ${cmd}: unsupported option '${invalid}'. Type help ${cmd} for examples.`, error: true } : null; }
function permissionShift(env, node) {
  const groups = env.users?.[env.user]?.groups || [];
  return env.user === node?.owner ? 6 : groups.includes(node?.group) ? 3 : 0;
}
function hasPermission(env, node, bits) {
  if (env.user === 'root') return true;
  const mode = Number.parseInt(String(node?.mode || (node?.type === 'dir' ? '0755' : '0644')), 8);
  return ((mode >> permissionShift(env, node)) & bits) === bits;
}
function canTraversePath(env, path) {
  if (env.user === 'root') return true;
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    const node = env.files[current];
    if (node?.type === 'dir' && !hasPermission(env, node, 0b001)) return false;
  }
  return true;
}
function hasReadPermission(env, node, path) {
  if (!node || node.type !== 'file' || env.user === 'root') return true;
  return canTraversePath(env, parent(path)) && hasPermission(env, node, 0b100);
}
function canWriteInParent(env, path) {
  const directory = parent(path);
  const node = env.files[directory];
  return node?.type === 'dir' && canTraversePath(env, directory) && hasPermission(env, node, 0b011);
}
function permissionString(node) {
  const mode = Number.parseInt(String(node.mode || (node.type === 'dir' ? '0755' : '0644')), 8);
  const bits = [6,3,0].map((shift) => [0b100,0b010,0b001].map((bit, index) => mode >> shift & bit ? ['r','w','x'][index] : '-').join('')).join('');
  return `${node.type === 'dir' ? 'd' : '-'}${bits}`;
}
function persistRemoteHost(env) {
  if (!env.remoteSession) return;
  const key = env.remoteSession.key;
  env.hosts[key] = {
    ...(env.hosts[key] || {}), host: env.host, user: env.user, cwd: env.cwd, oldpwd: env.oldpwd,
    files: env.files, services: env.services, processes: env.processes, evidence: env.evidence,
  };
}
function runOne(env, tokens, input = '') {
  if (!tokens.length) return { output: '', error: false };
  const [cmd, ...args] = tokens;
  const fail = (message) => ({ output: `✖ ${message}`, error: true });
  const ok = (output = '') => ({ output, error: false });
  const read = (path) => {
    const p = resolvePath(path, env.cwd, env.user);
    env.lastReadError = '';
    if (env.files[p]?.type !== 'file') return null;
    if (!hasReadPermission(env, env.files[p], p)) { env.lastReadError = `${path}: Permission denied`; return null; }
    env.lastReadError = '';
    env.evidence = [...new Set([...(env.evidence || []), p])];
    return { path: p, content: env.files[p].content };
  };
  if (env.disablePrinterCommands && ['lpinfo', 'lpadmin', 'lpstat', 'lp', 'cancel'].includes(cmd)) return fail(`${cmd}: no printer is configured on this computer`);
  switch (cmd) {
    case 'pwd': return args.length ? fail('pwd: this training shell does not support options or extra arguments') : ok(env.cwd);
    case 'whoami': if (args.length) return fail('whoami: unexpected argument'); env.evidence = [...new Set([...(env.evidence || []), `identity:${env.user}`])]; return ok(env.user);
    case 'id': {
      if (args.length > 1) return fail('id: expected at most one user name');
      const user = args[0] || env.user; const account = env.users?.[user];
      if (env.users && !account) return fail(`id: '${user}': no such training user`);
      const groups = account?.groups || ['learners'];
      env.evidence = [...new Set([...(env.evidence || []), `groups:${user}`])];
      return ok(`uid=${account?.uid ?? (user === 'root' ? 0 : user === 'learner' ? 1000 : 1100)}(${user}) gid=${groups[0] || 'learners'} groups=${groups.join(',')}`);
    }
    case 'sudo': {
      if (!['training-admin','training administrator'].includes(env.role)) return fail('sudo: this lesson role is not authorized to use training administrator commands');
      if (Array.isArray(env.adminUsers) && !env.adminUsers.includes(env.user)) return fail('sudo: user is not in the sudoers file. This incident will be reported.');
      if (args[0] === 'adduser') {
        const account = env.users?.[env.user];
        if (!account?.passwordHash) return fail('sudo: set an administrator password first with passwd');
        env.interactivePrompt = { kind: 'password', operation: 'sudo-adduser', username: env.user, command: args.join(' ') };
        return ok(`[sudo] password for ${env.user}:`);
      }
      if (args[0] !== '-u' || !args[1] || !args[2]) return fail('sudo: usage: sudo -u USER COMMAND [ARGS...]');
      const user = args[1]; if (!env.users?.[user]) return fail(`sudo: unknown training user '${user}'`);
      const previous = env.user; env.user = user;
      const checked = runOne(env, args.slice(2), input);
      const target = args.slice(2).find((item) => item.startsWith('/'));
      env.accessChecks = { ...(env.accessChecks || {}), [user]: { path: target ? resolvePath(target, env.cwd, user) : null, allowed: !checked.error, exitCode: checked.error ? 1 : 0 } };
      env.user = previous;
      return checked;
    }
    case 'adduser': {
      if (!['training-admin','training administrator'].includes(env.role)) return fail('adduser: only an administrator can create training accounts');
      if (Array.isArray(env.adminUsers) && (!env.adminUsers.includes(env.user) || !env.sudoContext)) return fail('adduser: run this command with sudo');
      if (args.length !== 1 || !/^[a-z_][a-z0-9_-]{0,31}$/.test(args[0])) return fail('adduser: usage: sudo adduser USERNAME (use lowercase letters, numbers, _ or -)');
      if (env.users?.[args[0]]) return fail(`adduser: The user '${args[0]}' already exists.`);
      env.interactivePrompt = { kind: 'password', operation: 'adduser', username: args[0], step: 'new' };
      return ok(`Adding user '${args[0]}' ...\nEnter a new password for ${args[0]}:`);
    }
    case 'su': {
      const username = args.filter((arg) => !arg.startsWith('-')).at(-1);
      if (args.length > 2 || !username) return fail('su: usage: su - USERNAME');
      if (!env.users?.[username]) return fail(`su: user '${username}' does not exist`);
      if (username === env.user) return ok('');
      env.interactivePrompt = { kind: 'password', operation: 'su', username };
      return ok(`Password for ${username}:`);
    }
    case 'passwd': {
      if (args.length) return fail('passwd: set the password for the current simulated account without command-line arguments');
      const account = env.users?.[env.user];
      if (!env.loggedIn || !account) return fail('passwd: no signed-in account');
      env.interactivePrompt = { kind: 'password', operation: 'passwd', username: env.user, step: 'new' };
      return ok(`New password for ${env.user}:`);
    }
    case 'logout': {
      if (!env.loggedIn) return fail('logout: no user is currently logged in');
      if (!env.users?.[env.user]?.passwordHash) return fail('logout: set this account password first with passwd');
      delete env.userSession;
      delete env.interactivePrompt;
      env.loggedIn = false;
      env.loginScreen = true;
      return ok('Ubuntu 24.04.2 LTS learnbox tty1\n\nSystem logged out. Enter an account name to sign in.');
    }
    case 'chmod': {
      if (!['training-admin','training administrator','training operator'].includes(env.role)) return fail('chmod: administrator role required in this training environment');
      if (args.length !== 2 || !/^0?[0-7]{3}$/.test(args[0])) return fail('chmod: usage: chmod MODE FILE (octal mode only)');
      const path = resolvePath(args[1], env.cwd, env.user); const node = env.files[path];
      if (!node || node.type !== 'file') return fail(`chmod: cannot access '${args[1]}': No such file`);
      node.mode = args[0].length === 3 ? `0${args[0]}` : args[0]; return ok('');
    }
    case 'chgrp': {
      if (!['training-admin','training administrator'].includes(env.role)) return fail('chgrp: administrator role required in this training environment');
      if (args.length !== 2) return fail('chgrp: usage: chgrp GROUP FILE');
      if (!env.groups?.includes(args[0])) return fail(`chgrp: invalid training group '${args[0]}'`);
      const path = resolvePath(args[1], env.cwd, env.user); const node = env.files[path];
      if (!node || node.type !== 'file') return fail(`chgrp: cannot access '${args[1]}': No such file`);
      node.group = args[0]; return ok('');
    }
    case 'chown': {
      if (!['training-admin','training administrator'].includes(env.role)) return fail('chown: administrator role required in this training environment');
      if (args.length !== 2) return fail('chown: usage: chown USER:GROUP FILE');
      const [owner, group] = args[0].split(':');
      if (!env.users?.[owner] || (group && !env.groups?.includes(group))) return fail('chown: unknown training user or group');
      const path = resolvePath(args[1], env.cwd, env.user); const node = env.files[path];
      if (!node || node.type !== 'file') return fail(`chown: cannot access '${args[1]}': No such file`);
      node.owner = owner; if (group) node.group = group; return ok('');
    }
    case 'hostname': if (args.length) return fail('hostname: unexpected argument'); env.evidence = [...new Set([...(env.evidence || []), `host:${env.host}`])]; return ok(env.host);
    case 'ip': {
      if (!env.network) return fail('ip: no network evidence is available in this training workspace');
      const action = args[0];
      if (action === 'addr' && (args.length === 1 || args[1] === 'show')) {
        env.evidence = [...new Set([...(env.evidence || []), 'network:interfaces'])];
        return ok(env.network.interfaces.map((item, index) => `${index + 1}: ${item.name}: <BROADCAST,MULTICAST,${item.state}>\n    inet ${item.address}`).join('\n'));
      }
      if (action === 'route' && (args.length === 1 || args[1] === 'show')) {
        env.evidence = [...new Set([...(env.evidence || []), 'network:routes'])];
        return ok(env.network.routes.map((item) => `${item.destination} via ${item.via} dev ${item.device}`).join('\n'));
      }
      return fail('ip: supported training views are addr [show] and route [show]');
    }
    case 'getent': {
      if (args.length !== 2 || args[0] !== 'hosts') return fail('getent: supported form is getent hosts HOST');
      const address = env.network?.dns?.[args[1]];
      if (!address) return fail(`getent: ${args[1]}: Name or service not known in training DNS`);
      env.evidence = [...new Set([...(env.evidence || []), `dns:${args[1]}`])];
      return ok(`${address} ${args[1]}`);
    }
    case 'ss': {
      if (!env.network?.listeners || args.length !== 1 || args[0] !== '-ltn') return fail('ss: supported training view is ss -ltn in network lessons');
      env.evidence = [...new Set([...(env.evidence || []), 'network:listeners'])];
      return ok(`State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process\n${env.network.listeners.map((item) => `LISTEN 0 128 ${item.address}:${item.port} 0.0.0.0:* users:(('${item.process}',pid=2048,fd=8))`).join('\n')}`);
    }
    case 'openssl': {
      if (args.join(' ') !== 's_client -connect api.training.test:443 -servername api.training.test' || !env.network?.tls) return fail('openssl: supported training form is s_client -connect HOST:443 -servername HOST');
      const cert = env.network.tls.certificate;
      env.evidence = [...new Set([...(env.evidence || []), 'tls:certificate', 'tls:termination'])];
      return ok(`CONNECTED to api.training.test:443\nTLS terminates at ${env.network.tls.terminator}\nsubject=${cert.subject}\nsubjectAltName=${cert.names.join(', ')}\nnotBefore=${cert.notBefore}\nnotAfter=${cert.notAfter}\nverification=${cert.valid ? 'OK' : 'hostname mismatch'}\nProtocol=${cert.protocol}`);
    }
    case 'waf': {
      if (args.length !== 1 || args[0] !== 'inspect' || !env.network?.waf) return fail('waf: supported training view is waf inspect in the HTTPS lesson');
      const event = env.network.waf;
      env.evidence = [...new Set([...(env.evidence || []), 'waf:event'])];
      return ok(`Event=${event.id} time=${event.time}\nobserved source=${event.sourceAddress}\nforwarded-for=${event.forwardedFor}\nconfigured allowlist=${event.allowlist}\nproxy=${event.proxy}\nforwarded-header trust=${event.forwardedHeaderTrust}\nProxy handling and the allowlist source used in production are unconfirmed.`);
    }
    case 'ssh': {
      if (env.remoteSession) return fail('ssh: nested remote sessions are not supported');
      if (args.length !== 1 || !args[0].includes('@')) return fail('ssh: usage: ssh USER@HOST');
      const [user, host] = args[0].split('@'); const remote = env.hosts?.[host];
      if (!remote) return fail(`ssh: could not resolve training host '${host}'`);
      if (remote.fingerprint !== env.hostFingerprints?.[host]) return fail(`ssh: host fingerprint mismatch for ${host}`);
      if (env.knownHosts?.[host] !== remote.fingerprint && !env.evidence?.includes(`/home/${env.user}/connection.txt`)) return fail('ssh: read and verify the supplied connection fingerprint before connecting');
      if (user !== remote.user) return fail(`ssh: user '${user}' is not authorized for ${host}`);
      env.knownHosts = { ...(env.knownHosts || {}), [host]: remote.fingerprint };
      env.localSession = { host: env.host, user: env.user, cwd: env.cwd, oldpwd: env.oldpwd, files: env.files, services: env.services, processes: env.processes };
      env.remoteSession = { key: host };
      const priorEvidence = env.evidence || [];
      const normalized = normalizeEnvironment({ ...remote, user, cwd: remote.cwd || `/home/${user}` });
      Object.assign(env, normalized);
      // Evidence belongs to the attempt, while filesystem and working directory
      // belong to the active host. Keep local connection evidence after SSH.
      env.evidence = [...new Set([...priorEvidence, ...(normalized.evidence || [])])];
      env.host = remote.host || host;
      env.remoteSession = { key: host };
      return ok(`Connected to ${host} as ${user}`);
    }
    case 'exit': {
      if (args.length) return fail('exit: unexpected argument');
      if (env.userSession) {
        const previous = env.userSession;
        env.user = previous.user; env.cwd = previous.cwd; env.oldpwd = previous.oldpwd;
        env.role = previous.role;
        delete env.userSession;
        return ok(`Returned to ${env.user}`);
      }
      if (!env.remoteSession || !env.localSession) return fail('exit: not in a remote training session');
      persistRemoteHost(env);
      const local = env.localSession;
      env.host = local.host; env.user = local.user; env.cwd = local.cwd; env.oldpwd = local.oldpwd;
      env.files = local.files; env.services = local.services; env.processes = local.processes;
      delete env.remoteSession; delete env.localSession;
      return ok(`Disconnected from remote host; returned to ${env.host}`);
    }
    case 'uname': return ok(args.includes('-a') ? `Linux ${env.host} 6.8.0-training-generic #1-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : args.includes('-r') ? '6.8.0-training-generic' : 'Linux');
    case 'date': return ok('Sat Apr 12 09:08:18 UTC 2025');
    case 'which': { if (!args.length) return fail('which: missing command name'); const available = new Set('pwd ls cd mkdir touch cat echo printf head tail grep find wc sort uniq cp mv rm ps top df free systemctl journalctl curl jq editor vim vi whoami id hostname ssh exit chmod chgrp chown sudo ip getent ss openssl waf uname date which tree file du man less more clear history help'.split(' ')); return ok(args.map((name) => available.has(name) ? `/usr/bin/${name}` : '').filter(Boolean).join('\n')); }
    case 'file': { if (!args.length) return fail('file: missing operand'); return args.map((name) => { const path = resolvePath(name, env.cwd, env.user); const node = env.files[path]; return node ? `${name}: ${node.type === 'dir' ? 'directory' : /\.json$/i.test(name) ? 'JSON text data' : 'ASCII text'}` : `file: ${name}: cannot open (No such file)`; }).join('\n').includes('cannot open') ? fail(`file: cannot open '${args.find((name) => !env.files[resolvePath(name, env.cwd, env.user)])}'`) : ok(args.map((name) => { const path = resolvePath(name, env.cwd, env.user); const node = env.files[path]; return `${name}: ${node.type === 'dir' ? 'directory' : /\.json$/i.test(name) ? 'JSON text data' : 'ASCII text'}`; }).join('\n')); }
    case 'man': case 'less': case 'more': { const name = args.find((item) => !item.startsWith('-')); if (!name) return fail(`${cmd}: missing operand`); const page = env.files[resolvePath(name, env.cwd, env.user)]; if (page?.type === 'file') return ok(page.content); if (cmd === 'man' && ['pwd', 'ls', 'cd', 'cat', 'grep', 'find', 'mkdir', 'cp', 'mv', 'rm', 'touch'].includes(name)) return ok(`${name}(1) — Ubuntu training manual\n\nNAME\n    ${name} - ${({ pwd: 'print the current working directory', ls: 'list directory contents', cd: 'change the shell working directory', cat: 'concatenate and print files', grep: 'search text using a pattern', find: 'search for files and directories', mkdir: 'create directories', cp: 'copy files', mv: 'move files', rm: 'remove files or directories', touch: 'create an empty file' })[name]}\n\nThis concise manual page is part of the LinuxLab Ubuntu simulation.`); return fail(`${cmd}: no manual or file named '${name}'`); }
    case 'tree': { const base = args.find((item) => !item.startsWith('-')) || '.'; const root = resolvePath(base, env.cwd, env.user); if (env.files[root]?.type !== 'dir') return fail(`tree: '${base}': not a directory`); const lines = [base]; const descend = (dir, prefix = '') => { const entries = children(env.files, dir).filter((path) => !path.split('/').at(-1).startsWith('.')).sort(); entries.forEach((path, index) => { const last = index === entries.length - 1; lines.push(`${prefix}${last ? '└── ' : '├── '}${path.split('/').at(-1)}${env.files[path].type === 'dir' ? '/' : ''}`); if (env.files[path].type === 'dir') descend(path, `${prefix}${last ? '    ' : '│   '}`); }); }; descend(root); return ok(`${lines.join('\n')}\n${lines.length - 1} items`); }
    case 'du': { const base = args.find((item) => !item.startsWith('-')) || '.'; const root = resolvePath(base, env.cwd, env.user); if (!env.files[root]) return fail(`du: cannot access '${base}': No such file or directory`); const size = Object.keys(env.files).filter((path) => path === root || path.startsWith(`${root}/`)).reduce((sum, path) => sum + (env.files[path].content?.length || 4), 0); return ok(`${Math.max(4, Math.ceil(size / 1024))}\t${base}`); }
    case 'ls': {
      const invalid = rejectOption('ls', args, ['-a', '-l', '-h']); if (invalid) return invalid;
      let target = args.find((a) => !a.startsWith('-')) || '.'; let path = resolvePath(target, env.cwd, env.user); const node = env.files[path]; const flags = optionSet(args);
      if (!node) return fail(`ls: cannot access '${target}': No such file or directory`);
      if (!canTraversePath(env, path) || node.type === 'dir' && !hasPermission(env, node, 0b101)) return fail(`ls: cannot open '${target}': Permission denied`);
      if (node.type === 'file') {
        if (!flags.has('-l')) return ok(target);
        env.evidence = [...new Set([...(env.evidence || []), path])];
        return ok(`${permissionString(node)} 1 ${node.owner || 'learner'} ${node.group || 'learners'} ${String(node.content?.length || 0).padStart(6)} Nov 22 09:00 ${target}`);
      }
      const names = children(env.files, path).map((p) => p.slice(path === '/' ? 1 : path.length + 1));
      const visible = names.filter((name) => flags.has('-a') || !name.startsWith('.'));
      if (!flags.has('-l')) return ok(flags.has('-a') ? ['.', '..', ...visible].join('  ') : visible.join('  '));
      const entries = (flags.has('-a') ? ['.', '..', ...visible] : visible).map((name) => { const childPath = resolvePath(`${target === '.' ? '' : `${target}/`}${name}`, env.cwd, env.user); const child = env.files[childPath]; const isDir = child?.type === 'dir'; const size = child?.content?.length || 4096; return `${permissionString(child || { type: isDir ? 'dir' : 'file' })} 1 ${child?.owner || 'learner'} ${child?.group || 'learners'} ${String(size).padStart(6)} Apr 10 09:00 ${name}${isDir ? '/' : ''}`; });
      return ok(`total ${entries.length}\n${entries.join('\n')}`);
    }
    case 'cd': {
      if (args.length > 1) return fail('cd: too many arguments');
      const target = args[0] === '-' ? (env.oldpwd || `/home/${env.user}`) : resolvePath(args[0] || `/home/${env.user}`, env.cwd, env.user);
      if (env.files[target]?.type !== 'dir') return fail(`cd: ${args[0] || ''}: No such directory`);
      if (!canTraversePath(env, target)) return fail(`cd: ${args[0] || target}: Permission denied`);
      env.oldpwd = env.cwd; env.cwd = target;
      return args[0] === '-' ? ok(target) : ok('');
    }
    case 'mkdir': {
      const invalid = rejectOption('mkdir', args, ['-p']); if (invalid) return invalid;
      const paths = args.filter((a) => !a.startsWith('-')); if (!paths.length) return fail('mkdir: missing operand');
      for (const p of paths) {
        const full = resolvePath(p, env.cwd, env.user);
        if (env.files[full]) { if (optionSet(args).has('-p')) continue; return fail(`mkdir: cannot create directory '${p}': File exists`); }
        if (optionSet(args).has('-p')) {
          let current = '';
          for (const part of full.split('/').filter(Boolean)) {
            const next = `${current}/${part}`;
            if (!env.files[next]) {
              if (!canWriteInParent(env, next)) return fail(`mkdir: cannot create directory '${p}': Permission denied`);
              env.files[next] = { type: 'dir', owner: env.user, group: env.users?.[env.user]?.groups?.[0] || env.user, mode: '0755' };
            } else if (env.files[next].type !== 'dir') return fail(`mkdir: cannot create directory '${p}': a path component is not a directory`);
            current = next;
          }
          continue;
        }
        if (!env.files[parent(full)] || env.files[parent(full)].type !== 'dir') return fail(`mkdir: cannot create directory '${p}': parent directory does not exist`);
        if (!canWriteInParent(env, full)) return fail(`mkdir: cannot create directory '${p}': Permission denied`);
        env.files[full] = { type: 'dir', owner: env.user, group: env.users?.[env.user]?.groups?.[0] || env.user, mode: '0755' };
      }
      return ok('');
    }
    case 'touch': {
      const invalid = rejectOption('touch', args, []); if (invalid) return invalid;
      if (!args.length) return fail('touch: missing file operand');
      for (const p of args) {
        const full = resolvePath(p, env.cwd, env.user);
        if (!env.files[full]) {
          if (!env.files[parent(full)] || env.files[parent(full)].type !== 'dir') return fail(`touch: cannot touch '${p}': parent directory does not exist`);
          if (!canWriteInParent(env, full)) return fail(`touch: cannot touch '${p}': Permission denied`);
          env.files[full] = { type: 'file', content: '', owner: env.user, group: env.users?.[env.user]?.groups?.[0] || env.user, mode: '0644' };
        } else if (!hasPermission(env, env.files[full], 0b010)) return fail(`touch: cannot touch '${p}': Permission denied`);
      }
      return ok('');
    }
    case 'cat': { const numbered = args[0] === '-n'; const paths = numbered ? args.slice(1) : args; if (args.some((a) => a.startsWith('-') && a !== '-n')) return fail(`cat: unsupported option '${args.find((a) => a.startsWith('-') && a !== '-n')}'`); if (!paths.length) return input ? ok(input) : fail('cat: missing file operand'); const out = []; for (const p of paths) { const node = read(p); if (!node) return fail(`cat: ${env.lastReadError || `${p}: No such file`}`); out.push(node.content); } const content = out.join('\n'); return ok(numbered ? content.split('\n').map((line, i) => `${String(i + 1).padStart(6)}  ${line}`).join('\n') : content); }
    case 'echo': { let values = args; if (args[0] === '-n') values = args.slice(1); return ok(values.join(' ')); }
    case 'printf': { if (!args.length) return ok(''); const [format, ...values] = args; let index = 0; return ok(format.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/%s|%d|%i/g, () => values[index++] ?? '')); }
    case 'bash': {
      if (args.length !== 1) return fail('bash: supported form is bash SCRIPT');
      const path = resolvePath(args[0], env.cwd, env.user); const script = env.files[path];
      if (!script || script.type !== 'file') return fail(`bash: ${args[0]}: No such file`);
      const lines = script.content.split(/\r?\n/).filter((line) => line.trim());
      const fields = { HOSTNAME: env.host, DISK: `${env.disk?.used ?? 0}G used / ${env.disk?.total ?? 0}G total`, MEMORY: `${env.memory?.used ?? 0} MiB used / ${env.memory?.total ?? 0} MiB total`, SERVICE: env.services?.['training-app'] || 'unknown' };
      const output = [];
      for (const line of lines) {
        const match = line.match(/^echo\s+"(Host|Disk|Memory|Service): \$(HOSTNAME|DISK|MEMORY|SERVICE)"$/);
        if (!match || ({ Host:'HOSTNAME', Disk:'DISK', Memory:'MEMORY', Service:'SERVICE' })[match[1]] !== match[2]) return fail(`bash: unsupported script syntax in ${args[0]}: ${line}`);
        output.push(`${match[1]}: ${fields[match[2]]}`);
      }
      if (Object.keys(fields).length !== 4 || !['HOSTNAME','DISK','MEMORY','SERVICE'].every((key) => script.content.includes(`$${key}`))) return fail('bash: report script must include host, disk, memory, and service fields');
      env.evidence = [...new Set([...(env.evidence || []), `script:${path}`, 'system:disk', 'system:memory', 'service:training-app'])];
      return ok(output.join('\n'));
    }
    case 'crontab': {
      if (args[0] === '-l' && args.length === 1) return ok(env.schedule ? `${env.schedule.expression} ${env.schedule.script} # TZ=${env.schedule.timezone}` : 'no crontab for learner');
      if (args[0] !== 'add' || args.length !== 3) return fail('crontab: usage: crontab add "MIN HOUR * * * SCRIPT" TIMEZONE');
      const match = args[1].match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*\s+(\S+)$/);
      if (!match || Number(match[1]) > 59 || Number(match[2]) > 23 || !['UTC','Asia/Manila'].includes(args[2])) return fail('crontab: supported schedule is daily MIN HOUR * * * SCRIPT with UTC or Asia/Manila');
      const scriptPath = resolvePath(match[3], env.cwd, env.user);
      if (env.files[scriptPath]?.type !== 'file') return fail(`crontab: script not found: ${match[3]}`);
      env.schedule = { expression: `${match[1]} ${match[2]} * * *`, script: scriptPath, timezone: args[2], runs: [] };
      return ok(`training schedule installed (${args[2]})`);
    }
    case 'editor': {
      if (args.length === 1) return ok('LinuxLab simulated editor\nUsage: editor set FILE .jsonKey VALUE\nThis editor supports setting one top-level JSON value.');
      if (args[0] !== 'set' || args.length !== 4) return fail('editor: use editor set FILE .jsonKey VALUE');
      if (!['training-admin','training administrator'].includes(env.role)) return fail('editor: authorized training administrator role required');
      const path = resolvePath(args[1], env.cwd, env.user);
      const node = env.files[path];
      if (!node || node.type !== 'file') return fail(`editor: cannot open '${args[1]}': No such file`);
      if (!/^\.[A-Za-z][\w-]*$/.test(args[2])) return fail('editor: only a top-level JSON key such as .port is supported');
      try {
        const value = JSON.parse(node.content);
        const key = args[2].slice(1);
        const raw = args[3];
        value[key] = /^\d+$/.test(raw) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
        node.content = `${JSON.stringify(value, null, 2)}\n`;
        return ok(`Saved ${args[1]} (${args[2]} updated)`);
      } catch { return fail(`editor: '${args[1]}' is not valid JSON; file was not changed`); }
    }
    case 'jq': {
      const invalid = rejectOption('jq', args, ['-r']); if (invalid) return invalid;
      const raw = args[0] === '-r' ? args[1] : args[0];
      const fileArg = args[0] === '-r' ? args[2] : args[1];
      if (!raw || !fileArg) return fail('jq: usage: jq [-r] FILTER FILE');
      const file = read(fileArg); if (!file) return fail(`jq: ${fileArg}: No such file`);
      let value; try { value = JSON.parse(file.content); } catch { return fail(`jq: ${fileArg}: Invalid JSON`); }
      if (raw === '.') return ok(JSON.stringify(value, null, 2));
      if (/^\.[A-Za-z][\w-]*$/.test(raw)) {
        const selected = value[raw.slice(1)];
        if (selected === undefined) return fail(`jq: ${raw}: key not found`);
        return ok(args[0] === '-r' ? String(selected) : JSON.stringify(selected));
      }
      return fail(`jq: unsupported filter '${raw}'. Supported: . and .KEY`);
    }
    case 'head': case 'tail': { const invalid = args.find((a) => a.startsWith('-') && a !== '-n' && !/^-\d+$/.test(a)); if (invalid) return fail(`${cmd}: unsupported option '${invalid}'. Use -n COUNT.`); let count = 10; const fileArgs = []; for (let i = 0; i < args.length; i++) { if (args[i] === '-n') { count = Number(args[++i]); if (!Number.isInteger(count) || count < 1) return fail(`${cmd}: -n needs a positive whole number`); } else if (/^-\d+$/.test(args[i])) count = Number(args[i].slice(1)); else if (!args[i].startsWith('-')) fileArgs.push(args[i]); } if (!fileArgs.length && !input) return fail(`${cmd}: missing file operand`); const contents = fileArgs.length ? fileArgs.map((p) => read(p)?.content ?? null) : [input]; if (contents.some((x) => x === null)) return fail(`${cmd}: cannot open file`); const lines = contents.join('\n').split('\n'); return ok((cmd === 'head' ? lines.slice(0, count) : lines.slice(-count)).join('\n')); }
    case 'grep': { const invalid = rejectOption('grep', args, ['-i', '-c', '-n', '-v']); if (invalid) return invalid; const flags = [...optionSet(args)]; const rest = args.filter((a) => !a.startsWith('-')); const pattern = rest.shift(); if (!pattern) return fail('grep: missing search pattern'); const data = rest.length ? rest.map((p) => ({ name: p, content: read(p)?.content ?? null })) : [{ name: '', content: input }]; if (data.some((x) => x.content === null)) return fail('grep: file not found'); const lines = data.flatMap(({ name, content }) => content.split('\n').map((line, i) => ({ line, number: i + 1 })).filter(({ line }) => (flags.includes('-i') ? line.toLowerCase().includes(pattern.toLowerCase()) : line.includes(pattern)) !== flags.includes('-v')).map(({ line, number }) => flags.includes('-n') ? `${number}:${line}` : line)); if (flags.includes('-c')) return lines.length ? ok(String(lines.length)) : { output: '0', error: true, noMatches: true }; if (!lines.length) return fail(`grep: no lines matched '${pattern}'`); return ok(lines.join('\n')); }
    case 'find': { let base = '.'; let i = 0; if (args[i] && !args[i].startsWith('-')) base = args[i++]; const path = resolvePath(base, env.cwd, env.user); if (!env.files[path]) return fail(`find: '${base}': No such file or directory`); let name = null; let insensitive = false; let type = null; for (; i < args.length; i++) { if (args[i] === '-name' || args[i] === '-iname') { insensitive = args[i] === '-iname'; name = args[++i]; if (!name) return fail('find: -name needs a pattern'); } else if (args[i] === '-type') { type = args[++i]; if (!['f', 'd'].includes(type)) return fail('find: -type supports f (file) or d (directory)'); } else return fail(`find: unsupported option '${args[i]}'`); } const matches = Object.keys(env.files).filter((p) => (p === path || p.startsWith(path === '/' ? '/' : `${path}/`)) && (!name || (insensitive ? p.split('/').pop().toLowerCase().includes(name.replaceAll('*', '').toLowerCase()) : p.split('/').pop().includes(name.replaceAll('*', '')))) && (!type || (type === 'd' ? env.files[p].type === 'dir' : env.files[p].type === 'file'))); return ok(matches.join('\n')); }
    case 'wc': { const invalid = args.find((a) => a.startsWith('-') && !/^-[lwc]+$/.test(a)); if (invalid) return fail(`wc: unsupported option '${invalid}'. Use -l, -w, or -c.`); const flags = args.filter((a) => a.startsWith('-')).join(''); const paths = args.filter((a) => !a.startsWith('-')); const contents = paths.length ? paths.map((p) => read(p)?.content ?? null) : [input]; if (contents.some((x) => x === null)) return fail('wc: file not found'); return ok(contents.map((c, i) => { const lines = c ? c.split('\n').length : 0; const words = c.trim() ? c.trim().split(/\s+/).length : 0; const cols = [flags.includes('l') ? lines : null, flags.includes('w') ? words : null, flags.includes('c') ? c.length : null].filter((x) => x !== null); if (!cols.length) cols.push(lines, words, c.length); return `${cols.join(' ')}${paths[i] ? ` ${paths[i]}` : ''}`; }).join('\n')); }
    case 'sort': { const invalid = rejectOption('sort', args, ['-r', '-u']); if (invalid) return invalid; const path = args.find((a) => !a.startsWith('-')); const content = path ? read(path)?.content : input; if (content === undefined || content === null) return fail('sort: file not found'); const lines = content.split('\n').sort((a, b) => args.includes('-r') ? b.localeCompare(a) : a.localeCompare(b)); return ok((args.includes('-u') ? [...new Set(lines)] : lines).join('\n')); }
    case 'uniq': { const invalid = rejectOption('uniq', args, []); if (invalid) return invalid; const path = args.find((a) => !a.startsWith('-')); const content = path ? read(path)?.content : input; if (content === undefined || content === null) return fail('uniq: file not found'); let prev = null; return ok(content.split('\n').filter((line) => { if (line === prev) return false; prev = line; return true; }).join('\n')); }
    case 'tar': {
      if (args[0] === '-czf' && args.length >= 3) {
        const archivePath = resolvePath(args[1], env.cwd, env.user);
        if (env.files[parent(archivePath)]?.type !== 'dir') return fail(`tar: ${args[1]}: parent directory does not exist`);
        const entries = [];
        for (const item of args.slice(2)) {
          const source = resolvePath(item, env.cwd, env.user);
          if (env.files[source]?.type !== 'file') return fail(`tar: ${item}: Cannot stat: No such file`);
          entries.push({ path: source.replace(/^\//, ''), content: env.files[source].content, mode: env.files[source].mode || '0644' });
        }
        env.archives = { ...(env.archives || {}), [archivePath]: entries };
        env.files[archivePath] = { type: 'file', content: JSON.stringify(entries) };
        return ok(`a ${args[1]}`);
      }
      if (args[0] === '-tzf' && args.length === 2) {
        const path = resolvePath(args[1], env.cwd, env.user); const entries = env.archives?.[path];
        return entries ? ok(entries.map((entry) => entry.path).join('\n')) : fail(`tar: ${args[1]}: not a training archive`);
      }
      if (args[0] === '-xzf' && args.length === 4 && args[2] === '-C') {
        const archivePath = resolvePath(args[1], env.cwd, env.user); const target = resolvePath(args[3], env.cwd, env.user); const entries = env.archives?.[archivePath];
        if (!entries) return fail(`tar: ${args[1]}: not a training archive`);
        if (env.files[target]?.type !== 'dir') return fail(`tar: ${args[3]}: extraction directory does not exist`);
        for (const entry of entries) {
          const destination = resolvePath(`${target}/${entry.path}`);
          const pathParts = destination.split('/').filter(Boolean);
          for (let i = 1; i < pathParts.length; i += 1) { const dir = `/${pathParts.slice(0, i).join('/')}`; env.files[dir] ||= { type: 'dir' }; }
          env.files[destination] = { type: 'file', content: entry.content, mode: entry.mode };
        }
        return ok(`x ${args[1]}`);
      }
      return fail('tar: supported forms: tar -czf ARCHIVE FILE... | tar -tzf ARCHIVE | tar -xzf ARCHIVE -C DIRECTORY');
    }
    case 'sha256sum': {
      if (!args.length) return fail('sha256sum: missing file operand');
      const output = [];
      for (const item of args) {
        const path = resolvePath(item, env.cwd, env.user);
        const node = env.files[path];
        if (!node || node.type !== 'file') return fail(`sha256sum: ${item}: No such file`);
        const digest = createHash('sha256').update(env.archives?.[path] ? JSON.stringify(env.archives[path]) : node.content).digest('hex');
        output.push(`${digest}  ${item}`);
      }
      return ok(output.join('\n'));
    }
    case 'scp': {
      if (args.length !== 2) return fail('scp: usage: scp SOURCE USER@HOST:DESTINATION or scp USER@HOST:SOURCE DESTINATION');
      const sourceIsRemote = /^([^@]+)@([^:]+):(.+)$/.test(args[0]);
      const remoteMatch = (sourceIsRemote ? args[0] : args[1]).match(/^([^@]+)@([^:]+):(.+)$/);
      if (!remoteMatch) return fail('scp: expected USER@HOST:PATH');
      const [, user, host, remoteName] = remoteMatch;
      const remote = env.hosts?.[host];
      if (!remote || remote.user !== user || !env.hostFingerprints?.[host] || env.hostFingerprints[host] !== remote.fingerprint) return fail(`scp: cannot verify authorized training host ${host}`);
      let remotePath = resolvePath(remoteName, remote.cwd || `/home/${user}`, user);
      const localPath = resolvePath(sourceIsRemote ? args[1] : args[0], env.cwd, env.user);
      if (!sourceIsRemote && remote.files[remotePath]?.type === 'dir') remotePath = `${remotePath}/${localPath.split('/').pop()}`;
      if (sourceIsRemote && env.files[localPath]?.type === 'dir') remotePath = `${remotePath}/${localPath.split('/').pop()}`;
      if (!sourceIsRemote) {
        const node = env.files[localPath];
        if (!node || node.type !== 'file') return fail(`scp: ${args[0]}: No such file`);
        if (!remote.files[parent(remotePath)] || remote.files[parent(remotePath)].type !== 'dir') return fail('scp: destination directory does not exist on training host');
        remote.files[remotePath] = { ...node };
        if (env.archives?.[localPath]) remote.archives = { ...(remote.archives || {}), [remotePath]: structuredClone(env.archives[localPath]) };
      } else {
        const node = remote.files[remotePath];
        if (!node || node.type !== 'file') return fail(`scp: ${remoteName}: No such file on training host`);
        if (!env.files[parent(localPath)] || env.files[parent(localPath)].type !== 'dir') return fail('scp: local destination directory does not exist');
        env.files[localPath] = { ...node };
        if (remote.archives?.[remotePath]) env.archives = { ...(env.archives || {}), [localPath]: structuredClone(remote.archives[remotePath]) };
      }
      persistRemoteHost(env);
      return ok('');
    }
    case 'cp': case 'mv': {
      const invalid = rejectOption(cmd, args, []); if (invalid) return invalid;
      if (args.length !== 2) return fail(`${cmd}: usage: ${cmd} SOURCE DESTINATION`);
      const [from, to] = args.map((p) => resolvePath(p, env.cwd, env.user));
      const src = env.files[from]; if (!src) return fail(`${cmd}: cannot stat '${args[0]}': No such file`);
      if (!canTraversePath(env, from) || src.type === 'file' && !hasReadPermission(env, src, from)) return fail(`${cmd}: cannot access '${args[0]}': Permission denied`);
      if (src.type === 'dir' && cmd === 'cp') return fail('cp: directory copying is not supported in this training shell');
      const target = env.files[to]?.type === 'dir' ? `${to}/${from.split('/').pop()}` : to;
      if (!env.files[parent(target)] || env.files[parent(target)].type !== 'dir') return fail(`${cmd}: destination directory does not exist`);
      if (!canWriteInParent(env, target) || cmd === 'mv' && !canWriteInParent(env, from)) return fail(`${cmd}: Permission denied`);
      if (src.type === 'dir' && target.startsWith(`${from}/`)) return fail(`${cmd}: cannot move a folder into itself`);
      if (src.type === 'dir') {
        const moved = Object.keys(env.files).filter((key) => key === from || key.startsWith(`${from}/`)).sort((a, b) => a.length - b.length);
        moved.forEach((key) => { env.files[`${target}${key.slice(from.length)}`] = { ...env.files[key] }; });
        moved.reverse().forEach((key) => delete env.files[key]);
      } else {
        env.files[target] = { ...src, ...(cmd === 'cp' ? { owner: env.user, group: env.users?.[env.user]?.groups?.[0] || env.user } : {}) };
        if (cmd === 'mv') delete env.files[from];
      }
      return ok('');
    }
    case 'rm': {
      const invalid = rejectOption('rm', args, ['-r', '-rf', '-fr', '-f']); if (invalid) return invalid;
      const paths = args.filter((a) => !a.startsWith('-')); if (!paths.length) return fail('rm: missing operand');
      for (const p of paths) {
        const full = resolvePath(p, env.cwd, env.user);
        if (!env.files[full]) return fail(`rm: cannot remove '${p}': No such file`);
        if (env.files[full].type === 'dir' && !args.some((a) => a.includes('r'))) return fail(`rm: cannot remove '${p}': is a directory (use -r)`);
        if (!canWriteInParent(env, full) || env.files[full].type === 'dir' && !canTraversePath(env, full)) return fail(`rm: cannot remove '${p}': Permission denied`);
        const descendants = Object.keys(env.files).filter((key) => key === full || key.startsWith(`${full}/`));
        descendants.forEach((key) => delete env.files[key]);
      }
      return ok('');
    }
    case 'ps': { const invalid = rejectOption('ps', args, ['-a', '-u', '-x', '-e', '-f']); if (invalid) return invalid; if (args.some((a) => !a.startsWith('-') && a !== 'aux')) return fail(`ps: unsupported argument '${args.find((a) => !a.startsWith('-') && a !== 'aux')}'`); env.evidence = [...new Set([...(env.evidence || []), 'system:processes'])]; const rows = env.processes.map((p) => `${p.user.padEnd(8)} ${String(p.pid).padEnd(5)} ${String(p.cpu).padEnd(5)} ${String(p.mem).padEnd(5)} ${p.command}`); return ok(`${args.includes('aux') || optionSet(args).has('-u') || optionSet(args).has('-e') ? 'USER     PID   %CPU  %MEM  COMMAND\n' : '  PID TTY          TIME CMD\n'}${rows.join('\n')}`); }
    case 'top': { if (args.length) return fail('top: options are not supported by this training snapshot'); env.evidence = [...new Set([...(env.evidence || []), 'system:processes'])]; const rows = env.processes.map((p) => `${String(p.pid).padEnd(5)} ${p.user.padEnd(8)} ${String(p.cpu).padEnd(5)} ${String(p.mem).padEnd(5)} ${p.command}`).join('\n'); return ok(`top - training snapshot\nTasks: ${env.processes.length} total\nMiB Mem: ${env.memory.total} total, ${env.memory.free} free, ${env.memory.used} used\nPID   USER     %CPU  %MEM COMMAND\n${rows}`); }
    case 'df': { const invalid = rejectOption('df', args, ['-h']); if (invalid) return invalid; if (args.filter((a) => !a.startsWith('-')).length) return fail('df: this training command accepts no file arguments'); env.evidence = [...new Set([...(env.evidence || []), 'system:disk'])]; const used = Math.round(env.disk.used / env.disk.total * 100); return ok(`Filesystem      Size  Used Avail Use% Mounted on\ntraining-disk   ${env.disk.total}G  ${env.disk.used}G  ${env.disk.available}G  ${used}% /`); }
    case 'free': { const invalid = rejectOption('free', args, ['-h']); if (invalid) return invalid; if (args.filter((a) => !a.startsWith('-')).length) return fail('free: this training command accepts no arguments'); env.evidence = [...new Set([...(env.evidence || []), 'system:memory'])]; return ok(`              total        used        free\nMem:        ${env.memory.total}        ${env.memory.used}         ${env.memory.free}\nSwap:       1024         128         896`); }
    case 'lpinfo': {
      if (args.length !== 1 || args[0] !== '-v') return fail('lpinfo: supported form is lpinfo -v');
      env.evidence = [...new Set([...(env.evidence || []), 'printer:catalog'])];
      return ok((env.printerCatalog || []).map((printer) => `${printer.uri} ${printer.name}`).join('\n'));
    }
    case 'lpadmin': {
      if (!['training-admin','training administrator'].includes(env.role)) return fail('lpadmin: authorized training administrator role required');
      if (args.length !== 7 || args[0] !== '-p' || args[2] !== '-E' || args[3] !== '-v' || args[5] !== '-m' || args[6] !== 'everywhere') return fail('lpadmin: supported form: lpadmin -p NAME -E -v URI -m everywhere');
      const printer = (env.printerCatalog || []).find((item) => item.uri === args[4]);
      if (!printer) return fail('lpadmin: URI is not in the approved training printer catalog');
      env.printerQueues = { ...(env.printerQueues || {}), [args[1]]: { name: args[1], uri: printer.uri, enabled: true, state: 'idle' } };
      env.printJobs ||= [];
      return ok(`printer ${args[1]} configured and enabled`);
    }
    case 'lpstat': {
      if (!env.printerQueues) return fail('lpstat: no configured training queues');
      if (args[0] === '-p') return ok(Object.values(env.printerQueues).map((queue) => `printer ${queue.name} is ${queue.enabled ? 'idle. enabled' : 'disabled'}`).join('\n'));
      if (args[0] === '-o') return ok((env.printJobs || []).map((job) => `${job.queue}-${job.id} ${job.document} ${job.status}`).join('\n') || '');
      return fail('lpstat: supported forms are lpstat -p and lpstat -o');
    }
    case 'lp': {
      if (args.length !== 3 || args[0] !== '-d') return fail('lp: supported form is lp -d QUEUE FILE');
      const queue = env.printerQueues?.[args[1]];
      const filePath = resolvePath(args[2], env.cwd, env.user); const file = env.files[filePath];
      if (!queue?.enabled) return fail(`lp: destination ${args[1]} is not available`);
      if (!file || file.type !== 'file') return fail(`lp: ${args[2]}: No such file`);
      env.printJobs ||= [];
      const id = env.nextPrintJobId || 1001; env.nextPrintJobId = id + 1;
      const stuck = filePath.endsWith('/stuck-report.pdf');
      env.printJobs.push({ id, queue: queue.name, document: filePath.split('/').pop(), source: filePath, status: stuck ? 'stopped' : 'queued', reason: stuck ? 'paper-out training fixture' : null });
      return ok(`request id is ${queue.name}-${id} (1 file(s))`);
    }
    case 'cancel': {
      if (args.length !== 1) return fail('cancel: usage: cancel QUEUE-JOB-ID');
      const match = args[0].match(/^([a-z0-9_-]+)-(\d+)$/i);
      const job = match && env.printJobs?.find((item) => item.queue === match[1] && item.id === Number(match[2]));
      if (!job) return fail(`cancel: unknown training print job ${args[0]}`);
      if (job.status === 'cancelled') return fail(`cancel: job ${args[0]} is already cancelled`);
      job.status = 'cancelled'; return ok(`request ${args[0]} cancelled`);
    }
    case 'docker': {
      const containers = env.containers || [];
      if (args[0] === 'ps' && (args.length === 1 || args[1] === '-a')) {
        env.evidence = [...new Set([...(env.evidence || []), 'container:list'])];
        return ok(containers.filter((item) => args[1] === '-a' || item.status === 'running').map((item) => `${item.id} ${item.image} ${item.status} ${item.name}`).join('\n') || 'CONTAINER ID   IMAGE   STATUS   NAMES');
      }
      if (args[0] === 'images') return ok([...new Set(containers.map((item) => item.image))].join('\n'));
      if (['inspect','logs','restart','start','stop'].includes(args[0]) && args[1]) {
        const container = containers.find((item) => item.name === args[1] || item.id === args[1]);
        if (!container) return fail(`docker ${args[0]}: no such container: ${args[1]}`);
        if (args[0] === 'inspect') { env.evidence = [...new Set([...(env.evidence || []), `container:${container.name}`])]; return ok(JSON.stringify({ name: container.name, image: container.image, status: container.status, restartCount: container.restartCount })); }
        if (args[0] === 'logs') { env.evidence = [...new Set([...(env.evidence || []), `container-logs:${container.name}`])]; return ok(container.logs); }
        if (!['training-admin','training administrator'].includes(env.role)) return fail(`docker ${args[0]}: administrator role required in this training environment`);
        if (args[0] === 'restart' || args[0] === 'start') { container.status = 'running'; container.restartCount += 1; container.logs += `\n2026-11-22T10:00:00Z INFO ${args[0]} requested`; return ok(`${container.name} ${args[0]}ed`); }
        container.status = 'exited'; return ok(`${container.name} stopped`);
      }
      return fail('docker: supported forms: ps [-a], images, inspect NAME, logs NAME, restart NAME, start NAME, stop NAME');
    }
    case 'ddev': {
      const project = env.ddevProjects?.['api-sim'];
      if (args[0] === 'list' && args.length === 1) { env.evidence = [...new Set([...(env.evidence || []), 'ddev:list'])]; return ok(project ? `${project.name} ${project.status} ${project.url}` : 'No DDEV projects'); }
      if (['describe','logs'].includes(args[0]) && args[1] === 'api-sim') {
        if (!project) return fail(`ddev ${args[0]}: project api-sim not found`);
        if (args[0] === 'describe') { env.evidence = [...new Set([...(env.evidence || []), 'ddev:describe'])]; return ok(`name: ${project.name}\nstatus: ${project.status}\nprimary_url: ${project.url}\nrouter_https_port: ${project.port}`); }
        env.evidence = [...new Set([...(env.evidence || []), 'ddev:logs'])]; return ok(project.startupLog);
      }
      if (args[0] === 'config' && args[1] === '--router-https-port' && args.length === 3) {
        if (!['training-admin','training administrator'].includes(env.role)) return fail('ddev config: administrator role required in this training environment');
        if (!project || !/^\d{4,5}$/.test(args[2])) return fail('ddev config: expected a configured project and valid router port');
        project.port = Number(args[2]); project.status = 'configured'; return ok(`router HTTPS port set to ${project.port}`);
      }
      if (['start','stop','restart'].includes(args[0]) && args[1] === 'api-sim') {
        if (!['training-admin','training administrator'].includes(env.role)) return fail(`ddev ${args[0]}: administrator role required in this training environment`);
        if (!project) return fail(`ddev ${args[0]}: project api-sim not found`);
        if (args[0] === 'stop') project.status = 'stopped';
        else if (project.port === 443 && env.portOccupants?.[443] !== 'api-sim') return fail('ddev start: router port 443 is occupied by legacy-gateway');
        else { project.status = 'running'; project.url = `https://api.training.test:${project.port}`; env.endpoints[`${project.url}/health`] = { status: 200, body: JSON.stringify({ status: 'healthy', project: project.name, port: project.port }) }; }
        project.startupLog += `\n2026-11-22T10:00:00Z INFO ddev ${args[0]} ${project.status}`;
        env.evidence = [...new Set([...(env.evidence || []), `ddev:${args[0]}`])];
        return ok(`Project ${project.name} ${project.status}${project.status === 'running' ? ` at ${project.url}` : ''}`);
      }
      return fail('ddev: supported forms: list, describe api-sim, logs api-sim, config --router-https-port PORT, start|stop|restart api-sim');
    }
    case 'systemctl': {
      const action = args[0]; const name = args[1];
      if (!['status','restart','start','stop','reload'].includes(action)) return fail(`systemctl: unsupported action '${action || ''}'. Supported: status, start, stop, restart, reload.`);
      if (!name) return fail(`systemctl ${action}: missing service name`);
      if (args.length > 2) return fail(`systemctl: unsupported option '${args[2]}'`);
      const status = env.services[name]; if (!status) return fail(`Unit ${name}.service could not be found`);
      if (action === 'status') { env.evidence = [...new Set([...(env.evidence || []), `service:${name}`])]; return ok(`● ${name}.service - ${name} training service\n   Loaded: loaded (/etc/systemd/system/${name}.service; enabled)\n   Active: ${status}\n   Training note: simulated service status`); }
      if (!['training-admin','training administrator'].includes(env.role)) return fail(`systemctl ${action}: authorization required for this training service`);
      const next = action === 'stop' ? 'inactive (dead)' : 'active (running)';
      env.services[name] = next;
      if (name === 'training-site' && next === 'active (running)') {
        try {
          const settings = JSON.parse(env.files['/opt/training-site/config.json']?.content || '{}');
          if (settings.poolSize < 20) env.services[name] = 'failed (Result: connection pool exhausted)';
          env.endpoints = { ...(env.endpoints || {}), [settings.endpoint]: { status: settings.poolSize >= 20 ? 200 : 503, body: JSON.stringify({ httpStatus: settings.poolSize >= 20 ? 200 : 503, status: settings.poolSize >= 20 ? 'healthy' : 'unavailable', reason: settings.poolSize >= 20 ? 'ready' : 'connection pool exhausted' }) } };
        } catch { env.services[name] = 'failed (invalid configuration)'; }
      }
      if (name === 'training-api' && next === 'active (running)') {
        try {
          const config = JSON.parse(env.files['/opt/training-api/config.json']?.content || '{}');
          if (Number.isInteger(config.port)) env.endpoints = { ...(env.endpoints || {}), [`https://api.training.test:${config.port}${config.healthPath || '/health'}`]: { status: 200, body: JSON.stringify({ status: 'healthy', service: config.name || name }) } };
        } catch { env.services[name] = 'failed (invalid configuration)'; }
      }
      const logPath = name === 'training-api' ? '/var/log/training-api/app.log' : name === 'training-site' ? '/var/log/training/training-site.log' : '/var/log/training/system.log';
      const logLine = `2026-11-22T09:10:00Z INFO ${name} ${action} completed state=${env.services[name]}`;
      if (env.files[logPath]?.type === 'file') env.files[logPath].content += `\n${logLine}`;
      if (env.serviceLogs?.[name]) env.serviceLogs[name] += `\n${logLine}`;
      return env.services[name] === 'active (running)' ? ok(`${action} completed for ${name}; state=${env.services[name]}`) : fail(`${action} left ${name} in state ${env.services[name]}`);
    }
    case 'journalctl': { let service = ''; let count = 0; for (let i = 0; i < args.length; i++) { const flag = args[i]; if (flag === '-u') service = args[++i] || ''; else if (flag === '-n' || flag === '--lines') { if (!args[i + 1]) return fail(`journalctl: ${flag} needs a value`); count = Number(args[++i]); if (!Number.isInteger(count) || count < 1) return fail('journalctl: line count must be a positive whole number'); } else if (flag === '--no-pager') continue; else return fail(`journalctl: unsupported option '${flag}'`); } const file = service?.includes('payment') ? '/var/log/training/app.log' : '/var/log/training/system.log'; const content = env.serviceLogs?.[service] || env.files[file]?.content; if (!content) return fail(`journalctl: no training logs for ${service || 'system'}`); let lines = content.split('\n'); if (count) lines = lines.slice(-count); env.evidence = [...new Set([...(env.evidence || []), `logs:${service || 'system'}`])]; return ok(lines.join('\n')); }
    case 'curl': {
      const invalid = rejectOption('curl', args, ['-o', '--output']); if (invalid) return invalid;
      let output = null; const url = args.find((a) => /^https?:/.test(a));
      const oi = args.indexOf('-o'); if (oi >= 0) output = args[oi + 1];
      else if (args.includes('--output')) output = args[args.indexOf('--output') + 1];
      if ((oi >= 0 || args.includes('--output')) && !output) return fail('curl: output option needs a file name');
      if (!url) return fail('curl: missing URL');
      let body = null;
      if (env.network && env.endpoints?.[url]) body = env.endpoints[url].body;
      else if (url.startsWith('https://api.training.test:')) {
        const config = env.files['/opt/training-api/config.json'];
        try {
          const settings = JSON.parse(config?.content || '{}');
          const configuredUrl = `https://api.training.test:${settings.port}${settings.healthPath || '/health'}`;
          if (url === configuredUrl && env.services?.['training-api'] === 'active (running)') body = JSON.stringify({ status: 'healthy', service: settings.name || 'training-api' });
          else if (url === configuredUrl) body = JSON.stringify({ status: 'unavailable', service: settings.name || 'training-api' });
          else if (url === 'https://api.training.test:443/health') body = '{"status":"not_found","message":"No training route on this port"}';
        } catch { return fail('curl: training API configuration is invalid'); }
      } else body = env.endpoints?.[url]?.body || null;
      if (!body) body = url.endsWith('/health') ? '{\n  "status": "degraded",\n  "service": "training-app",\n  "database": "ok",\n  "paymentWorker": "timeout"\n}' : url.endsWith('/metrics') ? '{\n  "cpu": 6.2,\n  "memoryPercent": 85,\n  "diskPercent": 86\n}' : null;
      if (!body) return fail(`curl: could not resolve host in training sandbox: ${url}`);
      env.evidence = [...new Set([...(env.evidence || []), `endpoint:${url}`])];
      if (env.network && env.endpoints?.[url]) {
        const match = url.match(/:(\d+)(?:\/|$)/);
        env.network.endpointChecks = [...(env.network.endpointChecks || []), { url, port: match ? Number(match[1]) : null, status: env.endpoints[url].status }];
      }
      if (output) {
        const path = resolvePath(output, env.cwd, env.user);
        if (!env.files[parent(path)] || env.files[parent(path)].type !== 'dir') return fail(`curl: cannot write '${output}': parent directory does not exist`);
        env.files[path] = { type: 'file', content: body };
        return ok(`Saved simulated response from ${url} to ${output}`);
      }
      return ok(body);
    }
    case 'help': { const examples = { pwd: 'pwd - print your current directory', ls: 'ls [-la] [PATH] - list files and folders', cd: 'cd [PATH] - change directory; cd - returns to the previous directory', mkdir: 'mkdir [-p] PATH - create a folder', touch: 'touch FILE - create an empty file', cat: 'cat [-n] FILE - read a file', echo: 'echo TEXT - print text', printf: 'printf FORMAT [VALUE...] - format text', head: 'head [-n COUNT] FILE - show the first lines', tail: 'tail [-n COUNT] FILE - show the last lines', grep: 'grep [-icnv] PATTERN [FILE...] - search matching lines', find: 'find PATH -name NAME - search file names', wc: 'wc [-lwc] FILE - count lines, words, or bytes', sort: 'sort [-ru] FILE - order file lines', uniq: 'uniq FILE - remove adjacent duplicate lines', cp: 'cp SOURCE DESTINATION - copy a file', mv: 'mv SOURCE DESTINATION - move a file', rm: 'rm [-r] PATH - remove a file or folder', tree: 'tree [PATH] - show a directory tree', file: 'file PATH - identify a file type', du: 'du [PATH] - show simulated disk usage', lpinfo: 'lpinfo -v - list fictional printers', lpadmin: 'lpadmin -p NAME -E -v URI -m everywhere - configure an approved training printer', lpstat: 'lpstat -p or lpstat -o - inspect queues and jobs', lp: 'lp -d QUEUE FILE - queue a simulated print job', cancel: 'cancel QUEUE-JOB-ID - cancel a simulated print job', whoami: 'whoami - show the current user', hostname: 'hostname - show the computer name', ssh: 'ssh USER@HOST - connect to a fictional training host', exit: 'exit - return from an SSH training session', ip: 'ip addr or ip route - inspect training network state', getent: 'getent hosts NAME - query training DNS', ss: 'ss -ltn - inspect training TCP listeners', uname: 'uname [-a|-r] - show kernel information', date: 'date - show the training system clock', which: 'which COMMAND - locate a simulated command', man: 'man COMMAND - read a short manual page', less: 'less FILE - read a text file', more: 'more FILE - read a text file', ps: 'ps aux - list simulated processes', top: 'top - show a simulated resource snapshot', df: 'df -h - show disk usage', free: 'free -h - show memory usage', systemctl: 'systemctl status SERVICE or restart SERVICE - inspect or change an authorized training service', jq: 'jq [-r] .KEY FILE - validate JSON and read a top-level value', editor: 'editor set FILE .KEY VALUE - set one top-level value in a training JSON file', journalctl: 'journalctl [-u SERVICE] [-n COUNT] - inspect simulated logs', curl: 'curl [-o FILE] URL - fetch fictional training data', history: 'history - show commands from this session', clear: 'clear - clear terminal output' }; if (env.disablePrinterCommands) ['lpinfo', 'lpadmin', 'lpstat', 'lp', 'cancel'].forEach((name) => delete examples[name]); if (args[0]) return examples[args[0]] ? ok(examples[args[0]]) : fail(`help: no training command named '${args[0]}'`); return ok(`Available: ${Object.keys(examples).join(' ')}\nUse Tab to complete a command or file name. This Ubuntu shell runs on fictional training data.`); }
    default: return fail(`command not found: ${cmd}. This is a training shell; type help to see supported commands.`);
  }
}

function commandResult(env, stdout, stderr, exitCode, cwdBefore, extra = {}) {
  const context = env.commandContext || {};
  const result = { stdout, stderr, exitCode, output: stdout || stderr, error: exitCode !== 0, cwdBefore, cwdAfter: env.cwd, hostBefore: context.hostBefore || env.host, hostAfter: env.host, userBefore: context.userBefore || env.user, userAfter: env.user, env, ...extra };
  delete env.commandContext;
  return result;
}

function syntaxError(env, message, cwdBefore) {
  return commandResult(env, '', `syntax error: ${message}`, 2, cwdBefore);
}

export function executeCommand(env, raw, history = []) {
  Object.assign(env, normalizeEnvironment(env));
  const cwdBefore = env.cwd;
  env.commandContext = { hostBefore: env.host, userBefore: env.user };
  const command = String(raw ?? '').trim();
  if (env.initialSetup && !env.interactivePrompt) return commandResult(env, '', 'First-run admin setup is unavailable. Reload the computer to restart setup.', 1, cwdBefore);
  if (env.loginScreen && !env.interactivePrompt) {
    const recovery = command.match(/^recovery\s+([a-z_][a-z0-9_-]{0,31})$/);
    if (recovery) {
      const username = recovery[1];
      if (!env.adminUsers?.includes(username) || !env.users?.[username]) {
        return commandResult(env, '', 'Recovery mode is available only for an administrator account on this computer.', 1, cwdBefore);
      }
      env.interactivePrompt = { kind: 'password', operation: 'account-recovery', username, step: 'new' };
      return commandResult(env, `Ubuntu recovery mode: set a new password for ${username}.`, '', 0, cwdBefore);
    }
    const username = command;
    const account = env.users?.[username];
    if (!username || !account) return commandResult(env, '', 'Login incorrect. Enter an account name to try again:', 1, cwdBefore, { loginInput: true });
    if (!account.passwordHash) {
      env.interactivePrompt = { kind: 'password', operation: 'initial-password', username, step: 'new' };
      return commandResult(env, `Set a password for ${username}:`, '', 0, cwdBefore, { loginInput: true });
    }
    env.interactivePrompt = { kind: 'password', operation: 'login', username };
    return commandResult(env, 'Password:', '', 0, cwdBefore, { loginInput: true });
  }
  if (env.interactivePrompt?.kind === 'password') {
    if (command === 'cancel') {
      const canceledPrompt = env.interactivePrompt;
      if (canceledPrompt?.operation === 'first-admin-password') {
        env.interactivePrompt = { ...canceledPrompt, step: 'new' };
        return commandResult(env, '^C\nSetup is not complete. Set a password for the admin account to continue.', '', 130, cwdBefore);
      }
      delete env.interactivePrompt;
      if (canceledPrompt?.operation === 'adduser') return commandResult(env, `^C\nAccount setup for '${canceledPrompt.username}' canceled. No account was created.`, '', 130, cwdBefore);
      return commandResult(env, '^C\nPassword operation canceled.', '', 130, cwdBefore);
    }
    const prompt = env.interactivePrompt;
    if (['adduser', 'passwd', 'initial-password', 'first-user-password', 'first-admin-password', 'account-recovery'].includes(prompt.operation) && prompt.step === 'new') {
      if (command.length < 8 || command.length > 128) return commandResult(env, '', 'Password must be at least 8 characters and no more than 128 characters. Try again:', 1, cwdBefore, { secretInput: true });
      const salt = randomBytes(16).toString('hex');
      env.interactivePrompt = { ...prompt, step: 'confirm', passwordSalt: salt, passwordHash: scryptSync(command, salt, 32).toString('hex') };
      return commandResult(env, '', 'Retype the new password:', 0, cwdBefore, { secretInput: true });
    }
    if (['adduser', 'passwd', 'initial-password', 'first-user-password', 'first-admin-password', 'account-recovery'].includes(prompt.operation) && prompt.step === 'confirm') {
      const actual = Buffer.from(scryptSync(command, prompt.passwordSalt, 32).toString('hex'), 'hex');
      const expected = Buffer.from(prompt.passwordHash, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        env.interactivePrompt = { kind: 'password', operation: prompt.operation, username: prompt.username, step: 'new' };
        return commandResult(env, '', 'Passwords do not match. Enter a new password:', 1, cwdBefore, { secretInput: true });
      }
      const username = prompt.username;
      if (prompt.operation === 'account-recovery') {
        if (!env.adminUsers?.includes(username) || !env.users?.[username]) {
          delete env.interactivePrompt;
          return commandResult(env, '', 'Recovery failed: the administrator account is unavailable.', 1, cwdBefore, { secretInput: true });
        }
        env.users[username].passwordSalt = prompt.passwordSalt;
        env.users[username].passwordHash = prompt.passwordHash;
        delete env.interactivePrompt;
        return commandResult(env, `Administrator password reset for ${username}. Sign in with the new password.`, '', 0, cwdBefore, { secretInput: true });
      }
      if (prompt.operation === 'passwd' || prompt.operation === 'initial-password') {
        env.users[username].passwordSalt = prompt.passwordSalt;
        env.users[username].passwordHash = prompt.passwordHash;
        delete env.interactivePrompt;
        const message = prompt.operation === 'initial-password'
          ? `Administrator password created for ${username}. Sign in with the new password.`
          : `Password updated successfully for ${username}.`;
        return commandResult(env, message, '', 0, cwdBefore, { secretInput: true });
      }
      if (prompt.operation === 'first-user-password') {
        env.users = { [username]: { uid: 1000, groups: [username, 'sudo'], passwordSalt: prompt.passwordSalt, passwordHash: prompt.passwordHash } };
        env.groups = [...new Set([...(env.groups || []), username, 'sudo'])];
        env.adminUsers = [username];
        env.role = 'training-admin';
        env.user = username;
        env.cwd = `/home/${username}`;
        env.oldpwd = env.cwd;
        env.loggedIn = false;
        env.loginScreen = true;
        env.initialSetup = false;
        env.files = Object.fromEntries(Object.entries(env.files || {}).filter(([path]) => !path.startsWith('/home/')));
        env.files['/home'] = { type: 'dir' };
        env.files[env.cwd] = { type: 'dir', owner: username, group: username, mode: '0700' };
        for (const folder of ['Desktop', 'Documents', 'Downloads', 'Projects']) {
          env.files[`${env.cwd}/${folder}`] = { type: 'dir', owner: username, group: username, mode: '0755' };
        }
        delete env.interactivePrompt;
        return commandResult(env, `Ubuntu setup complete. Administrator account '${username}' created. Returning to the login screen...`, '', 0, cwdBefore, { secretInput: true });
      }
      if (prompt.operation === 'first-admin-password') {
        const username = 'admin';
        env.users = { ...(env.users || {}), [username]: { uid: 1000, groups: ['admin', 'sudo'], passwordSalt: prompt.passwordSalt, passwordHash: prompt.passwordHash } };
        env.groups = [...new Set([...(env.groups || []), 'admin', 'sudo'])];
        env.adminUsers = ['admin'];
        env.role = 'training-admin';
        env.user = username;
        env.cwd = `/home/${username}`;
        env.oldpwd = env.cwd;
        env.loggedIn = false;
        env.loginScreen = true;
        env.initialSetup = false;
        env.files = Object.fromEntries(Object.entries(env.files || {}).filter(([path]) => !path.startsWith('/home/')));
        env.files['/home'] = { type: 'dir' };
        env.files[env.cwd] = { type: 'dir', owner: username, group: username, mode: '0700' };
        for (const folder of ['Desktop', 'Documents', 'Downloads', 'Projects']) {
          env.files[`${env.cwd}/${folder}`] = { type: 'dir', owner: username, group: username, mode: '0755' };
        }
        delete env.interactivePrompt;
        return commandResult(env, 'Ubuntu setup complete. The admin account is ready. Returning to the login screen...', '', 0, cwdBefore, { secretInput: true });
      }
      const home = `/home/${username}`;
      env.users ||= {};
      const highestUid = Math.max(1000, ...Object.values(env.users).map((account) => Number(account.uid) || 0));
      env.users[username] = { uid: highestUid + 1, groups: [username], passwordSalt: prompt.passwordSalt, passwordHash: prompt.passwordHash };
      env.groups = [...new Set([...(env.groups || []), username])];
      for (const path of [home, `${home}/Desktop`, `${home}/Documents`, `${home}/Downloads`, `${home}/Projects`]) env.files[path] = { type: 'dir', owner: username, group: username, mode: path === home ? '0700' : '0755' };
      env.files[`${home}/readme.txt`] = { type: 'file', content: `Welcome, ${username}. This is your Ubuntu training home directory.\n`, owner: username, group: username, mode: '0644' };
      delete env.interactivePrompt;
      return commandResult(env, `Adding user '${username}' ...\nAdding new group '${username}' (${env.users[username].uid}) ...\nCreating home directory '${home}' ...\nUser '${username}' added successfully.\nThe administrator session remains signed in as ${env.user}. Use 'logout' to return to the account chooser, or 'su - ${username}' to switch temporarily.`, '', 0, cwdBefore, { secretInput: true });
    }
    if (prompt.operation === 'sudo-adduser') {
      const account = env.users?.[prompt.username];
      if (!account?.passwordSalt || !account?.passwordHash) {
        delete env.interactivePrompt;
        return commandResult(env, '', `sudo: no login password is set for ${prompt.username}. Run passwd and try again.`, 1, cwdBefore, { secretInput: true });
      }
      const actual = Buffer.from(scryptSync(command, account?.passwordSalt || '', 32).toString('hex'), 'hex');
      const expected = Buffer.from(account?.passwordHash || '', 'hex');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        const attempts = (prompt.attempts || 0) + 1;
        if (attempts >= 3) {
          delete env.interactivePrompt;
          return commandResult(env, '', 'sudo: 3 incorrect password attempts. Account setup was not started.', 1, cwdBefore, { secretInput: true });
        }
        env.interactivePrompt = { ...prompt, attempts };
        return commandResult(env, '', `Authentication failed for ${prompt.username}. Enter the same password used to sign in. Attempt ${attempts} of 3.\n[sudo] password for ${prompt.username}:`, 1, cwdBefore, { secretInput: true });
      }
      const parsed = tokenize(prompt.command);
      if (parsed.error) {
        delete env.interactivePrompt;
        return commandResult(env, '', `sudo: ${parsed.error}`, 2, cwdBefore, { secretInput: true });
      }
      env.sudoContext = true;
      let result;
      try {
        result = runOne(env, parsed.tokens, '');
      } finally {
        delete env.sudoContext;
      }
      if (result.error) delete env.interactivePrompt;
      return commandResult(env, result.output, result.error ? result.output : '', result.error ? 1 : 0, cwdBefore, { secretInput: true });
    }
    if (prompt.operation === 'su') {
      const account = env.users?.[prompt.username];
      const actual = Buffer.from(scryptSync(command, account?.passwordSalt || '', 32).toString('hex'), 'hex');
      const expected = Buffer.from(account?.passwordHash || '', 'hex');
      const authenticated = expected.length === actual.length && timingSafeEqual(expected, actual);
      delete env.interactivePrompt;
      if (!authenticated) return commandResult(env, '', `su: Authentication failure for ${prompt.username}`, 1, cwdBefore, { secretInput: true });
      env.userSession = { user: env.user, cwd: env.cwd, oldpwd: env.oldpwd, role: env.role };
      env.user = prompt.username;
      env.role = 'user';
      env.oldpwd = env.cwd;
      env.cwd = `/home/${prompt.username}`;
      return commandResult(env, `Welcome to Ubuntu 24.04.2 LTS, ${prompt.username}.\nType 'exit' to return to ${env.userSession.user}.`, '', 0, cwdBefore, { secretInput: true });
    }
    if (prompt.operation === 'login') {
      const account = env.users?.[prompt.username];
      const actual = Buffer.from(scryptSync(command, account?.passwordSalt || '', 32).toString('hex'), 'hex');
      const expected = Buffer.from(account?.passwordHash || '', 'hex');
      const authenticated = expected.length === actual.length && timingSafeEqual(expected, actual);
      if (!authenticated) {
        env.interactivePrompt = { kind: 'password', operation: 'login', username: prompt.username };
        return commandResult(env, '', 'Login incorrect. Try the password again, or go back to choose another account.', 1, cwdBefore, { secretInput: true });
      }
      delete env.interactivePrompt;
      env.user = prompt.username;
      env.role = env.adminUsers?.includes(prompt.username) ? 'training-admin' : 'user';
      env.loggedIn = true;
      env.loginScreen = false;
      env.oldpwd = `/home/${prompt.username}`;
      env.cwd = env.oldpwd;
      return commandResult(env, `Welcome to Ubuntu 24.04.2 LTS, ${prompt.username}.\nLast login: today on tty1`, '', 0, cwdBefore, { secretInput: true });
    }
  }
  if (env.interactivePrompt?.kind === 'editor') {
    const prompt = env.interactivePrompt;
    const editorInput = String(raw ?? '');
    if (command === ':q!' || command === ':qa!') {
      delete env.interactivePrompt;
      return commandResult(env, 'Vim: changes discarded.', '', 0, cwdBefore);
    }
    if (command === ':w' || command === ':wq' || command === ':x') {
      const oldNode = env.files[prompt.path];
      env.files[prompt.path] = {
        ...(oldNode || {}), type: 'file', content: prompt.content,
        owner: oldNode?.owner || env.user, group: oldNode?.group || env.user,
        mode: oldNode?.mode || '0644', modifiedAt: '2025-04-12',
      };
      if (command !== ':w') delete env.interactivePrompt;
      return commandResult(env, `"${prompt.path}" ${prompt.content.split('\n').length} lines written.`, '', 0, cwdBefore, { filesystemChanged: true });
    }
    if (command === ':q') return commandResult(env, 'Use :q! to discard changes, or :wq to save and quit.', '', 1, cwdBefore);
    prompt.content += `${prompt.content ? '\n' : ''}${editorInput}`;
    return commandResult(env, '', '', 0, cwdBefore, { editorInput: true });
  }
  if (!command) return commandResult(env, '', '', 0, cwdBefore);
  if (command === 'clear') return commandResult(env, '', '', 0, cwdBefore, { clear: true });
  if (command === 'history') return commandResult(env, history.map((item, i) => ` ${String(i + 1).padStart(4)}  ${item}`).join('\n'), '', 0, cwdBefore);
  if (/^dashboard(?:\s|$)/.test(command)) {
    const response = executeMonitoringCommand(env, command);
    return commandResult(env, response.stdout, response.stderr, response.exitCode, cwdBefore);
  }
  if (/^incident(?:\s|$)/.test(command)) {
    const response = executeIncidentCommand(env, command);
    return commandResult(env, response.stdout, response.stderr, response.exitCode, cwdBefore);
  }
  if (/^(?:trace|routing|proxy)(?:\s|$)/.test(command)) {
    const response = executeRequestLabCommand(env, command);
    return commandResult(env, response.stdout, response.stderr, response.exitCode, cwdBefore);
  }
  if (/^security(?:\s|$)/.test(command)) {
    const response = executeSecurityCommand(env, command);
    return commandResult(env, response.stdout, response.stderr, response.exitCode, cwdBefore);
  }
  if (/^(?:release|scale|rollout)(?:\s|$)/.test(command)) {
    const response = executeDeploymentCommand(env, command);
    return commandResult(env, response.stdout, response.stderr, response.exitCode, cwdBefore);
  }

  if (command === 'help vim' || command === 'help vi') {
    return commandResult(env, 'vim FILE — open a practice text editor. Enter one line at a time; use :wq to save and quit, or :q! to discard.', '', 0, cwdBefore);
  }
  if (/^(?:vim|vi)(?:\s|$)/.test(command)) {
    const parsed = tokenize(command);
    if (parsed.error) return syntaxError(env, parsed.error, cwdBefore);
    if (parsed.tokens.length !== 2 || !parsed.tokens[1] || parsed.tokens[1].startsWith('-')) {
      return commandResult(env, '', 'usage: vim FILE (enter text one line at a time; use :wq to save and quit, or :q! to discard)', 2, cwdBefore);
    }
    const path = resolvePath(parsed.tokens[1], env.cwd, env.user);
    const node = env.files[path];
    if (node?.type === 'dir') return commandResult(env, '', `vim: '${parsed.tokens[1]}' is a directory`, 1, cwdBefore);
    if (!canTraversePath(env, parent(path)) || !canWriteInParent(env, path) || node && (!hasPermission(env, node, 0b100) || !hasPermission(env, node, 0b010))) {
      return commandResult(env, '', `vim: cannot open '${parsed.tokens[1]}': Permission denied`, 1, cwdBefore);
    }
    env.interactivePrompt = {
      kind: 'editor', operation: 'vim', path,
      content: node?.type === 'file' ? node.content || '' : '',
    };
    return commandResult(env, `"${path}" ${node ? `${(node.content || '').split('\n').length} lines` : '[New File]'}\n-- INSERT MODE -- Enter text one line at a time. :wq saves and quits; :q! discards changes.`, '', 0, cwdBefore);
  }

  const executable = command.match(/^\.\/([^\s]+)$/);
  if (executable) {
    const path = resolvePath(executable[0], env.cwd, env.user); const node = env.files[path];
    if (!node || node.type !== 'file') return commandResult(env, '', `bash: ${executable[0]}: No such file`, 127, cwdBefore);
    if ((Number.parseInt(node.mode || '0644', 8) & 0o111) === 0) return commandResult(env, '', `bash: ${executable[0]}: Permission denied`, 126, cwdBefore);
    const result = runOne(env, ['bash', path]);
    return commandResult(env, result.error ? '' : result.output, result.error ? result.output.replace(/^âœ–\s*/, '') : '', result.error ? 1 : 0, cwdBefore);
  }

  const clockAdvance = command.match(/^training-clock\s+advance\s+(\d+)(m|h|d)$/);
  if (clockAdvance) {
    if (!env.trainingClock) return commandResult(env, '', 'training-clock: no simulated clock is configured for this lesson', 1, cwdBefore);
    const oldTime = Date.parse(env.trainingClock);
    const factor = { m: 60_000, h: 3_600_000, d: 86_400_000 }[clockAdvance[2]];
    const newTime = oldTime + Number(clockAdvance[1]) * factor;
    if (!Number.isFinite(oldTime) || !Number.isFinite(newTime) || newTime - oldTime > 7 * 86_400_000) return commandResult(env, '', 'training-clock: advance must be at most seven days', 2, cwdBefore);
    env.trainingClock = new Date(newTime).toISOString();
    const schedule = env.schedule;
    if (schedule) {
      const [minute, hour] = schedule.expression.split(' ').map(Number);
      const offset = schedule.timezone === 'Asia/Manila' ? 8 : 0;
      for (let time = Math.ceil(oldTime / 60_000) * 60_000; time <= newTime; time += 60_000) {
        const local = new Date(time + offset * 3_600_000);
        if (local.getUTCMinutes() !== minute || local.getUTCHours() !== hour) continue;
        const result = runOne(env, ['bash', schedule.script]);
        if (result.error) return commandResult(env, '', String(result.output).replace(/^âœ–\s*/, ''), 1, cwdBefore);
        env.files['/home/learner/daily-report.txt'] = { type: 'file', content: result.output };
        schedule.runs.push({ time: new Date(time).toISOString(), report: '/home/learner/daily-report.txt' });
      }
    }
    return commandResult(env, `Training clock: ${env.trainingClock}${env.schedule?.runs?.length ? `\nScheduled report runs: ${env.schedule.runs.length}` : ''}`, '', 0, cwdBefore);
  }

  // A small, stateful PostgreSQL-like practice database. This parser is
  // deliberately separate from the host filesystem and LinuxLab's own DB.
  if (env.databaseSession) {
    const db = env.practiceDatabases?.[env.databaseSession.database];
    if (/^\\q\s*$/.test(command)) {
      env.databaseSession = null;
      return commandResult(env, 'Leaving database session.', '', 0, cwdBefore);
    }
    if (/^\\dt\s*$/.test(command)) {
      const names = Object.keys(db?.tables || {});
      return commandResult(env, names.length ? ` public | ${names.join(', ')}` : 'Did not find any relations.', '', 0, cwdBefore);
    }
    if (/^\\conninfo\s*$/.test(command)) return commandResult(env, `You are connected to database \"${db?.name || env.databaseSession.database}\" as user \"${env.databaseSession.user}\" on host \"${env.databaseSession.host}\".`, '', 0, cwdBefore);
    const describe = command.match(/^\\d\s+([a-z_][a-z0-9_]*)\s*$/i);
    if (describe) {
      const table = db?.tables?.[describe[1]];
      return table ? commandResult(env, `Table: ${describe[1]}\n${table.columns.map((column) => `${column.name} | ${column.type}`).join('\n')}`, '', 0, cwdBefore)
        : commandResult(env, '', `relation \"${describe[1]}\" does not exist`, 1, cwdBefore);
    }
    const create = command.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\((.+)\)\s*;?$/is);
    if (create) {
      const columns = create[2].split(',').map((part) => { const match = part.trim().match(/^([a-z_][a-z0-9_]*)\s+(text|integer|timestamp)$/i); return match && { name: match[1], type: match[2].toLowerCase() }; });
      if (columns.some((column) => !column) || !columns.length) return commandResult(env, '', 'syntax error: supported column types are text, integer, timestamp', 1, cwdBefore);
      db.tables[create[1]] ||= { columns, rows: [] };
      return commandResult(env, 'CREATE TABLE', '', 0, cwdBefore);
    }
    const insert = command.match(/^insert\s+into\s+([a-z_][a-z0-9_]*)\s*\(([^)]+)\)\s*values\s*(.+);?$/is);
    if (insert) {
      const table = db?.tables?.[insert[1]];
      if (!table) return commandResult(env, '', `relation \"${insert[1]}\" does not exist`, 1, cwdBefore);
      const columns = insert[2].split(',').map((name) => name.trim());
      const tuples = [...insert[3].matchAll(/\(([^()]*)\)/g)];
      if (!tuples.length) return commandResult(env, '', 'syntax error: expected VALUES (...)', 1, cwdBefore);
      for (const tuple of tuples) {
        const values = [...tuple[1].matchAll(/'((?:[^']|'')*)'|(-?\d+)/g)].map((match) => match[1] !== undefined ? match[1].replaceAll("''", "'") : Number(match[2]));
        if (values.length !== columns.length || columns.some((name) => !table.columns.some((column) => column.name === name))) return commandResult(env, '', 'column/value count mismatch', 1, cwdBefore);
        table.rows.push(Object.fromEntries(columns.map((name, index) => [name, values[index]])));
      }
      return commandResult(env, `INSERT 0 ${tuples.length}`, '', 0, cwdBefore);
    }
    const select = command.match(/^select\s+(.+?)\s+from\s+([a-z_][a-z0-9_]*)(?:\s+where\s+([a-z_][a-z0-9_]*)\s*=\s*('(?:[^']|'')*'|-?\d+))?\s*;?$/is);
    if (select) {
      const table = db?.tables?.[select[2]];
      if (!table) return commandResult(env, '', `relation \"${select[2]}\" does not exist`, 1, cwdBefore);
      const rows = table.rows.filter((row) => !select[3] || String(row[select[3]]) === select[4].replace(/^'|'$/g, '').replaceAll("''", "'"));
      if (/^count\s*\(\s*\*\s*\)$/i.test(select[1])) return commandResult(env, `count\n${rows.length}`, '', 0, cwdBefore, { rows });
      const columns = select[1].trim() === '*' ? table.columns.map((column) => column.name) : select[1].split(',').map((name) => name.trim());
      if (columns.some((name) => !table.columns.some((column) => column.name === name))) return commandResult(env, '', 'column does not exist', 1, cwdBefore);
      return commandResult(env, [columns.join(' | '), ...rows.map((row) => columns.map((name) => row[name] ?? '').join(' | '))].join('\n'), '', 0, cwdBefore, { rows });
    }
    return commandResult(env, '', 'syntax error: supported statements are CREATE TABLE, INSERT, SELECT, \\conninfo, \\dt, \\d, and \\q', 2, cwdBefore);
  }

  if (/^psql(?:\s|$)/i.test(command)) {
    if (!env.databaseConfig) return commandResult(env, '', 'psql: no practice database is configured for this lesson', 1, cwdBefore);
    const args = command.match(/(?:"[^"]*"|'[^']*'|\S+)/g) || [];
    const optionValue = (option) => args[args.indexOf(option) + 1]?.replace(/^['"]|['"]$/g, '');
    const expected = env.databaseConfig;
    if (optionValue('-h') !== expected.host || optionValue('-p') !== String(expected.port) || optionValue('-U') !== expected.user || args.at(-1)?.replace(/^['"]|['"]$/g, '') !== expected.database) return commandResult(env, '', 'psql: connection failed: verify host, port, user, and database from the connection note', 1, cwdBefore);
    if (!env.practiceDatabases) env.practiceDatabases = {};
    const database = env.databaseConfig.database;
    env.practiceDatabases[database] ||= { tables: {} };
    env.databaseSession = { database, user: env.databaseConfig.user, host: env.databaseConfig.host };
    return commandResult(env, `Connected to database \"${database}\" as user \"${env.databaseSession.user}\".`, '', 0, cwdBefore, { databaseSession: env.databaseSession });
  }

  const parsed = tokenize(command);
  if (parsed.error) return syntaxError(env, parsed.error, cwdBefore);
  const stages = [[]];
  let redirection = null;
  for (let index = 0; index < parsed.tokens.length; index += 1) {
    const token = parsed.tokens[index];
    if (token === '|') {
      if (!stages.at(-1).length || index === parsed.tokens.length - 1) return syntaxError(env, 'missing command around pipe', cwdBefore);
      stages.push([]);
    } else if (token === '>' || token === '>>') {
      if (redirection) return syntaxError(env, 'only one output redirection is supported', cwdBefore);
      const target = parsed.tokens[index + 1];
      if (!target || target === '|' || target === '>' || target === '>>') return syntaxError(env, 'output redirection requires a target file', cwdBefore);
      if (index + 2 < parsed.tokens.length) return syntaxError(env, 'output redirection must appear at the end of the command', cwdBefore);
      if (!stages.at(-1).length) return syntaxError(env, 'output redirection requires a command', cwdBefore);
      redirection = { operator: token, target };
      index += 1;
    } else stages.at(-1).push(token);
  }
  if (stages.some((stage) => !stage.length)) return syntaxError(env, 'expected a command', cwdBefore);
  if (redirection) {
    const targetPath = resolvePath(redirection.target, env.cwd, env.user);
    if (env.files[parent(targetPath)]?.type !== 'dir') return commandResult(env, '', `shell: cannot write '${redirection.target}': parent directory does not exist`, 1, cwdBefore);
    if (env.files[targetPath]?.type === 'dir') return commandResult(env, '', `shell: cannot write '${redirection.target}': is a directory`, 1, cwdBefore);
  }

  let piped = '';
  let stderr = '';
  let exitCode = 0;
  for (const stage of stages) {
    const result = runOne(env, stage, piped);
    const output = String(result.output ?? '');
    const noMatches = stage[0] === 'grep' && result.error && (result.noMatches || output.startsWith('✖ grep: no lines matched'));
    if (result.error && !noMatches) stderr = [stderr, output.replace(/^✖\s*/, '')].filter(Boolean).join('\n');
    piped = result.noMatches ? output : result.error ? '' : output;
    const message = output.replace(/^✖\s*/, '');
    exitCode = noMatches ? 1 : !result.error ? 0 : message.startsWith('command not found:') ? 127 : stage[0] === 'grep' || message.includes('unsupported option') ? 2 : 1;
  }

  if (redirection && exitCode === 0) {
    const path = resolvePath(redirection.target, env.cwd, env.user);
    const oldContent = redirection.operator === '>>' ? (env.files[path]?.content || '') : '';
    env.files[path] = { type: 'file', content: `${oldContent}${piped}` };
    piped = '';
  }
  persistRemoteHost(env);
  return commandResult(env, piped, stderr, exitCode, cwdBefore);
}

export function getNode(env, path) { return env.files[resolvePath(path, env.cwd, env.user)]; }
export function pathExists(env, path, type) { const node = getNode(env, path); return !!node && (!type || node.type === type); }
