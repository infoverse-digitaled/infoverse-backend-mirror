/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile operations
 */


import express from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/usercontroller';
import { authenticateJWT } from '../middleware/authMiddleware';

const userRouter = express.Router();

/**
 * @swagger
 * /api/users/me/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
userRouter.get('/me/profile', authenticateJWT, getUserProfile);

/**
 * @swagger
 * /api/users/me/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: User profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
userRouter.put('/me/profile', authenticateJWT, updateUserProfile);

export default userRouter;
