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

// Apply auth to all progress routes (must be logged in to track progress)
router.use(authenticateJWT);

/**
 * @route GET /progress/my-progress
 * @desc Get all enrollments and progress for the current user
 */
router.get('/my-progress', getMyProgress);

/**
 * @route POST /progress/enroll
 * @desc Enroll in a subject/lesson (starts tracking)
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
  enroll
);

/**
 * @route PUT /progress/enrollments/:id/progress
 * @desc Update progress (heartbeat)
 */
router.put(
  '/enrollments/:id/progress',
  [
     body('unitSlug').optional().isString(),
     body('lessonSlug').optional().isString(),
     // body('videoWatchedPercent').optional().isNumeric(),
  ],
  validateRequest,
  updateProgress
);

/**
 * @route POST /progress/enrollments/:id/quiz
 * @desc Submit quiz answers
 */
router.post(
  '/enrollments/:id/quiz',
  [
    body('unitSlug').notEmpty().withMessage('Unit slug is required'),
    body('lessonSlug').notEmpty().withMessage('Lesson slug is required'),
    body('answers').isArray().withMessage('Answers must be an array'),
  ],
  validateRequest,
  submitQuiz
);

/**
 * @route POST /progress/activity
 * @desc Record user activity (for streak tracking)
 */
router.post('/activity', recordActivity);

/**
 * @route GET /progress/streak
 * @desc Get user's current streak
 */
router.get('/streak', getStreak);

/**
 * @route DELETE /progress/enroll
 * @desc Unenroll from a subject at a specific key stage (cascades progress deletion)
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
