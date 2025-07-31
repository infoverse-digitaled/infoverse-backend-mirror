/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile operations
 */

import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getUserReviews,
  getUserEnrollments,
} from '../controllers/userController';
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

/**
 * @swagger
 * /api/users/me/enrollments:
 *   get:
 *     summary: Get all courses the user is enrolled in
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrolled courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       courseId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       enrolledAt:
 *                         type: string
 *                         format: date-time
 */
userRouter.get('/me/enrollments', authenticateJWT, getUserEnrollments);
/**
 * @swagger
 * /api/users/me/reviews:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviews by the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60c72b2f9b1e8e001c8e4b8a"
 *                       courseId:
 *                         type: string
 *                         example: "60c72b2f9b1e8e001c8e4b8b"
 *                       userId:
 *                         type: string
 *                         example: "60c72b2f9b1e8e001c8e4b8c"
 *                       rating:
 *                         type: integer
 *                         example: 5
 *                       comment:
 *                         type: string
 *                         example: "Great course!"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-07-31T12:34:56.789Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-07-31T12:34:56.789Z"
 *       401:
 *         description: Unauthorized
 */
userRouter.get('/me/reviews', authenticateJWT, getUserReviews);

export default userRouter;
