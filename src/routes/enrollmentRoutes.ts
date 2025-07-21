/**
 * @swagger
 * tags:
 *   name: Enrollments
 *   description: Course enrollment operations
 */

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

/**
 * @swagger
 * /api/courses/{courseId}/enroll:
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
enrollmentRouter.post('/courses/:courseId/enroll', authenticateJWT, enrollInCourse);

/**
 * @swagger
 * /api/users/me/courses:
 *   get:
 *     summary: Get all courses the user is enrolled in
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrolled courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       courseId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       enrolledAt:
 *                         type: string
 *                         format: date-time
 */
enrollmentRouter.get('/users/me/courses', authenticateJWT, getUserEnrollments);

/**
 * @swagger
 * /api/courses/{courseId}/enrollments:
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
enrollmentRouter.get(
  '/courses/:courseId/enrollments',
  authenticateJWT,
  isInstructor,
  getCourseEnrollments,
);

/**
 * @swagger
 * /api/enrollments/{enrollmentId}:
 *   put:
 *     summary: Update an enrollment status (instructor only)
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
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
  '/enrollments/:enrollmentId',
  authenticateJWT,
  isInstructor,
  updateEnrollmentStatus,
);

/**
 * @swagger
 * /api/courses/{courseId}/drop:
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
enrollmentRouter.delete('/courses/:courseId/drop', authenticateJWT, dropCourse);

export default enrollmentRouter;
