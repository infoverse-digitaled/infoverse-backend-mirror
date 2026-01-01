import { Request, Response, RequestHandler } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Enrollment from '../models/Enrollment';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';
import redisClient from '../config/redis';
import { successResponse } from '../middleware/response';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const getUserProfile: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const cacheKey = `user:${userId}`;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
  }
  try {
    if ((redisClient as any).status === 'ready') {
      const cachedProfile = await redisClient.get(cacheKey);
      if (cachedProfile) {
        const parsedCache = JSON.parse(cachedProfile);
        successResponse(res, parsedCache.data, 'Profile retrieved from cache');
        return;
      }
    }

    const profile = await User.findById(userId);
    if (!profile) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if ((redisClient as any).status === 'ready') {
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

export const updateUserProfile: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
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

    if ((redisClient as any).status === 'ready') {
      await redisClient.del(`user:${userId}`);
    }

    successResponse(res, updatedProfile, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const getUserReviews: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const cacheKey = `user:${userId}:reviews`;
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    if ((redisClient as any).status === 'ready') {
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        const parsedCache = JSON.parse(cachedReviews);
        successResponse(res, parsedCache.data, 'Reviews retrieved from cache');
        return;
      }
    }

    const reviews = await Review.find({ userId }).populate('courseId', 'title');
    if (!reviews) {
      throw new HttpError(404, 'No reviews found', 'NOT_FOUND');
    }

    if ((redisClient as any).status === 'ready') {
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

export const getUserEnrollments: RequestHandler = async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const cacheKey = `userEnrollments:${userId}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user ID', 'INVALID_ID');
    }
    if ((redisClient as any).status === 'ready') {
      const cachedEnrollments = await redisClient.get(cacheKey);
      if (cachedEnrollments) {
        const parsedCache = JSON.parse(cachedEnrollments);
        successResponse(res, parsedCache.data, 'Enrollments retrieved from cache');
        return;
      }
    }

    const enrollments = await Enrollment.find({ userId }).populate('courseId');

    if ((redisClient as any).status === 'ready') {
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
