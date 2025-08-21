import { Router } from 'express';
import { body, param } from 'express-validator';
import { getCourseReviews, postReview } from '../controllers/reviewController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isStudent } from '../middleware/roles/isStudent';
import { reviewValidationRules } from '../middleware/validators/reviewValidators';
import validateRequest from '../middleware/validators/validateRequest';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Course reviews and ratings
 *
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60c72b2f9b1e8e001c8e4b8a"
 *         courseId:
 *           type: string
 *           example: "60c72b2f9b1e8e001c8e4b8b"
 *         userId:
 *           type: string
 *           example: "60c72b2f9b1e8e001c8e4b8c"
 *         rating:
 *           type: integer
 *           example: 5
 *         comment:
 *           type: string
 *           example: "Great course!"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-07-31T12:34:56.789Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-07-31T12:34:56.789Z"
 */

/**
 * @swagger
 * /api/v1/courses/{courseId}/reviews:
 *   get:
 *     summary: Get all reviews for a course
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the course
 *     responses:
 *       200:
 *         description: A list of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 *       400:
 *         description: Invalid course ID format
 *   post:
 *     summary: Post a review for a course (student only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the course
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
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user is not a student
 */
router
  .route('/:courseId/reviews')
  .get(
    [
      param('courseId').isMongoId().withMessage('Invalid course ID format'),
    ],
    validateRequest,
    getCourseReviews
  )
  .post(
    authenticateJWT,
    isStudent,
    reviewValidationRules,
    validateRequest,
    postReview
  );

export default router;
