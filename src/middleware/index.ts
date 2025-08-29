import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import ratelimiter from 'express-rate-limit';

const setupMiddleware = (app: express.Application) => {
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(helmet());
  const limiter = ratelimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  });

  app.use(limiter);
};

export default setupMiddleware;
