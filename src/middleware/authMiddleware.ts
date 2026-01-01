import { Request, Response, NextFunction, RequestHandler } from 'express';
import { jwtVerify } from 'jose';
import config from '../config';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
    email: string;
    subscription?: {
      plan: 'free' | 'premium';
      status: 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due' | 'free';
      expiresAt?: Date;
      trialEndsAt?: Date;
    };
  };
}

export const authenticateJWT: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = new TextEncoder().encode(config.jwt.secret);
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as { userId: string; role: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      subscription: user.subscription
        ? {
            plan: user.subscription.plan as 'free' | 'premium',
            status: user.subscription.status as 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due' | 'free',
            expiresAt: user.subscription.expiresAt,
            trialEndsAt: user.subscription.trialEndsAt,
          }
        : undefined,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token. Please log in again.' },
    });
    return;
  }
};

export const optionalAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = new TextEncoder().encode(config.jwt.secret);
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as { userId: string; role: string };
    const user = await User.findById(decoded.userId);

    if (user) {
      (req as AuthenticatedRequest).user = {
        id: String(user._id),
        role: user.role,
        name: user.name,
        email: user.email,
        subscription: user.subscription
          ? {
              plan: user.subscription.plan as 'free' | 'premium',
              status: user.subscription.status as 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due' | 'free',
              expiresAt: user.subscription.expiresAt,
              trialEndsAt: user.subscription.trialEndsAt,
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
