import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../utils/httpError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const isAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
  }
  next();
};
