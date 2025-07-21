import { Request, Response } from 'express';
import User from '../models/User';
import { HttpError } from '../utils/httpError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = await User.findById(userId);
  if (!profile) {
    throw new HttpError(404, 'User not found', 'NOT_FOUND');
  } else {
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
    res.status(200).json({ data: updatedProfile });
  }
};
