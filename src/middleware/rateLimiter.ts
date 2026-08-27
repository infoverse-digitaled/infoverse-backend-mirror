import rateLimit from 'express-rate-limit';

// Limiter for sensitive authentication routes
// Increased to 200 - very generous for better UX
// WARNING: Higher limits increase vulnerability to brute force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for bug report / feedback submissions
export const bugReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reports per hour per IP
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many reports from this IP. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// A more general limiter for all other API routes
// Oak API allows 1000 req/min, so we set this very high
// 10000 per 15min = ~667/min which is under Oak's limit but very generous
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
