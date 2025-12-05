import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import statusMonitor from 'express-status-monitor';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import config from './config';
import errorHandler from './middleware/errorHandler';
import setupMiddleware from './middleware/index';
import setRoutes from './routes/setRoutes';
import { setupSwagger } from './swagger';
import startServer from './server';
import { apiLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';

const app = express();

// Trust proxy for Render/production (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Use express-status-monitor early in the middleware stack.
app.use(statusMonitor());

// Gzip compression for all responses. This should be very early.
app.use(compression());

// Configure CORS to allow requests from the Next.js frontend URL.
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Serve static files from the 'public' directory at the root of the project.
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB connection
mongoose
  .connect(config.mongo.uri)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((err: Error) => {
    logger.error('MongoDB connection error:', err);
  });

// Middleware setup
setupMiddleware(app);

// Apply the general rate limiter to all routes starting with /api/v1
app.use('/api/v1', apiLimiter);

setRoutes(app);

// Add a health check endpoint for simple uptime checks.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Swagger
setupSwagger(app);

// Global error handler
app.use(errorHandler);

// Start server AFTER all middleware and routes are configured
startServer(app);

export default app;
