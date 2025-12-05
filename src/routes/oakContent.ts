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
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(optionalAuth);

router.get('/keystages', getKeyStages);
router.get('/keystages/:keyStage/subjects', getSubjects);
router.get('/subjects/:keyStage/:subjectSlug/units', getUnits);
router.get('/units/:unitSlug', getUnitDetails);
router.get('/units/:unitSlug/lessons', getLessons);
router.get('/lessons/:lessonSlug', getLessonDetails);
router.get('/lessons/:lessonSlug/quiz', getLessonQuiz);
router.get('/lessons/:lessonSlug/assets', getLessonAssets);
router.get('/lessons/:lessonSlug/assets/:assetType', getAssetFile);
router.get('/lessons/:lessonSlug/transcript', getLessonTranscript);
router.get('/search', searchLessons);

export default router;
