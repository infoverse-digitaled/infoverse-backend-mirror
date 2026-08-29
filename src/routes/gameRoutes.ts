import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/roles/isAdmin';
import validateRequest from '../middleware/validators/validateRequest';
import {
  startGame,
  submitAnswer,
  cashOut,
  getLeaderboard,
  generatePool,
} from '../controllers/gameController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Games
 *   description: In-app games (Millionaire trivia and future titles)
 */

// Free for all logged-in users - no subscription gate
router.use(authenticateJWT);

/**
 * @swagger
 * /game/millionaire/start:
 *   post:
 *     summary: Start a new Millionaire game session
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             keyStage: ks2
 *             subject: mixed
 *             difficulty: medium
 *     responses:
 *       201:
 *         description: Session started, first question returned
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/millionaire/start',
  [
    body('keyStage').isIn(['ks1', 'ks2', 'ks3', 'ks4']).withMessage('Invalid key stage'),
    body('subject').optional().isString(),
    body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
  ],
  validateRequest,
  startGame,
);

/**
 * @swagger
 * /game/millionaire/{sessionId}/answer:
 *   post:
 *     summary: Submit an answer for the current question in a session
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             selectedOptionIndex: 2
 *     responses:
 *       200:
 *         description: Answer validated, result and next question (if any) returned
 *       400:
 *         description: Session already ended
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
router.post(
  '/millionaire/:sessionId/answer',
  [body('selectedOptionIndex').isInt({ min: 0, max: 3 }).withMessage('Invalid option index')],
  validateRequest,
  submitAnswer,
);

/**
 * @swagger
 * /game/millionaire/{sessionId}/cashout:
 *   post:
 *     summary: Cash out of an in-progress session, keeping the current score
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session ended, final score returned
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
router.post('/millionaire/:sessionId/cashout', cashOut);

/**
 * @swagger
 * /game/leaderboard:
 *   get:
 *     summary: Get the weekly Millionaire leaderboard
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leaderboard returned successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/leaderboard', getLeaderboard);

/**
 * @swagger
 * /game/admin/millionaire/generate-pool:
 *   post:
 *     summary: (Admin) Generate a batch of trivia questions via Gemini into the question pool
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             keyStage: ks2
 *             subject: mixed
 *             difficulty: 5
 *             count: 10
 *     responses:
 *       201:
 *         description: Questions generated and inserted into the pool
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 */
router.post(
  '/admin/millionaire/generate-pool',
  isAdmin,
  [
    body('keyStage').isIn(['ks1', 'ks2', 'ks3', 'ks4']).withMessage('Invalid key stage'),
    body('subject').optional().isString(),
    body('difficulty').isInt({ min: 1, max: 15 }).withMessage('Difficulty must be 1-15'),
    body('count').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  generatePool,
);

export default router;
