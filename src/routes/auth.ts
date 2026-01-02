/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

import { Router } from 'express';
import { register, login, forgotPassword, resetPassword, getMe, completeOnboarding, updateProfile, changePassword } from '../controllers/authController';
import {
  loginValidationRules,
  signupValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  onboardingValidationRules,
  updateProfileValidationRules,
  changePasswordValidationRules,
} from '../middleware/validators/authValidators';
import validateRequest from '../middleware/validators/validateRequest';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticateJWT } from '../middleware/authMiddleware';
import config from '../config';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/test:
 *   post:
 *     summary: Test route (for sanity checks)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Returns ok
 */
router.post('/test', (_req, res) => res.json({ ok: true }));

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: John Doe
 *             email: john@example.com
 *             password: strongpassword123#
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already in use
 */
router.post('/register', authLimiter, signupValidationRules, validateRequest, register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: john@example.com
 *             password: strongpassword123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, loginValidationRules, validateRequest, login);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request a password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: john@example.com
 *     responses:
 *       200:
 *         description: If a user with that email exists, a password reset token has been sent.
 */
router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidationRules,
  validateRequest,
  forgotPassword);
/**
 * @swagger
 * /api/v1/auth/reset-password/{token}:
 *   patch:
 *     summary: Reset the password
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: The password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             password: newStrongPassword123
 *     responses:
 *       200:
 *         description: Password has been reset successfully.
 *       400:
 *         description: Token is invalid or has expired.
 */
router.patch(
  '/reset-password/:token',
  authLimiter,
  resetPasswordValidationRules,
  validateRequest,
  resetPassword);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       401:
 *         description: User not authenticated
 */
router.get('/me', authenticateJWT, getMe);

/**
 * @swagger
 * /api/v1/auth/onboarding:
 *   patch:
 *     summary: Complete user onboarding
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             role: student
 *             keyStage: ks2
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       400:
 *         description: Invalid role or key stage
 *       401:
 *         description: User not authenticated
 */
router.patch('/onboarding', authenticateJWT, onboardingValidationRules, validateRequest, completeOnboarding);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: John Doe
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid name
 *       401:
 *         description: User not authenticated
 */
router.patch('/profile', authenticateJWT, updateProfileValidationRules, validateRequest, updateProfile);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             currentPassword: oldPassword123
 *             newPassword: newPassword456#
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password format
 *       401:
 *         description: Current password is incorrect
 */
router.patch('/change-password', authenticateJWT, changePasswordValidationRules, validateRequest, changePassword);

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Auth]
 *     responses:
 *       503:
 *         description: Google OAuth not configured
 */
router.get('/google', (_req, res) => {
  res.status(503).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Google sign-in is coming soon' } });
});

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Auth]
 *     responses:
 *       503:
 *         description: Google OAuth not configured
 */
router.get('/google/callback', (_req, res) => {
  res.redirect(`${config.frontendUrl}/login?error=oauth_not_configured`);
});

export default router;