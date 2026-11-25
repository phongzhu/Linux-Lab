import { createEnvironment, executeCommand } from '../simulation/executor.js';
import { createPublicClient } from '../config/database.js';
import AppError from '../middleware/AppError.js';

const documentTypes = [
  ['meeting-notes', 'Meeting notes'], ['project-brief', 'Project brief'], ['invoice', 'Invoice'],
  ['support-ticket', 'Support ticket'], ['onboarding-guide', 'Onboarding guide'],
  ['maintenance-log', 'Maintenance log'], ['research-summary', 'Research summary'],
  ['training-checklist', 'Training checklist'], ['release-notes', 'Release notes'],
  ['travel-request', 'Travel request'],
];
const authors = ['Ari Santos', 'Mika Reyes', 'Noah Cruz', 'Sam Lee', 'Jamie Rivera'];
const subjects = ['Ubuntu workstation rollout', 'Quarterly access review', 'Help desk response plan', 'Internal tools refresh', 'Learning lab schedule', 'Document archive cleanup', 'Printer maintenance window', 'Service handoff checklist'];
const workspaceVersion = 12;

function makeDocument(index) {
  const [slug, label] = documentTypes[(index - 1) % documentTypes.length];
  const author = authors[(index - 1) % authors.length];
  const subject = subjects[(index * 3 - 1) % subjects.length];
  const sequence = String(index).padStart(4, '0');
  const filename = `${slug}-${sequence}.txt`;
  const department = ['Operations', 'People team', 'IT support', 'Finance', 'Learning services'][(index - 1) % 5];
  const status = ['Draft', 'Reviewed', 'Filed', 'In progress'][(index - 1) % 4];
  const priority = ['Routine', 'Normal', 'Time-sensitive'][(index - 1) % 3];
  const reference = `LAB-${String(2400 + index)}`;
  const content = `${label} ${sequence}\n${'='.repeat(label.length + sequence.length + 1)}\n\nDocument record\n  Reference: ${reference}\n  Department: ${department}\n  Owner: ${author}\n  Status: ${status}\n  Priority: ${priority}\n  Updated: 2025-${String(((index - 1) % 12) + 1).padStart(2, '0')}-${String(((index * 7 - 1) % 28) + 1).padStart(2, '0')}\n\nSubject\n  ${subject}\n\nSummary\n  This fictional ${label.toLowerCase()} records the current ${subject.toLowerCase()} work item for the LinuxLab practice archive. The record is sample data created for learning file navigation and text-search commands.\n\nFollow-up\n  Review the information with the responsible team, note any changes in the appropriate workspace, and retain the reference ${reference} when sharing an update. No real person, account, invoice, or service is represented by this sample.\n\nTags: ${slug}, archive, training, ${department.toLowerCase().replaceAll(' ', '-')}\n`;
  return [`/home/learner/Documents/${filename}`, { type: 'file', content, owner: 'learner', group: 'learners', mode: '0644', modifiedAt: `2025-${String(((index - 1) % 12) + 1).padStart(2, '0')}-${String(((index * 7 - 1) % 28) + 1).padStart(2, '0')}` }];
}

export function createFreeTerminalWorkspace() {
  const environment = createEnvironment();
  environment.cwd = '/home/learner';
  const extraDirectories = [
    '/home/learner/Documents', '/home/learner/Documents/Archive', '/home/learner/Documents/Finance',
    '/home/learner/Documents/Operations', '/home/learner/Documents/Policies', '/home/learner/Documents/Reports',
    '/home/learner/Downloads', '/home/learner/Desktop', '/home/learner/Shared', '/home/learner/Pictures', '/home/learner/Videos',
  ];
  extraDirectories.forEach((path) => { environment.files[path] = { type: 'dir' }; });
  const seededFiles = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => makeDocument(index + 1)));
  for (let index = 0; index < 100; index += 1) {
    const [path, node] = makeDocument(2001 + index);
    const format = ['txt', 'csv', 'json', 'md', 'log'][index % 5];
    const downloadPath = path.replace('/Documents/', '/Downloads/').replace(/\.txt$/, `.${format}`);
    if (format === 'csv') node.content = `reference,owner,status,subject\n${node.content.split('\n').filter((line) => /Reference:|Owner:|Status:|Subject/.test(line)).join(',')}\n`;
    if (format === 'json') node.content = `${JSON.stringify({ name: path.split('/').at(-1).replace('.txt', ''), reference: `DL-${2001 + index}`, status: ['ready', 'review', 'filed'][index % 3], trainingData: true, summary: node.content.slice(0, 240) }, null, 2)}\n`;
    if (format === 'md') node.content = `# Downloaded training note ${2001 + index}\n\n${node.content}`;
    if (format === 'log') node.content = `2025-04-10 09:00:00 INFO downloaded sample record\n2025-04-10 09:00:12 INFO archive checksum verified\n2025-04-10 09:01:02 ${index % 4 === 0 ? 'WARN review requested' : 'INFO record filed'}\n`;
    seededFiles[downloadPath] = node;
  }
  for (let index = 0; index < 48; index += 1) {
    const [path, node] = makeDocument(2201 + index);
    seededFiles[path.replace('/Documents/', '/projects/')] = node;
  }
  const archiveFolders = ['Archive', 'Finance', 'Operations', 'Policies', 'Reports'];
  archiveFolders.forEach((folder, folderIndex) => {
    for (let index = 0; index < 20; index += 1) {
      const [path, node] = makeDocument(2301 + folderIndex * 20 + index);
      seededFiles[path.replace('/Documents/', `/Documents/${folder}/`)] = node;
    }
  });
  const extraTextFiles = {
    '/home/learner/Desktop/Welcome-to-LinuxLab.txt': 'Welcome to LinuxLab. Open Documents to browse the training archive, then use the terminal to practice commands against this fictional workspace.\n',
    '/home/learner/Shared/printer-connection.txt': 'Office printer: office_printer\nProtocol: IPP\nTraining URI: ipp://printer.training.test/ipp/print\nConnect with lpadmin, then inspect queues with lpstat.\n',
    '/home/learner/Shared/archive-index.csv': 'folder,description,items\nDocuments,General training records,1000\nDownloads,Sample downloaded records,100\nprojects,Project workspace,49\n',
    '/home/learner/projects/README.md': '# Learner Projects\n\nThis folder contains fictional project records. Use ls, find, grep, cat, and wc to explore the sample files.\n',
    '/home/learner/projects/project-plan.md': '# Project plan\n\n## Goal\nOrganize the support archive and prepare a clear handoff.\n\n## Milestones\n- Inventory documents\n- Verify report references\n- Share the final handoff\n',
    '/home/learner/projects/config.json': '{\n  "workspace": "linuxlab-projects",\n  "environment": "training",\n  "archivePath": "/home/learner/Documents",\n  "owner": "learner"\n}\n',
    '/home/learner/projects/tasks.csv': 'id,task,status,owner\n1,Review archive,in progress,Ari Santos\n2,Check printer queue,open,Mika Reyes\n3,Prepare handoff,planned,Noah Cruz\n',
  };
  for (const [path, content] of Object.entries(extraTextFiles)) seededFiles[path] = { type: 'file', content, owner: 'learner', group: 'learners', mode: '0644' };
  environment.files = { ...environment.files, ...seededFiles };
  environment.files = Object.fromEntries(Object.entries(environment.files).map(([path, node]) => [
    path.replace(/^\/home\/learner(?=\/|$)/, '/home/admin'),
    { ...node, ...(node.owner === 'learner' ? { owner: 'admin' } : {}), ...(node.group === 'learners' ? { group: 'admins' } : {}) },
  ]));
  for (const path of Object.keys(environment.files)) if (path.startsWith('/home/')) delete environment.files[path];
  environment.files['/home'] = { type: 'dir' };
  environment.user = 'root';
  environment.cwd = '/';
  environment.oldpwd = '/';
  environment.loggedIn = false;
  environment.loginScreen = false;
  environment.initialSetup = true;
  environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
  environment.role = 'training-admin';
  environment.users = {};
  environment.adminUsers = [];
  environment.disablePrinterCommands = true;
  return { environment, commands: [], ownerId: null, version: workspaceVersion, firstInstallPending: true };
}

function listHomeEntries(environment) {
  const root = `/home/${environment.user || 'learner'}/`;
  return Object.entries(environment.files)
    .filter(([path]) => path.startsWith(root) && path.slice(root.length).split('/').length <= 2)
    .map(([path, node]) => ({
      name: path.slice(path.lastIndexOf('/') + 1),
      path,
      type: node.type,
      size: node.type === 'file' ? node.content.length : null,
      modifiedAt: node.modifiedAt || null,
      extension: node.type === 'file' ? path.slice(path.lastIndexOf('.') + 1).toUpperCase() : null,
    }))
    .sort((left, right) => Number(right.type === 'dir') - Number(left.type === 'dir') || left.name.localeCompare(right.name));
}

export function getFreeWorkspace(session, userId) {
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 5) {
    const environment = session.freeTerminal.environment;
    environment.user = 'admin';
    environment.role = 'training-admin';
    environment.loggedIn = true;
    environment.loginScreen = false;
    environment.cwd = '/home/admin';
    environment.oldpwd = '/home/admin';
    delete environment.userSession;
    delete environment.interactivePrompt;
    session.freeTerminal.version = 6;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 6) {
    session.freeTerminal.commands = [];
    session.freeTerminal.version = 7;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 7) {
    session.freeTerminal.environment.disablePrinterCommands = true;
    session.freeTerminal.commands = [];
    session.freeTerminal.version = 8;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 8) {
    const environment = session.freeTerminal.environment;
    environment.users ||= {};
    environment.users.admin ||= { uid: 1000, groups: ['admins', 'sudo'] };
    delete environment.users.admin.passwordSalt;
    delete environment.users.admin.passwordHash;
    environment.adminUsers = ['admin'];
    environment.user = 'admin';
    environment.cwd = '/home/admin';
    environment.oldpwd = '/home/admin';
    environment.loggedIn = false;
    environment.loginScreen = true;
    delete environment.userSession;
    delete environment.interactivePrompt;
    delete environment.sudoContext;
    session.freeTerminal.commands = [];
    session.freeTerminal.accountsLoaded = false;
    session.freeTerminal.version = 9;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 9) {
    const environment = session.freeTerminal.environment;
    environment.user = 'root';
    environment.cwd = '/';
    environment.oldpwd = '/';
    environment.users = {};
    environment.adminUsers = [];
    environment.loggedIn = false;
    environment.loginScreen = false;
    environment.initialSetup = true;
    environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
    environment.role = 'training-admin';
    delete environment.userSession;
    delete environment.interactivePrompt;
    delete environment.sudoContext;
    session.freeTerminal.commands = [];
    session.freeTerminal.accountsLoaded = false;
    session.freeTerminal.firstInstallPending = true;
    session.freeTerminal.version = workspaceVersion;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 10) {
    const environment = session.freeTerminal.environment;
    for (const username of Object.keys(environment.users || {})) {
      ensureAccountHome(session.freeTerminal.environment, username);
    }
    if (environment.initialSetup && !Object.keys(environment.users || {}).length) {
      environment.user = 'root';
      environment.cwd = '/';
      environment.oldpwd = '/';
      environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
    }
    session.freeTerminal.version = workspaceVersion;
  }
  if (session.freeTerminal?.ownerId === userId && session.freeTerminal.version === 11) {
    const environment = session.freeTerminal.environment;
    if (environment.initialSetup && !Object.keys(environment.users || {}).length) {
      environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
    }
    session.freeTerminal.version = workspaceVersion;
  }
  if (!session.freeTerminal || session.freeTerminal.ownerId !== userId || session.freeTerminal.version !== workspaceVersion) {
    session.freeTerminal = { ...createFreeTerminalWorkspace(), ownerId: userId };
  }
  const { environment, commands } = session.freeTerminal;
  // Recover an adduser prompt if a prior request crashed after sudoContext was set.
  if (environment.sudoContext && !environment.interactivePrompt) {
    const lastCommand = commands.at(-1)?.command || '';
    if (/^sudo adduser [a-z_][a-z0-9_-]{0,31}$/.test(lastCommand)) {
      environment.interactivePrompt = {
        kind: 'password', operation: 'sudo-adduser', username: environment.user, command: lastCommand,
      };
    }
    delete environment.sudoContext;
  }
  return { state: environment, commands, files: environment.loginScreen || environment.initialSetup ? [] : listHomeEntries(environment) };
}

function ensureAccountHome(environment, username) {
  const home = `/home/${username}`;
  environment.files[home] = {
    ...(environment.files[home]?.type === 'dir' ? environment.files[home] : {}),
    type: 'dir', owner: username, group: username, mode: '0700',
  };
  for (const path of [home, `${home}/Desktop`, `${home}/Documents`, `${home}/Downloads`, `${home}/Projects`]) {
    environment.files[path] ||= { type: 'dir', owner: username, group: username, mode: path === home ? '0700' : '0755' };
  }
}

export function accountSnapshot(environment) {
  return JSON.stringify(Object.entries(environment.users || {}).sort(([left], [right]) => left.localeCompare(right)).map(([username, account]) => [
    username, account.uid, account.groups || [], account.passwordSalt || null, account.passwordHash || null,
  ]));
}

function accountStorageError(error, action) {
  console.error(`Terminal account ${action} failed:`, error);
  const failure = new AppError(503, 'TERMINAL_ACCOUNT_STORAGE_UNAVAILABLE', `Could not ${action} Ubuntu accounts in Supabase. Apply the LinuxLab terminal accounts migration to this app's Supabase project and retry.`);
  failure.expose = true;
  return failure;
}

export async function loadPersistedTerminalAccounts(workspace, userId, accessToken) {
  if (workspace.accountsLoaded) return;
  const client = createPublicClient(accessToken);
  const { data, error } = await client.from('linuxlab_terminal_accounts')
    .select('username, uid, groups, password_salt, password_hash')
    .eq('app_user_id', userId);
  // Keep older deployments usable while the account table migration is being applied.
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    workspace.accountsLoaded = true;
    return;
  }
  if (error) throw accountStorageError(error, 'load');

  const environment = workspace.environment;
  environment.users ||= {};
  const persistedUsernames = new Set((data || []).map((row) => row.username));
  const accounts = (data || []).filter((row) => row.password_salt && row.password_hash);
  environment.groups = [...new Set(accounts.flatMap((row) => row.groups || []))];
  for (const row of accounts) {
    environment.users[row.username] = {
      uid: row.uid,
      groups: row.groups || [row.username],
      passwordSalt: row.password_salt,
      passwordHash: row.password_hash,
    };
    ensureAccountHome(environment, row.username);
  }
  if (workspace.firstInstallPending && accounts.length) {
    environment.initialSetup = false;
    environment.loginScreen = true;
    environment.loggedIn = false;
    delete environment.interactivePrompt;
    environment.adminUsers = accounts.filter((row) => (row.groups || []).includes('sudo')).map((row) => row.username);
    environment.user = environment.adminUsers[0] || accounts[0].username;
    environment.role = environment.adminUsers.includes(environment.user) ? 'training-admin' : 'user';
    environment.cwd = `/home/${environment.user}`;
    environment.oldpwd = environment.cwd;
  } else if (workspace.firstInstallPending) {
    for (const path of Object.keys(environment.files)) if (path.startsWith('/home/')) delete environment.files[path];
    environment.files['/home'] = { type: 'dir' };
    environment.users = {};
    environment.adminUsers = [];
    environment.initialSetup = true;
    environment.loginScreen = false;
    environment.loggedIn = false;
    environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
    environment.user = 'root';
    environment.cwd = '/';
    environment.oldpwd = '/';
  }
  if (!workspace.firstInstallPending && Object.keys(environment.users).some((username) => !persistedUsernames.has(username))) {
    await persistTerminalAccounts(workspace, userId, accessToken);
  }
  delete workspace.firstInstallPending;
  workspace.accountsLoaded = true;
}

export async function persistTerminalAccounts(workspace, userId, accessToken) {
  const rows = Object.entries(workspace.environment.users || {}).map(([username, account]) => ({
    app_user_id: userId,
    username,
    uid: account.uid,
    groups: account.groups || [username],
    password_salt: account.passwordSalt || null,
    password_hash: account.passwordHash || null,
  }));
  const client = createPublicClient(accessToken);
  const { error } = await client.from('linuxlab_terminal_accounts').upsert(rows, { onConflict: 'app_user_id,username' });
  if (error) {
    workspace.accountsLoaded = false;
    throw accountStorageError(error, 'save');
  }
}

export function getPublicTerminalState(environment, { includeFiles = true } = {}) {
  const users = Object.fromEntries(Object.entries(environment.users || {}).map(([username, account]) => {
    const { passwordHash, passwordSalt, ...publicAccount } = account;
    return [username, publicAccount];
  }));
  const { files: privateFiles, ...publicEnvironment } = environment;
  const publicFiles = includeFiles && !environment.loginScreen && !environment.initialSetup
    ? Object.fromEntries(Object.entries(privateFiles || {}).map(([path, node]) => [path, {
      type: node.type,
      ...(node.owner ? { owner: node.owner } : {}),
      ...(node.group ? { group: node.group } : {}),
      ...(node.mode ? { mode: node.mode } : {}),
      ...(node.type === 'file' ? { size: node.content?.length || 0 } : {}),
      ...(node.modifiedAt ? { modifiedAt: node.modifiedAt } : {}),
    }]))
    : undefined;
  const prompt = environment.interactivePrompt;
  return {
    ...publicEnvironment,
    ...(environment.loginScreen || environment.initialSetup ? { files: {} } : includeFiles ? { files: publicFiles } : {}),
    users,
    ...(prompt ? { interactivePrompt: { kind: prompt.kind, operation: prompt.operation, username: prompt.username, step: prompt.step, attempts: prompt.attempts || 0 } } : {}),
  };
}

export function getTerminalFile(environment, path) {
  if (environment.loginScreen || !environment.loggedIn) throw new AppError(403, 'TERMINAL_LOGGED_OUT', 'Sign in to this computer to open files.');
  const home = `/home/${environment.user}/`;
  if (!path.startsWith(home)) throw new AppError(404, 'TERMINAL_FILE_NOT_FOUND', 'That file is not in this account.');
  const node = environment.files[path];
  if (!node || node.type !== 'file') throw new AppError(404, 'TERMINAL_FILE_NOT_FOUND', 'That file could not be found.');
  return {
    file: {
      path,
      content: node.content || '',
      size: node.content?.length || 0,
      modifiedAt: node.modifiedAt || null,
      owner: node.owner || environment.user,
      mode: node.mode || '0644',
    },
  };
}

export function executeFreeCommand(workspace, command) {
  const env = workspace.environment;
  const wasLoggedIn = env.loggedIn;
  const wasInitialSetup = env.initialSetup;
  const previousUser = env.user;
  const firstBootUsername = Boolean(env.initialSetup && !env.interactivePrompt);
  const hiddenInput = env.interactivePrompt?.kind === 'password';
  const editorInput = env.interactivePrompt?.kind === 'editor';
  const loginInput = Boolean(env.loginScreen && !hiddenInput);
  const result = executeCommand(env, command, workspace.commands.map((entry) => entry.command));
  const successfulLogin = !wasLoggedIn && env.loggedIn;
  const setupActivated = wasInitialSetup && !env.initialSetup && env.loginScreen;
  if (command.trim() === 'logout' && result.exitCode === 0) workspace.commands = [];
  const entry = {
    id: `${Date.now()}-${workspace.commands.length}`,
    command: hiddenInput || result.secretInput ? '••••••••' : command,
    passwordInput: hiddenInput || Boolean(result.secretInput),
    editorInput: Boolean(result.editorInput || editorInput),
    loginInput,
    firstBootUsername,
    cwdBefore: result.cwdBefore,
    cwdAfter: result.cwdAfter,
    hostBefore: result.hostBefore,
    hostAfter: result.hostAfter,
    userBefore: result.userBefore,
    userAfter: result.userAfter,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
  if (successfulLogin || setupActivated || wasInitialSetup) workspace.commands = [];
  if (!successfulLogin && !setupActivated) workspace.commands.push(entry);
  workspace.commands = workspace.commands.slice(-150);
  const filesystemCommand = /^(?:mkdir|touch|rm|mv|cp|editor|bash|tar)\b|>/.test(command.trim());
  const identityChanged = previousUser !== env.user || wasLoggedIn !== env.loggedIn;
  const refreshFiles = filesystemCommand || Boolean(result.filesystemChanged) || identityChanged;
  return {
    entry,
    state: env,
    commands: workspace.commands,
    ...(refreshFiles ? { files: env.loginScreen ? [] : listHomeEntries(env) } : {}),
  };
}
