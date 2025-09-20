import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Enrollment from '../models/Enrollment';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';
import { redisClient } from '../server';
import { successResponse } from '../middleware/response';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const cacheKey = `user:${userId}`;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
  }
  try {
    if (redisClient.isReady) {
      const cachedProfile = await redisClient.get(cacheKey);
      if (cachedProfile) {
        const parsedCache = JSON.parse(cachedProfile);
        return successResponse(res, parsedCache.data, 'Profile retrieved from cache');
      }
    }

    const profile = await User.findById(userId);
    if (!profile) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify({ data: profile }));
      } catch (e) {
        console.error('Failed to cache user profile', e);
      }
    }
    successResponse(res, profile, 'Profile retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, email, currentPassword, newPassword } = req.body;
  const update: { [key: string]: any } = {};

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }

    // Handle password change
    if (newPassword && currentPassword) {
      const user = await User.findById(userId).select('+passwordHash');
      if (!user) {
        throw new HttpError(404, 'User not found', 'NOT_FOUND');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash!);
      if (!isMatch) {
        throw new HttpError(401, 'Incorrect current password', 'UNAUTHORIZED');
      }
      update.passwordHash = await bcrypt.hash(newPassword, 10);
    } else if (newPassword || currentPassword) {
      throw new HttpError(
        400,
        'Both current and new password are required to change password',
        'BAD_REQUEST',
      );
    }

    // Handle other profile updates
    if (name) update.name = name;
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        throw new HttpError(400, 'EMAIL_EXISTS', 'Email already in use');
      }
      update.email = email;
    }

    const updatedProfile = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!updatedProfile) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      await redisClient.del(`user:${userId}`);
    }

    successResponse(res, updatedProfile, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getUserReviews = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const cacheKey = `user:${userId}:reviews`;
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    if (redisClient.isReady) {
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        const parsedCache = JSON.parse(cachedReviews);
        return successResponse(res, parsedCache.data, 'Reviews retrieved from cache');
      }
    }

    const reviews = await Review.find({ userId }).populate('courseId', 'title');
    if (!reviews) {
      throw new HttpError(404, 'No reviews found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify({ data: reviews }));
      } catch (e) {
        console.error('Failed to cache user reviews', e);
      }
    }
    successResponse(res, reviews, 'Reviews retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getUserEnrollments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const cacheKey = `userEnrollments:${userId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    if (redisClient.isReady) {
      const cachedEnrollments = await redisClient.get(cacheKey);
      if (cachedEnrollments) {
        const parsedCache = JSON.parse(cachedEnrollments);
        return successResponse(res, parsedCache.data, 'Enrollments retrieved from cache');
      }
    }

    const enrollments = await Enrollment.find({ userId }).populate('courseId');

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify({ data: enrollments }));
      } catch (e) {
        console.error('Failed to cache user enrollments', e);
      }
    }
    successResponse(res, enrollments, 'Enrollments retrieved successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
