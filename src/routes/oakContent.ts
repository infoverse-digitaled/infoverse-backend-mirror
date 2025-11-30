import { Router } from 'express';
import {
  getKeyStages,
  getSubjects,
  getUnits,
  getLessons,
  getLessonDetails,
  searchLessons,
} from '../controllers/oakContentController';

const router = Router();

router.get('/keystages', getKeyStages);
router.get('/keystages/:keyStage/subjects', getSubjects);
router.get('/subjects/:keyStage/:subjectSlug/units', getUnits);
router.get('/units/:unitSlug/lessons', getLessons);
router.get('/lessons/:lessonSlug', getLessonDetails);
router.get('/search', searchLessons);

export default router;
