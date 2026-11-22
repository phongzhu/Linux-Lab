import * as service from '../services/attemptService.js';
import { requireString, requireTimezone } from '../middleware/validate.middleware.js';

export async function listActive(req, res) { res.json({ attempts: await service.listActive(req.accessToken, req.user.id) }); }
export async function start(req, res) {
  const lessonId = requireString(req.body.lessonId, 'Lesson id', { max: 40 });
  const timezone = requireTimezone(req.body.timezone || req.session.auth.timezone);
  res.status(201).json(await service.start(req.accessToken, req.user.id, lessonId, timezone));
}
export async function get(req, res) { res.json(await service.get(req.accessToken, req.user.id, req.params.attemptId)); }
export async function restart(req, res) { res.json(await service.restart(req.accessToken, req.user.id, req.params.attemptId)); }
export async function command(req, res) {
  const commandText = requireString(req.body.command, 'Command', { max: 256 });
  res.json(await service.submitCommand(req.accessToken, req.user.id, req.params.attemptId, commandText));
}
