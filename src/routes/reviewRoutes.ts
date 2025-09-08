import { Router } from 'express';
import { param } from 'express-validator';
import {
  getCourseReviews,
  postReview,
  deleteOwnReview,
} from '../controllers/reviewController';
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

/**
 * @swagger
 * /api/v1/courses/{courseId}/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review for a course (student owner only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: 
 *           type: string
 *         description: The ID of the course (for route consistency)
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the review to delete
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user is not the owner
 *       404:
 *         description: Review not found
 */
router.delete(
  '/:courseId/reviews/:reviewId',
  authenticateJWT,
  isStudent,
  [
    param('courseId').isMongoId().withMessage('Invalid course ID format'),
  ],
  validateRequest,
  deleteOwnReview,
);

export default router;