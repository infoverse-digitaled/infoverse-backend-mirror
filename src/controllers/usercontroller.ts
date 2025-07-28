import { Request, Response } from 'express';
import { createClient } from 'redis';
import User from '../models/User';
import { HttpError } from '../utils/httpError';

const redisClient = createClient();
redisClient
  .connect()
  .then(() => {
    console.log('Connected to Redis');
  })
  .catch((err) => console.error('Redis connection error:', err));

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

  try {
    if (redisClient.isReady) {
      const cachedProfile = await redisClient.get(cacheKey);
      if (cachedProfile) {
        return res.status(200).json(JSON.parse(cachedProfile));
      }
    }

    const profile = await User.findById(userId);
    if (!profile) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    const response = { data: profile };
    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
      } catch (e) {
        console.error('Failed to cache user profile', e);
      }
    }
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const update = req.body;

  try {
    const updatedProfile = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!updatedProfile) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if (redisClient.isReady) {
      try {
        await redisClient.del(`user:${userId}`);
      } catch (e) {
        console.error('Failed to clear user profile cache', e);
      }
    }
    res.status(200).json({ data: updatedProfile });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
