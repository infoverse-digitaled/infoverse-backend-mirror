import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';

// NOTE: Rate limiting is handled by rateLimiter.ts middleware
// Do NOT add duplicate rate limiter here

const setupMiddleware = (app: express.Application) => {
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(helmet());
};

export default setupMiddleware;
