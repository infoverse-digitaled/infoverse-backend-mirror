import { Router, Request, Response, NextFunction } from 'express';
import {
  getKeyStages,
  getSubjects,
  getUnits,
  getUnitDetails,
  getLessons,
  getLessonDetails,
  getLessonQuiz,
  getLessonAssets,
  getAssetFile,
  getLessonTranscript,
  searchLessons,
  clearSubjectCache,
  clearKeyStageCache,
  clearAllCache,
} from '../controllers/oakContentController';
import { optionalAuth, authenticateJWT, requireActiveSubscription, AuthenticatedRequest } from '../middleware/authMiddleware';

// Admin check middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
    return;
  }
  next();
};

const router = Router();

// Middleware to set CORP headers on ALL responses (including auth errors)
// This MUST run before auth middleware so error responses also have proper headers
const setAssetCORPHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  next();
};

// CORS preflight handler for asset routes (video streaming requires this)
const handleAssetPreflight = (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  res.status(204).end();
};

/**
 * @swagger
 * tags:
 *   name: Oak Content
 *   description: Oak National Academy curriculum content — key stages, subjects, units, lessons, quizzes, and assets
 */

// Public routes - allow browsing curriculum structure

/**
 * @swagger
 * /oak/keystages:
 *   get:
 *     summary: Get all key stages (KS1–KS4)
 *     tags: [Oak Content]
 *     responses:
 *       200:
 *         description: List of key stages returned successfully
 */
router.get('/keystages', getKeyStages);

/**
 * @swagger
 * /oak/keystages/{keyStage}/subjects:
 *   get:
 *     summary: Get all subjects for a given key stage
 *     tags: [Oak Content]
 *     parameters:
 *       - in: path
 *         name: keyStage
 *         required: true
 *         schema:
 *           type: string
 *         description: The key stage slug (e.g. ks1, ks2, ks3, ks4)
 *     responses:
 *       200:
 *         description: List of subjects returned successfully
 *       404:
 *         description: Key stage not found
 */
router.get('/keystages/:keyStage/subjects', getSubjects);

/**
 * @swagger
 * /oak/subjects/{keyStage}/{subjectSlug}/units:
 *   get:
 *     summary: Get all units for a given subject within a key stage
 *     tags: [Oak Content]
 *     parameters:
 *       - in: path
 *         name: keyStage
 *         required: true
 *         schema:
 *           type: string
 *         description: The key stage slug (e.g. ks3)
 *       - in: path
 *         name: subjectSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The subject slug (e.g. maths)
 *     responses:
 *       200:
 *         description: List of units returned successfully
 */
router.get('/subjects/:keyStage/:subjectSlug/units', optionalAuth, getUnits);

/**
 * @swagger
 * /oak/units/{unitSlug}:
 *   get:
 *     summary: Get details of a single unit by its slug
 *     tags: [Oak Content]
 *     parameters:
 *       - in: path
 *         name: unitSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The unit slug
 *     responses:
 *       200:
 *         description: Unit details returned successfully
 *       404:
 *         description: Unit not found
 */
router.get('/units/:unitSlug', optionalAuth, getUnitDetails);

/**
 * @swagger
 * /oak/units/{unitSlug}/lessons:
 *   get:
 *     summary: Get all lessons for a given unit
 *     tags: [Oak Content]
 *     parameters:
 *       - in: path
 *         name: unitSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The unit slug
 *     responses:
 *       200:
 *         description: List of lessons returned successfully
 */
router.get('/units/:unitSlug/lessons', optionalAuth, getLessons);

/**
 * @swagger
 * /oak/search:
 *   get:
 *     summary: Search for lessons across the curriculum
 *     tags: [Oak Content]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *     responses:
 *       200:
 *         description: Search results returned successfully
 */
router.get('/search', optionalAuth, searchLessons);

// Premium routes - require active subscription (paid or valid trial)

/**
 * @swagger
 * /oak/lessons/{lessonSlug}:
 *   get:
 *     summary: Get full details of a single lesson (premium)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The lesson slug
 *     responses:
 *       200:
 *         description: Lesson details returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Active subscription required
 */
router.get('/lessons/:lessonSlug', authenticateJWT, requireActiveSubscription, getLessonDetails);

/**
 * @swagger
 * /oak/lessons/{lessonSlug}/quiz:
 *   get:
 *     summary: Get starter and exit quiz questions for a lesson (premium)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The lesson slug
 *     responses:
 *       200:
 *         description: Quiz questions returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Active subscription required
 */
router.get('/lessons/:lessonSlug/quiz', authenticateJWT, requireActiveSubscription, getLessonQuiz);

/**
 * @swagger
 * /oak/lessons/{lessonSlug}/assets:
 *   get:
 *     summary: Get asset metadata for a lesson (video, worksheets, slides) (premium)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The lesson slug
 *     responses:
 *       200:
 *         description: Asset metadata returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Active subscription required
 */
router.get('/lessons/:lessonSlug/assets', authenticateJWT, requireActiveSubscription, getLessonAssets);

// Asset file routes with OPTIONS preflight support for CORS
// setAssetCORPHeaders runs FIRST to ensure CORP headers on ALL responses (including 401/403 errors)
router.options('/lessons/:lessonSlug/assets/:assetType', handleAssetPreflight);

/**
 * @swagger
 * /oak/lessons/{lessonSlug}/assets/{assetType}:
 *   get:
 *     summary: Stream or download a specific lesson asset file (premium)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The lesson slug
 *       - in: path
 *         name: assetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [video, worksheet, slides]
 *         description: The type of asset to retrieve
 *     responses:
 *       200:
 *         description: Asset file stream returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Active subscription required
 */
router.get('/lessons/:lessonSlug/assets/:assetType', setAssetCORPHeaders, authenticateJWT, requireActiveSubscription, getAssetFile);

/**
 * @swagger
 * /oak/lessons/{lessonSlug}/transcript:
 *   get:
 *     summary: Get the transcript for a lesson (premium)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: The lesson slug
 *     responses:
 *       200:
 *         description: Lesson transcript returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Active subscription required
 */
router.get('/lessons/:lessonSlug/transcript', authenticateJWT, requireActiveSubscription, getLessonTranscript);

// Admin routes for cache management

/**
 * @swagger
 * /oak/cache/{keyStage}/{subjectSlug}:
 *   delete:
 *     summary: Clear cache for a specific subject (admin only)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyStage
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: subjectSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       403:
 *         description: Admin access required
 */
router.delete('/cache/:keyStage/:subjectSlug', authenticateJWT, requireAdmin, clearSubjectCache);

/**
 * @swagger
 * /oak/cache/{keyStage}:
 *   delete:
 *     summary: Clear cache for an entire key stage (admin only)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyStage
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       403:
 *         description: Admin access required
 */
router.delete('/cache/:keyStage', authenticateJWT, requireAdmin, clearKeyStageCache);

/**
 * @swagger
 * /oak/cache:
 *   delete:
 *     summary: Clear the entire Oak content cache (admin only)
 *     tags: [Oak Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All cache cleared successfully
 *       403:
 *         description: Admin access required
 */
router.delete('/cache', authenticateJWT, requireAdmin, clearAllCache);

export default router;
