import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import errorHandler from './middleware/errorHandler';
import setupMiddleware from './middleware/index';
import setRoutes from './routes/setRoutes';
import authRoutes from './routes/auth';
import { setupSwagger } from './swagger';
import startServer from './server';
import { apiLimiter } from './middleware/rateLimiter';
import statusMonitor from 'express-status-monitor';
import logger from './utils/logger';
import compression from 'compression';
import cors from 'cors';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Use express-status-monitor early in the middleware stack.
app.use(statusMonitor());

// Gzip compression for all responses. This should be very early.
app.use(compression());

// Configure CORS to allow requests from the Next.js frontend URL.
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Serve static files from the 'public' directory at the root of the project.
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infoverseDB';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((err: Error) => {
    logger.error('MongoDB connection error:', err);
  });

startServer(app);

// Middleware setup
setupMiddleware(app);

// Apply the general rate limiter to all routes starting with /api/v1
app.use('/api/v1', apiLimiter);

// Routes for version 1
app.use('/api/v1/auth', authRoutes);
setRoutes(app);

// Add a health check endpoint for simple uptime checks.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Swagger
setupSwagger(app);

// Global error handler
app.use(errorHandler);

export default app;
