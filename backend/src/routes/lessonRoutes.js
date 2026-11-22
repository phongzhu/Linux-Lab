import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/lessonController.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(controller.listUnits));
router.get('/:lessonId', asyncHandler(controller.getLesson));
export default router;
