import express from 'express';
import {
  enrollInCourse,
  getUserEnrollments,
  getCourseEnrollments,
  updateEnrollmentStatus,
  dropCourse,
} from '../controllers/enrollmentController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isInstructor } from '../middleware/isInstructor';

const enrollmentRouter = express.Router();

enrollmentRouter.post('/courses/:courseId/enroll', authenticateJWT, enrollInCourse);

enrollmentRouter.get('/users/me/courses', authenticateJWT, getUserEnrollments);

enrollmentRouter.get(
  '/courses/:courseId/enrollments',
  authenticateJWT,
  isInstructor,
  getCourseEnrollments,
);

enrollmentRouter.put(
  '/enrollments/:enrollmentId',
  authenticateJWT,
  isInstructor,
  updateEnrollmentStatus,
);

enrollmentRouter.delete('/courses/:courseId/drop', authenticateJWT, dropCourse);

export default enrollmentRouter;
