import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/httpError';

// Extend Request inline
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const isInstructor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'instructor') {
    throw new HttpError(403, 'Only instructors allowed', 'FORBIDDEN');
  }
  next();
};
