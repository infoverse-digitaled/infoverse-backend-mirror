import { Response, Request, NextFunction } from 'express';
import { HttpError } from '../../utils/httpError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const isStudent = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'student') {
    throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
  }
  next();
};
