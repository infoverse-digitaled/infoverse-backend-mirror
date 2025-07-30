import { Request, Response } from 'express';
import Review from '../models/Review';
import { HttpError } from '../utils/httpError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const getCourseReviews = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  try {
    const reviews = await Review.find({ courseId }).populate('userId', 'name');
    res.status(200).json({ data: reviews });
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};

export const postReview = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId, rating, comment } = req.body;
  const userId = req.user!.id;
  const { role = req.user!.role } = req.user!;

  try {
    if (role === 'student') {
      const review = await Review.create({ courseId, userId, rating, comment });
      res.status(201).json({ message: 'Review posted successfully', data: review });
    } else {
      throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
    }
  } catch (error) {
    throw new HttpError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
  }
};
