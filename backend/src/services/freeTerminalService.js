import { createEnvironment, executeCommand } from '../simulation/executor.js';

const documentTypes = [
  ['meeting-notes', 'Meeting notes'], ['project-brief', 'Project brief'], ['invoice', 'Invoice'],
  ['support-ticket', 'Support ticket'], ['onboarding-guide', 'Onboarding guide'],
  ['maintenance-log', 'Maintenance log'], ['research-summary', 'Research summary'],
  ['training-checklist', 'Training checklist'], ['release-notes', 'Release notes'],
  ['travel-request', 'Travel request'],
];
const authors = ['Ari Santos', 'Mika Reyes', 'Noah Cruz', 'Sam Lee', 'Jamie Rivera'];
const subjects = ['Ubuntu workstation rollout', 'Quarterly access review', 'Help desk response plan', 'Internal tools refresh', 'Learning lab schedule', 'Document archive cleanup', 'Printer maintenance window', 'Service handoff checklist'];
const workspaceVersion = 4;

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
  environment.role = 'training-admin';
  environment.printerCatalog = [{ name: 'LinuxLab Office Printer', uri: 'ipp://printer.training.test/ipp/print' }];
  environment.printerQueues = {};
  environment.printJobs = [];
  environment.nextPrintJobId = 1001;
  return { environment, commands: [], ownerId: null, version: workspaceVersion };
}

function listHomeEntries(environment) {
  const root = '/home/learner/';
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
  if (!session.freeTerminal || session.freeTerminal.ownerId !== userId || session.freeTerminal.version !== workspaceVersion) {
    session.freeTerminal = { ...createFreeTerminalWorkspace(), ownerId: userId };
  }
  const { environment, commands } = session.freeTerminal;
  return { state: environment, commands, files: listHomeEntries(environment) };
}

export function executeFreeCommand(workspace, command) {
  const env = workspace.environment;
  const result = executeCommand(env, command, workspace.commands.map((entry) => entry.command));
  const entry = {
    id: `${Date.now()}-${workspace.commands.length}`,
    command,
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
  workspace.commands.push(entry);
  workspace.commands = workspace.commands.slice(-150);
  return { entry, state: env, commands: workspace.commands, files: listHomeEntries(env) };
}
