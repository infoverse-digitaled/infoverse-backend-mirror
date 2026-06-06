import { Router } from 'express';
import { startTrial, verifyTrial, getPricing, initializePayment, verifyPayment, getPlans, cancelUserSubscription } from '../controllers/paymentController';
import { handleWebhook } from '../controllers/webhookController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/pricing', getPricing);
router.get('/plans', getPlans);  // Returns plan codes based on Paystack mode (test/live)
router.post('/webhook', handleWebhook);

// Protected routes
router.post('/start-trial', authenticateJWT, startTrial);
router.post('/verify-trial', authenticateJWT, verifyTrial);
router.post('/initialize', authenticateJWT, initializePayment);
router.post('/verify', authenticateJWT, verifyPayment);
router.post('/cancel', authenticateJWT, cancelUserSubscription);

export default router;
