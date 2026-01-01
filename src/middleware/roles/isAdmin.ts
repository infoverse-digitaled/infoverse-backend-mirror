import { RequestHandler } from 'express';
import { HttpError } from '../../utils/httpError';
import { AuthenticatedRequest } from '../authMiddleware';

export const isAdmin: RequestHandler = (req, _res, next) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'admin') {
    throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
  }
  next();
};
