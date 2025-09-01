/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { authValidationRules } from '../middleware/validators/authValidators';
import validateRequest from '../middleware/validators/validateRequest';
import { authLimiter } from '../middleware/rateLimiter';

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
 *             password: strongpassword123
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already in use
 */
router.post('/register', authLimiter, authValidationRules, validateRequest, register);

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
router.post('/login', authLimiter, authValidationRules, validateRequest, login);

export default router;