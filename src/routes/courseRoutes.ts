/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course management and retrieval
 */

import express from 'express';
import {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isInstructor } from '../middleware/roles/isInstructor';
import {
  courseValidationRules,
  updateCourseValidationRules,
} from '../middleware/validators/courseValidators';
import validateRequest from '../middleware/validators/validateRequest';

const courseRouter = express.Router();

/**
 * @swagger
 * /api/v1/courses:
 *   get:
 *     summary: Get paginated list of courses
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *     responses:
 *       200:
 *         description: List of courses with pagination
 */
courseRouter.get('/', listCourses);

/**
 * @swagger
 * /api/v1/courses/{id}:
 *   get:
 *     summary: Get a course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The course data
 *       404:
 *         description: Course not found
 */
courseRouter.get('/:id', getCourseById);

/**
 * @swagger
 * /api/v1/courses:
 *   post:
 *     summary: Create a new course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               thumbnailUrl:
 *                 type: string
 *               syllabus:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     contentType:
 *                       type: string
 *                       enum: [video, text, quiz]
 *                     contentUrl:
 *                       type: string
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (not instructor)
 */
courseRouter.post(
  '/',
  authenticateJWT,
  isInstructor,
  courseValidationRules,
  validateRequest,
  createCourse,
);

/**
 * @swagger
 * /api/v1/courses/{id}:
 *   put:
 *     summary: Update a course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 *       403:
 *         description: Forbidden (not instructor)
 */
courseRouter.put(
  '/:id',
  authenticateJWT,
  isInstructor,
  updateCourseValidationRules,
  validateRequest,
  updateCourse,
);

/**
 * @swagger
 * /api/v1/courses/{id}:
 *   delete:
 *     summary: Delete a course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course deleted
 *       404:
 *         description: Course not found
 *       403:
 *         description: Forbidden (not instructor)
 */
courseRouter.delete('/:id', authenticateJWT, isInstructor, deleteCourse);

export default courseRouter;
