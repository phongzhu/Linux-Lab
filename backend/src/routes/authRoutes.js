import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as controller from '../controllers/authController.js';

const router = Router();
router.post('/register', asyncHandler(controller.register));
router.post('/verify-signup', asyncHandler(controller.verifySignup));
router.post('/resend-signup-code', asyncHandler(controller.resendSignupCode));
router.post('/login', asyncHandler(controller.login));
router.post('/logout', requireAuth, asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));
export default router;
