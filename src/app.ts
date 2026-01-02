import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
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
import passport from 'passport';

const app = express();

// Trust proxy for Render/production (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Gzip compression for all responses. This should be very early.
app.use(compression());

// Configure CORS to allow requests from the Next.js frontend URL.
// Support multiple origins for development (localhost) and production (Netlify)
const allowedOrigins = [
  config.frontendUrl,
  'https://infoverse-ed.netlify.app',
  'https://infoversedigitaleducation.net',
  'http://localhost:3000', // Development
  'http://localhost:3001', // Development (alternate port)
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// Initialize Passport for Google OAuth
app.use(passport.initialize());

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
