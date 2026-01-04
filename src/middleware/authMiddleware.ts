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

/**
 * Middleware to require an active subscription (paid or valid trial)
 * Blocks access if trial has expired and user hasn't paid
 */
export const requireActiveSubscription: RequestHandler = async (req, res, next) => {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const subscription = user.subscription;

  // No subscription at all - block
  if (!subscription) {
    res.status(403).json({
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'A subscription is required to access this content',
        requiresPayment: true,
      },
    });
    return;
  }

  // Active paid subscription - allow
  if (subscription.status === 'active') {
    next();
    return;
  }

  // Trialing - check if trial is still valid
  if (subscription.status === 'trialing') {
    if (subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date()) {
      // Trial still valid
      next();
      return;
    }
    // Trial expired
    res.status(403).json({
      error: {
        code: 'TRIAL_EXPIRED',
        message: 'Your free trial has expired. Please subscribe to continue.',
        requiresPayment: true,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
    return;
  }

  // Any other status (free, cancelled, past_due, inactive) - block
  res.status(403).json({
    error: {
      code: 'SUBSCRIPTION_INACTIVE',
      message: 'Your subscription is not active. Please subscribe to continue.',
      requiresPayment: true,
      status: subscription.status,
    },
  });
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
