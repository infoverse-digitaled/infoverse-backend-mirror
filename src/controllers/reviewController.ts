import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';
import redisClient from '../config/redis';
import { successResponse } from '../middleware/response';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const getCourseReviews: RequestHandler = async (req, res) => {
  const { courseId } = req.params;
  const cacheKey = `reviews:${courseId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    if (redisClient.isReady) {
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        const parsedCache = JSON.parse(cachedReviews);
        successResponse(res, parsedCache.data, 'Reviews retrieved from cache');
        return;
      }
    }

    const reviews = await Review.find({ courseId }).populate('userId', 'name');

    if (redisClient.isReady) {
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

export const postReview: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { rating, comment } = req.body;
    const userId = authReq.user!.id;
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new HttpError(400, 'Invalid course ID', 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    const review = await Review.create({ courseId, userId, rating, comment });
    successResponse(res, review, 'Review posted successfully', 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteReview: RequestHandler = async (req, res) => {
  const { reviewId } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new HttpError(400, 'Invalid review ID', 'INVALID_ID');
    }
    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) {
      throw new HttpError(404, 'Review not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      await redisClient.del(`reviews:${review.courseId}`);
    }

    successResponse(res, [], 'Review deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const deleteOwnReview: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { reviewId } = req.params;
  const userId = authReq.user!.id;

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

    if (redisClient.isReady) {
      await redisClient.del(`reviews:${review.courseId}`);
    }

    successResponse(res, [], 'Review deleted successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
