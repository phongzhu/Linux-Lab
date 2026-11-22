import * as service from '../services/lessonService.js';
import { createPublicClient } from '../config/database.js';
import AppError from '../middleware/AppError.js';

export async function listUnits(req, res) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to view the learning path.');
  res.json(await service.getUnits(createPublicClient(req.accessToken)));
}

export async function getLesson(req, res) {
  res.json({ lesson: await service.getLesson(createPublicClient(req.accessToken), req.params.lessonId) });
}
