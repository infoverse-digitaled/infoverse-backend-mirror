import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateJWT } from '../middleware/authMiddleware';
import validateRequest from '../middleware/validators/validateRequest'; // Reusing existing validator middleware wrapper
import {
  enroll,
  unenroll,
  updateProgress,
  submitQuiz,
  getMyProgress,
  recordActivity,
  getStreak,
} from '../controllers/oakProgressController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Oak Progress
 *   description: Enrollment, lesson progress tracking, quiz submissions, and streaks
 */

// Apply auth to all progress routes (must be logged in to track progress)
router.use(authenticateJWT);

/**
 * @swagger
 * /progress/my-progress:
 *   get:
 *     summary: Get all enrollments and progress for the current user
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrollments with progress returned successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/my-progress', getMyProgress);

/**
 * @swagger
 * /progress/enroll:
 *   post:
 *     summary: Enroll in a subject/lesson (starts progress tracking)
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             subjectSlug: maths
 *             keyStage: ks3
 *             unitSlug: algebra-basics
 *             lessonSlug: solving-equations
 *     responses:
 *       201:
 *         description: Enrollment created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/enroll',
  [
    body('subjectSlug').notEmpty().withMessage('Subject slug is required'),
    body('keyStage').notEmpty().withMessage('Key stage is required'),
    body('unitSlug').optional().isString(),
    body('lessonSlug').optional().isString(),
  ],
  validateRequest,
  enroll,
);

/**
 * @swagger
 * /progress/enrollments/{id}/progress:
 *   put:
 *     summary: Update lesson progress for an enrollment (heartbeat)
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The enrollment ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             unitSlug: algebra-basics
 *             lessonSlug: solving-equations
 *     responses:
 *       200:
 *         description: Progress updated successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Enrollment not found
 */
router.put(
  '/enrollments/:id/progress',
  [
    body('unitSlug').optional().isString(),
    body('lessonSlug').optional().isString(),
    // body('videoWatchedPercent').optional().isNumeric(),
  ],
  validateRequest,
  updateProgress,
);

/**
 * @swagger
 * /progress/enrollments/{id}/quiz:
 *   post:
 *     summary: Submit quiz answers for a lesson
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The enrollment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             unitSlug: algebra-basics
 *             lessonSlug: solving-equations
 *             answers:
 *               - questionId: q1
 *                 answer: 42
 *               - questionId: q2
 *                 answer: "linear"
 *     responses:
 *       200:
 *         description: Quiz submitted, score and pass/fail returned
 *       400:
 *         description: Missing or invalid fields
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/enrollments/:id/quiz',
  [
    body('unitSlug').notEmpty().withMessage('Unit slug is required'),
    body('lessonSlug').notEmpty().withMessage('Lesson slug is required'),
    body('answers').isArray().withMessage('Answers must be an array'),
  ],
  validateRequest,
  submitQuiz,
);

/**
 * @swagger
 * /progress/activity:
 *   post:
 *     summary: Record a user activity event (used for streak tracking)
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity recorded successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/activity', recordActivity);

/**
 * @swagger
 * /progress/streak:
 *   get:
 *     summary: Get the current user's learning streak
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streak data returned successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/streak', getStreak);

/**
 * @swagger
 * /progress/enroll:
 *   delete:
 *     summary: Unenroll from a subject at a specific key stage (cascades progress deletion)
 *     tags: [Oak Progress]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             subjectSlug: maths
 *             keyStage: ks3
 *     responses:
 *       200:
 *         description: Unenrolled successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authenticated
 */
router.delete(
  '/enroll',
  [
    body('subjectSlug').notEmpty().withMessage('Subject slug is required'),
    body('keyStage').notEmpty().withMessage('Key stage is required'),
  ],
  validateRequest,
  unenroll,
);

export default router;
