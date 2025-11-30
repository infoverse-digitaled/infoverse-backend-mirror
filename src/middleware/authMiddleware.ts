import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import User from '../models/User'; // Import the User model

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
    email: string;
    subscription?: {
      plan: 'free' | 'premium';
      status: 'active' | 'inactive' | 'cancelled';
      expiresAt?: Date;
    };
  };
}

export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; role: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      subscription: user.subscription
        ? {
            plan: user.subscription.plan as 'free' | 'premium',
            status: user.subscription.status as 'active' | 'inactive' | 'cancelled',
            expiresAt: user.subscription.expiresAt,
          }
        : undefined,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token. Please log in again.' },
    });
  }
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; role: string };
    const user = await User.findById(decoded.userId);

    if (user) {
      req.user = {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        subscription: user.subscription
          ? {
              plan: user.subscription.plan as 'free' | 'premium',
              status: user.subscription.status as 'active' | 'inactive' | 'cancelled',
              expiresAt: user.subscription.expiresAt,
            }
          : undefined,
      };
    }
    next();
  } catch (err) {
    // If token is invalid, just proceed as unauthenticated
    next();
  }
};