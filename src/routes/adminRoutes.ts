import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  getUserById,
  deleteUser,
  updateUser,
  createLicenseBatch,
  getAllLicenses,
  getLicenseById,
  updateLicense,
  deleteLicense,
} from '../controllers/adminControllers/adminController';
import { createPost, updatePost, deletePost } from '../controllers/contentController';
import { authenticateJWT } from '../middleware/authMiddleware';
import {
  adminCreateUserValidationRules,
  adminUpdateUserValidationRules,
} from '../middleware/validators/adminValidators';
import validateRequest from '../middleware/validators/validateRequest';
import { isAdmin } from '../middleware/roles/isAdmin';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin operations
 */

// User Management
/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users', authenticateJWT, isAdmin, getAllUsers);
/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Admin]
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
 *         description: A single user
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/users/:id', authenticateJWT, isAdmin, getUserById);
/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               email:
 *                 type: string
 *                 example: "jane@example.com"
 *               password:
 *                 type: string
 *                 example: "securePassword123"
 *               role:
 *                 type: string
 *                 example: "admin"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: User with this email already exists
 */
router.post(
  '/users',
  authenticateJWT,
  isAdmin,
  adminCreateUserValidationRules,
  validateRequest,
  createUser,
);
/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   put:
 *     summary: Update a user's details (and optionally change their password)
 *     tags: [Admin]
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
 *               name:
 *                 type: string
 *                 example: "Jane DoeUpdated"
 *               email:
 *                 type: string
 *                 example: "jane.updated@example.com"
 *               role:
 *                 type: string
 *                 example: "instructor"
 *               password:
 *                 type: string
 *                 description: Optional. Provide a new password to change it.
 *                 example: "newSecurePassword123"
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put(
  '/users/:id',
  authenticateJWT,
  isAdmin,
  adminUpdateUserValidationRules,
  validateRequest,
  updateUser,
);
/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
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
 *         description: User deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', authenticateJWT, isAdmin, deleteUser);

// Content Management
/**
 * @swagger
 * /api/v1/admin/content:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Admin]
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
 *               - slug
 *               - content
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               featuredImage:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [BLOG, NURTURED]
 *               published:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/content', authenticateJWT, isAdmin, createPost);

/**
 * @swagger
 * /api/v1/admin/content/{id}:
 *   put:
 *     summary: Update a blog post
 *     tags: [Admin]
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
 *         description: Post updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.put('/content/:id', authenticateJWT, isAdmin, updatePost);

/**
 * @swagger
 * /api/v1/admin/content/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Admin]
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
 *         description: Post deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.delete('/content/:id', authenticateJWT, isAdmin, deletePost);

// License Management
/**
 * @swagger
 * /api/v1/admin/licenses:
 *   get:
 *     summary: Get all license batches with usage statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of licenses with stats
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/licenses', authenticateJWT, isAdmin, getAllLicenses);

/**
 * @swagger
 * /api/v1/admin/licenses/{id}:
 *   get:
 *     summary: Get a license batch by ID with enrolled users
 *     tags: [Admin]
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
 *         description: License details with enrolled users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: License not found
 */
router.get('/licenses/:id', authenticateJWT, isAdmin, getLicenseById);

/**
 * @swagger
 * /api/v1/admin/licenses:
 *   post:
 *     summary: Create a new license batch for a school
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schoolName
 *               - maxUsers
 *               - expiryDate
 *             properties:
 *               schoolName:
 *                 type: string
 *                 example: "Springfield Elementary"
 *               maxUsers:
 *                 type: number
 *                 example: 500
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *     responses:
 *       201:
 *         description: License created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/licenses', authenticateJWT, isAdmin, createLicenseBatch);

/**
 * @swagger
 * /api/v1/admin/licenses/{id}:
 *   put:
 *     summary: Update a license batch
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               maxUsers:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: License updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: License not found
 */
router.put('/licenses/:id', authenticateJWT, isAdmin, updateLicense);

/**
 * @swagger
 * /api/v1/admin/licenses/{id}:
 *   delete:
 *     summary: Delete a license batch
 *     tags: [Admin]
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
 *         description: License deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: License not found
 */
router.delete('/licenses/:id', authenticateJWT, isAdmin, deleteLicense);

export default router;
