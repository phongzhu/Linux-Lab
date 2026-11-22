import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/freeTerminalController.js';

const router = Router();
router.use(requireAuth);
router.get('/workspace', asyncHandler(controller.workspace));
router.post('/command', asyncHandler(controller.command));
export default router;
