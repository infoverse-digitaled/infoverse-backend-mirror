import { Router } from 'express';
import { startTrial, verifyTrial } from '../controllers/paymentController';
import { handleWebhook } from '../controllers/webhookController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protected routes
router.post('/start-trial', authenticateJWT, startTrial);
router.post('/verify-trial', authenticateJWT, verifyTrial);

// Public route for Paystack
router.post('/webhook', handleWebhook);

export default router;
