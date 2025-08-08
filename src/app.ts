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
import statusMonitor from 'express-status-monitor'; // <-- 1. IMPORT status monitor
import logger from './utils/logger'; // <-- 2. IMPORT your logger

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// 3. APPLY status monitor as one of the first middleware
// This will create a /status page to monitor your app's health
app.use(statusMonitor());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infoverseDB';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    // Use the logger for important events
    logger.info('Connected to MongoDB');
  })
  .catch((err: Error) => {
    // Use the logger for errors
    logger.error('MongoDB connection error:', err);
  });

startServer(app);

// Middleware setup
setupMiddleware(app);

// Apply the general rate limiter to all routes starting with /api
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
setRoutes(app);

// 4. ADD a health check endpoint for simple uptime checks
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Swagger
setupSwagger(app);

// Global error handler
// You can enhance your errorHandler to use the logger
// For example: logger.error(err.message, { stack: err.stack });
app.use(errorHandler);

export default app;
