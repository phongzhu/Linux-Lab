import { createPublicClient } from '../config/database.js';
import * as service from '../services/progressService.js';

export async function getProgress(req, res) {
  res.json({ progress: await service.getProgress(createPublicClient(req.accessToken), req.user.id) });
}

export async function resetProgress(req, res) {
  res.json({ progress: await service.resetProgress(createPublicClient(req.accessToken)) });
}
