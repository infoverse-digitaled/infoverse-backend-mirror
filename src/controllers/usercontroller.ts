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
  const cachedProfile = await redisClient.get(`user:${userId}`);
  if (cachedProfile) {
    return res.status(200).json(JSON.parse(cachedProfile));
  }

  const profile = await User.findById(userId);
  if (!profile) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND');
  } else {
    await redisClient.setEx(`user:${userId}`, 3600, JSON.stringify({ data: profile }));
    res.status(200).json({ data: profile });
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const update = req.body;
  const updatedProfile = await User.findByIdAndUpdate(userId, update, { new: true });
  if (!updatedProfile) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND');
  } else {
    await redisClient.del(`user:${userId}`);
    res.status(200).json({ data: updatedProfile });
  }
};
