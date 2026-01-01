import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';
import redisClient from '../config/redis';
import { successResponse } from '../middleware/response';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const getCourseReviews = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const cacheKey = `reviews:${courseId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    if ((redisClient as any).status === 'ready') {
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        const parsedCache = JSON.parse(cachedReviews);
        return successResponse(res, parsedCache.data, 'Reviews retrieved from cache');
      }
    }

    const reviews = await Review.find({ courseId }).populate('userId', 'name');

    if ((redisClient as any).status === 'ready') {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify({ data: reviews }));
      } catch (e) {
        console.error('Failed to cache reviews', e);
      }
    }

    successResponse(res, reviews, 'Reviews retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const postReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.user!.id;
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    const review = await Review.create({ courseId, userId, rating, comment });
    return successResponse(res, review, 'Review posted successfully', 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  const { reviewId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new HttpError(400, 'Invalid review ID', 'INVALID_ID');
    }
    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) {
      throw new HttpError(404, 'Review not found', 'NOT_FOUND');
    }

    if ((redisClient as any).status === 'ready') {
      await redisClient.del(`reviews:${review.courseId}`);
    }

    successResponse(res, [], 'Review deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteOwnReview = async (req: AuthenticatedRequest, res: Response) => {
  const { reviewId } = req.params;
  const userId = req.user!.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new HttpError(400, 'Invalid review ID', 'INVALID_ID');
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      throw new HttpError(404, 'Review not found', 'NOT_FOUND');
    }

    if (String(review.userId) !== userId) {
      throw new HttpError(403, 'Forbidden: You can only delete your own reviews', 'FORBIDDEN');
    }

    await Review.findByIdAndDelete(reviewId);

    if ((redisClient as any).status === 'ready') {
      await redisClient.del(`reviews:${review.courseId}`);
    }

    successResponse(res, [], 'Review deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
