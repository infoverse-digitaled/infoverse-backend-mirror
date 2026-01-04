import { Router } from 'express';
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
router.get('/lessons/:lessonSlug/assets/:assetType', authenticateJWT, requireActiveSubscription, getAssetFile);
router.get('/lessons/:lessonSlug/transcript', authenticateJWT, requireActiveSubscription, getLessonTranscript);

export default router;
