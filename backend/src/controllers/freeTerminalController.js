import { requireString } from '../middleware/validate.middleware.js';
import { accountSnapshot, executeFreeCommand, getFreeWorkspace, getPublicTerminalState, getTerminalFile, loadPersistedTerminalAccounts, persistTerminalAccounts } from '../services/freeTerminalService.js';

export async function workspace(req, res) {
  getFreeWorkspace(req.session, req.user.id);
  await loadPersistedTerminalAccounts(req.session.freeTerminal, req.user.id, req.accessToken);
  const environment = req.session.freeTerminal.environment;
  if (environment.initialSetup) {
    req.session.freeTerminal.commands = [];
    if (environment.interactivePrompt?.operation === 'first-admin-password' && environment.interactivePrompt.step === 'confirm') {
      environment.interactivePrompt = { kind: 'password', operation: 'first-admin-password', username: 'admin', step: 'new' };
    }
  }
  if (!environment.initialSetup && environment.loggedIn) {
    environment.loggedIn = false;
    environment.loginScreen = true;
    delete environment.userSession;
    delete environment.interactivePrompt;
    req.session.freeTerminal.commands = [];
  }
  const value = getFreeWorkspace(req.session, req.user.id);
  res.json({ workspace: { state: getPublicTerminalState(value.state), commands: value.commands }, files: value.files });
}

export async function command(req, res) {
  const commandText = requireString(req.body.command, 'Command', { max: 256 });
  getFreeWorkspace(req.session, req.user.id);
  await loadPersistedTerminalAccounts(req.session.freeTerminal, req.user.id, req.accessToken);
  const priorAccounts = accountSnapshot(req.session.freeTerminal.environment);
  const result = executeFreeCommand(req.session.freeTerminal, commandText);
  if (accountSnapshot(result.state) !== priorAccounts) {
    await persistTerminalAccounts(req.session.freeTerminal, req.user.id, req.accessToken);
  }
  res.json({ ...result, state: getPublicTerminalState(result.state, { includeFiles: Boolean(result.files) }), entry: result.entry });
}

export function file(req, res) {
  const path = requireString(req.query.path, 'File path', { max: 1024 });
  const workspace = getFreeWorkspace(req.session, req.user.id);
  res.json(getTerminalFile(workspace.state, path));
}
