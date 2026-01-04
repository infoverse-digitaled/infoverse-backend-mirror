import { Router } from 'express';
import { startTrial, verifyTrial, getPricing, initializePayment, verifyPayment } from '../controllers/paymentController';
import { handleWebhook } from '../controllers/webhookController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/pricing', getPricing);
router.post('/webhook', handleWebhook);

// Protected routes
router.post('/start-trial', authenticateJWT, startTrial);
router.post('/verify-trial', authenticateJWT, verifyTrial);
router.post('/initialize', authenticateJWT, initializePayment);
router.post('/verify', authenticateJWT, verifyPayment);

export default router;
