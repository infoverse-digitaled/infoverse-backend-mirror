/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile operations
 */

import express from 'express';
import validateRequest from '../middleware/validators/validateRequest';
import { userUpdateValidationRules } from '../middleware/validators/userValidators';
import {
  getUserProfile,
  updateUserProfile,
  getUserReviews,
  getUserEnrollments,
} from '../controllers/usercontroller';
import { authenticateJWT } from '../middleware/authMiddleware';

const userRouter = express.Router();

/**
 * @swagger
 * /api/v1/users/me/profile:
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
 * /api/v1/users/me/profile:
 *   put:
 *     summary: Update current user's profile (and optionally change password)
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
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               currentPassword:
 *                 type: string
 *                 description: Required only when changing the password.
 *                 example: "currentSecurePassword123"
 *               newPassword:
 *                 type: string
 *                 description: Required only when changing the password. Must be at least 8 characters.
 *                 example: "newSecurePassword456"
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       400:
 *         description: Validation error (e.g., missing fields for password change)
 *       401:
 *         description: Unauthorized (e.g., incorrect currentPassword)
 */
userRouter.put(
  '/me/profile',
  authenticateJWT,
  userUpdateValidationRules,
  validateRequest,
  updateUserProfile,
);

/**
 * @swagger
 * /api/v1/users/me/enrollments:
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
 * /api/v1/users/me/reviews:
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
