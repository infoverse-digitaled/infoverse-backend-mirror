import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';
import { redisClient } from '../server';

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
    if (redisClient.isReady) {
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        return res.status(200).json(JSON.parse(cachedReviews));
      }
    }

    const reviews = await Review.find({ courseId }).populate('userId', 'name');
    const response = { data: reviews };

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
      } catch (e) {
        console.error('Failed to cache reviews', e);
      }
    }

    res.status(200).json(response);
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
    return res.status(201).json({ message: 'Review posted successfully', data: review });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
