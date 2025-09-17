/**
 * @swagger
 * tags:
 *   name: Enrollments
 *   description: Course enrollment operations
 */

import express from 'express';
import {
  enrollInCourse,
  getCourseEnrollments,
  updateEnrollmentStatus,
  dropCourse,
} from '../controllers/enrollmentController';
import validateRequest from '../middleware/validators/validateRequest';
import { updateEnrollmentValidationRules } from '../middleware/validators/enrollmentValidators';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isInstructor } from '../middleware/roles/isInstructor';
import { isStudent } from '../middleware/roles/isStudent';

const enrollmentRouter = express.Router();
/**
 * @swagger
 * /api/v1/courses/{courseId}/enroll:
 *   post:
 *     summary: Enroll the authenticated user in a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Enrollment successful
 *       400:
 *         description: Already enrolled or validation error
 *       401:
 *         description: Unauthorized
 */
enrollmentRouter.post('/:courseId/enroll', authenticateJWT, enrollInCourse);

/**
 * @swagger
 * /api/v1/courses/{courseId}/enrollments:
 *   get:
 *     summary: Get all enrollments for a course (instructor only)
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of enrollments for course
 *       403:
 *         description: Forbidden
 *       401:
 *         description: Unauthorized
 */
enrollmentRouter.get('/:courseId/enrollments', authenticateJWT, isInstructor, getCourseEnrollments);

/**
 * @swagger
 * /api/v1/courses/{courseId}/enrollments/{enrollmentId}:
 *   put:
 *     summary: Update an enrollment status (student only)
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, completed, dropped]
 *     responses:
 *       200:
 *         description: Enrollment status updated
 *       403:
 *         description: Forbidden
 *       401:
 *         description: Unauthorized
 */
enrollmentRouter.put(
  '/:courseId/enrollments/:enrollmentId',
  authenticateJWT,
  isStudent,
  updateEnrollmentValidationRules,
  validateRequest,
  updateEnrollmentStatus,
);

/**
 * @swagger
 * /api/v1/courses/{courseId}/drop:
 *   delete:
 *     summary: Drop a course the user is enrolled in
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course dropped successfully
 *       401:
 *         description: Unauthorized
 */
enrollmentRouter.delete('/:courseId/drop', authenticateJWT, isStudent, dropCourse);

export default enrollmentRouter;
