import { requireString } from '../middleware/validate.middleware.js';
import { executeFreeCommand, getFreeWorkspace } from '../services/freeTerminalService.js';

export async function workspace(req, res) {
  const value = getFreeWorkspace(req.session, req.user.id);
  res.json({ workspace: { state: value.state, commands: value.commands }, files: value.files });
}

export async function command(req, res) {
  const commandText = requireString(req.body.command, 'Command', { max: 256 });
  getFreeWorkspace(req.session, req.user.id);
  const result = executeFreeCommand(req.session.freeTerminal, commandText);
  res.json({ ...result, entry: result.entry });
}
