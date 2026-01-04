import { Router, Request, Response } from 'express';
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
} from '../controllers/oakContentController';
import { optionalAuth, authenticateJWT, requireActiveSubscription } from '../middleware/authMiddleware';

const router = Router();

// CORS preflight handler for asset routes (video streaming requires this)
const handleAssetPreflight = (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  res.status(204).end();
};

// Public routes - allow browsing curriculum structure
router.get('/keystages', getKeyStages);
router.get('/keystages/:keyStage/subjects', getSubjects);
router.get('/subjects/:keyStage/:subjectSlug/units', optionalAuth, getUnits);
router.get('/units/:unitSlug', optionalAuth, getUnitDetails);
router.get('/units/:unitSlug/lessons', optionalAuth, getLessons);
router.get('/search', optionalAuth, searchLessons);

// Premium routes - require active subscription (paid or valid trial)
router.get('/lessons/:lessonSlug', authenticateJWT, requireActiveSubscription, getLessonDetails);
router.get('/lessons/:lessonSlug/quiz', authenticateJWT, requireActiveSubscription, getLessonQuiz);
router.get('/lessons/:lessonSlug/assets', authenticateJWT, requireActiveSubscription, getLessonAssets);

// Asset file routes with OPTIONS preflight support for CORS
router.options('/lessons/:lessonSlug/assets/:assetType', handleAssetPreflight);
router.get('/lessons/:lessonSlug/assets/:assetType', authenticateJWT, requireActiveSubscription, getAssetFile);

router.get('/lessons/:lessonSlug/transcript', authenticateJWT, requireActiveSubscription, getLessonTranscript);

export default router;
