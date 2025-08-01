import { Router } from 'express';
import { getCourseReviews, postReview } from '../controllers/reviewController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isStudent } from '../middleware/roles/isStudent';
import { reviewValidationRules } from '../middleware/validators/reviewValidators';
import validateRequest from '../middleware/validators/validateRequest';

const router = Router();

/**
 * @swagger
 * /api/courses/{courseId}/reviews:
 *   get:
 *     summary: Get all reviews for a course
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60c72b2f9b1e8e001c8e4b8a"
 *                   courseId:
 *                     type: string
 *                     example: "60c72b2f9b1e8e001c8e4b8b"
 *                   userId:
 *                     type: string
 *                     example: "60c72b2f9b1e8e001c8e4b8c"
 *                   rating:
 *                     type: integer
 *                     example: 5
 *                   comment:
 *                     type: string
 *                     example: "Great course!"
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-07-31T12:34:56.789Z"
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-07-31T12:34:56.789Z"
 */

/**
 * @swagger
 * /api/courses/{courseId}/reviews:
 *   post:
 *     summary: Post a review for a course (student only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Great course!"
 *     responses:
 *       201:
 *         description: Review posted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Review posted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "60c72b2f9b1e8e001c8e4b8a"
 *                     courseId:
 *                       type: string
 *                       example: "60c72b2f9b1e8e001c8e4b8b"
 *                     userId:
 *                       type: string
 *                       example: "60c72b2f9b1e8e001c8e4b8c"
 *                     rating:
 *                       type: integer
 *                       example: 5
 *                     comment:
 *                       type: string
 *                       example: "Great course!"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-07-31T12:34:56.789Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-07-31T12:34:56.789Z"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/:courseId/reviews', getCourseReviews);
router.post(
  '/:courseId/reviews',
  authenticateJWT,
  isStudent,
  reviewValidationRules,
  validateRequest,
  postReview,
);

export default router;
