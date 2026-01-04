import { Router } from 'express';
import { tutorQuestion, summarizeContent, explainConcept } from '../controllers/aiController';
import { authenticateJWT, requireActiveSubscription } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI Tutor powered by Google Gemini
 */

/**
 * @swagger
 * /api/v1/ai/tutor:
 *   post:
 *     summary: Ask the AI tutor a question about lesson content
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context
 *               - question
 *             properties:
 *               context:
 *                 type: string
 *                 description: The lesson content for context
 *                 example: "In this lesson, we learn about photosynthesis..."
 *               question:
 *                 type: string
 *                 description: The student's question
 *                 example: "What is chlorophyll?"
 *     responses:
 *       200:
 *         description: AI response generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     answer:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/tutor', authenticateJWT, requireActiveSubscription, tutorQuestion);

/**
 * @swagger
 * /api/v1/ai/summary:
 *   post:
 *     summary: Generate a summary of lesson content
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The lesson content to summarize
 *     responses:
 *       200:
 *         description: Summary generated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/summary', authenticateJWT, requireActiveSubscription, summarizeContent);

/**
 * @swagger
 * /api/v1/ai/explain:
 *   post:
 *     summary: Explain a concept in simpler terms
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - concept
 *             properties:
 *               concept:
 *                 type: string
 *                 description: The concept to explain
 *               context:
 *                 type: string
 *                 description: Optional lesson context
 *     responses:
 *       200:
 *         description: Explanation generated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/explain', authenticateJWT, requireActiveSubscription, explainConcept);

export default router;
