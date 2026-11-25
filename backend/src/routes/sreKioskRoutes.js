import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/sreKioskController.js';

const router = Router();
router.use(requireAuth);
router.get('/workspace', asyncHandler(controller.workspace));
router.post('/action', asyncHandler(controller.action));
router.get('/workbook.xlsx', asyncHandler(controller.workbook));
export default router;
