import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/progressController.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(controller.getProgress));
router.post('/reset', asyncHandler(controller.resetProgress));
export default router;
