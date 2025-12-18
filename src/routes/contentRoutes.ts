import { Router } from 'express';
import {
  getPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
} from '../controllers/contentController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/roles/isAdmin';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Blog and marketing content management
 */

// Public routes
/**
 * @swagger
 * /api/v1/content/posts:
 *   get:
 *     summary: Get all published posts
 *     tags: [Content]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BLOG, NURTURED]
 *         description: Filter by content type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of posts with pagination
 */
router.get('/posts', getPosts);

/**
 * @swagger
 * /api/v1/content/posts/{slug}:
 *   get:
 *     summary: Get a post by slug
 *     tags: [Content]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The post slug
 *     responses:
 *       200:
 *         description: Post details
 *       404:
 *         description: Post not found
 */
router.get('/posts/:slug', getPostBySlug);

export default router;
