import { Router } from 'express';
import { authenticateJWT, checkRole } from '../middleware/authMiddleware';
import { registerSchoolAdmin, getStudents } from '../controllers/schoolController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: School
 *   description: School admin registration and student management
 */

/**
 * @swagger
 * /school/register:
 *   post:
 *     summary: Register a new school admin account
 *     tags: [School]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Jane Smith
 *             email: jane@school.ac.uk
 *             password: securepassword123
 *             schoolName: Greenfield Academy
 *     responses:
 *       201:
 *         description: School admin registered successfully, returns JWT token
 *       400:
 *         description: Validation error or email already in use
 */
// Public route for school admin registration
router.post('/register', registerSchoolAdmin);

// Protected routes — must be authenticated and have the schooladmin role
router.use(authenticateJWT);
router.use(checkRole('schooladmin'));

/**
 * @swagger
 * /school/students:
 *   get:
 *     summary: Get all students linked to the authenticated school admin's school
 *     tags: [School]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of students returned successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: School admin role required
 */
router.get('/students', getStudents);

export default router;

