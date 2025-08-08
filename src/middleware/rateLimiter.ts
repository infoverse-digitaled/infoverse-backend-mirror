import rateLimit from 'express-rate-limit';

// Limiter for sensitive authentication routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, 
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts from this IP, please try again after 15 minutes'}},
    standardHeaders: true,
    legacyHeaders: false,
});

// A more general limiter for all other API routes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests from this IP, please try again after 15 minutes'}},
    standardHeaders: true,
    legacyHeaders: false,
});