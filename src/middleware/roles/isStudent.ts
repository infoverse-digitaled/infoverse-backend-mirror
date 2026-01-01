import { RequestHandler } from 'express';
import { HttpError } from '../../utils/httpError';
import { AuthenticatedRequest } from '../authMiddleware';

export const isStudent: RequestHandler = (req, _res, next) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'student') {
    throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
  }
  next();
};
