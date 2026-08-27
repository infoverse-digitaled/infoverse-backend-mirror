import { Router } from 'express';
import {
  startTrial,
  verifyTrial,
  getPricing,
  initializePayment,
  verifyPayment,
  getPlans,
  cancelUserSubscription,
} from '../controllers/paymentController';
import { handleWebhook } from '../controllers/webhookController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Subscription plans, trial management, Paystack payment flow, and webhooks
 */

// Public routes

/**
 * @swagger
 * /payment/pricing:
 *   get:
 *     summary: Get pricing information for all subscription plans
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Pricing details returned successfully
 */
router.get('/pricing', getPricing);

/**
 * @swagger
 * /payment/plans:
 *   get:
 *     summary: Get available plan codes based on Paystack mode (test/live)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Plan codes returned successfully
 */
router.get('/plans', getPlans);

/**
 * @swagger
 * /payment/webhook:
 *   post:
 *     summary: Paystack webhook handler (called by Paystack, not the client)
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             event: charge.success
 *             data:
 *               reference: abc123
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook', handleWebhook);

// Protected routes

/**
 * @swagger
 * /payment/start-trial:
 *   post:
 *     summary: Start a 7-day free trial for the authenticated user
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial started successfully
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Trial already started or user already subscribed
 */
router.post('/start-trial', authenticateJWT, startTrial);

/**
 * @swagger
 * /payment/verify-trial:
 *   post:
 *     summary: Verify and activate a trial for the authenticated user
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial verified and activated
 *       401:
 *         description: Not authenticated
 */
router.post('/verify-trial', authenticateJWT, verifyTrial);

/**
 * @swagger
 * /payment/initialize:
 *   post:
 *     summary: Initialize a Paystack payment session
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             planCode: PLN_abc123
 *     responses:
 *       200:
 *         description: Payment session initialized, returns authorization URL
 *       401:
 *         description: Not authenticated
 */
router.post('/initialize', authenticateJWT, initializePayment);

/**
 * @swagger
 * /payment/verify:
 *   post:
 *     summary: Verify a Paystack payment after redirect
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             reference: TXN_abc123
 *     responses:
 *       200:
 *         description: Payment verified and subscription activated
 *       400:
 *         description: Payment verification failed
 *       401:
 *         description: Not authenticated
 */
router.post('/verify', authenticateJWT, verifyPayment);

/**
 * @swagger
 * /payment/cancel:
 *   post:
 *     summary: Cancel the current user's subscription
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/cancel', authenticateJWT, cancelUserSubscription);

export default router;
