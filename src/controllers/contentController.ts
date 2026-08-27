import { Request, Response, NextFunction } from 'express';
import BlogPost from '../models/BlogPost';
import { HttpError } from '../utils/httpError';
import { successResponse } from '../middleware/response';
import redisClient from '../config/redis';

// Extend Request to include user info from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Get all published posts (public)
 * GET /api/v1/content/posts
 * Query params: type (BLOG | NURTURED), page, limit
 */
export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: { published: boolean; type?: string } = { published: true };
    if (type && ['BLOG', 'NURTURED'].includes(type as string)) {
      query.type = type as string;
    }

    // Check cache
    const cacheKey = `posts:${JSON.stringify(query)}:${pageNum}:${limitNum}`;
    if (redisClient.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return successResponse(res, JSON.parse(cached), 'Posts retrieved from cache');
      }
    }

    // Fetch posts
    const [posts, total] = await Promise.all([
      BlogPost.find(query)
        .select('title slug excerpt featuredImage type publishedAt')
        .populate('author', 'name')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      BlogPost.countDocuments(query),
    ]);

    const result = {
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache for 1 hour
    if (redisClient.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
    }

    return successResponse(res, result, 'Posts retrieved successfully');
  } catch (err) {
    return next(err);
  }
};

/**
 * Get a single post by slug (public)
 * GET /api/v1/content/posts/:slug
 */
export const getPostBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    // Check cache
    const cacheKey = `post:${slug}`;
    if (redisClient.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return successResponse(res, JSON.parse(cached), 'Post retrieved from cache');
      }
    }

    const post = await BlogPost.findOne({ slug, published: true }).populate('author', 'name');

    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
    }

    // Cache for 1 hour
    if (redisClient.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(post));
    }

    return successResponse(res, post, 'Post retrieved successfully');
  } catch (err) {
    return next(err);
  }
};

/**
 * Create a new post (admin only)
 * POST /api/v1/admin/content
 */
export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { title, slug, content, excerpt, featuredImage, type, published } = req.body;

    if (!title || !slug || !content || !type) {
      throw new HttpError(400, 'MISSING_FIELDS', 'title, slug, content, and type are required.');
    }

    // Check if slug is unique
    const existingPost = await BlogPost.findOne({ slug: slug.toLowerCase() });
    if (existingPost) {
      throw new HttpError(409, 'SLUG_EXISTS', 'A post with this slug already exists.');
    }

    const post = await BlogPost.create({
      title,
      slug: slug.toLowerCase(),
      content,
      excerpt: excerpt || content.substring(0, 200),
      featuredImage,
      type,
      published: published || false,
      publishedAt: published ? new Date() : undefined,
      author: user?.id,
    });

    // Clear cache
    if (redisClient.isReady) {
      const keys = await redisClient.keys('posts:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    successResponse(res, post, 'Post created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update a post (admin only)
 * PUT /api/v1/admin/content/:id
 */
export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, slug, content, excerpt, featuredImage, type, published } = req.body;

    const post = await BlogPost.findById(id);
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
    }

    // Check slug uniqueness if changing
    if (slug && slug.toLowerCase() !== post.slug) {
      const existingPost = await BlogPost.findOne({ slug: slug.toLowerCase() });
      if (existingPost) {
        throw new HttpError(409, 'SLUG_EXISTS', 'A post with this slug already exists.');
      }
    }

    // Update fields
    if (title) post.title = title;
    if (slug) post.slug = slug.toLowerCase();
    if (content) post.content = content;
    if (excerpt !== undefined) post.excerpt = excerpt;
    if (featuredImage !== undefined) post.featuredImage = featuredImage;
    if (type) post.type = type;
    if (typeof published === 'boolean') {
      post.published = published;
      if (published && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    await post.save();

    // Clear cache
    if (redisClient.isReady) {
      const keys = await redisClient.keys('posts:*');
      await redisClient.del(`post:${post.slug}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    successResponse(res, post, 'Post updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a post (admin only)
 * DELETE /api/v1/admin/content/:id
 */
export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const post = await BlogPost.findByIdAndDelete(id);
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
    }

    // Clear cache
    if (redisClient.isReady) {
      const keys = await redisClient.keys('posts:*');
      await redisClient.del(`post:${post.slug}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    successResponse(res, null, 'Post deleted successfully');
  } catch (err) {
    next(err);
  }
};
