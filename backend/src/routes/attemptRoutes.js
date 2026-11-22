import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/attemptController.js';

const router = Router();
router.use(requireAuth);
router.get('/active', asyncHandler(controller.listActive));
router.post('/', asyncHandler(controller.start));
router.get('/:attemptId', asyncHandler(controller.get));
router.post('/:attemptId/commands', asyncHandler(controller.command));
router.post('/:attemptId/restart', asyncHandler(controller.restart));
export default router;
