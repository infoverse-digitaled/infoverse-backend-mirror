// IMPORTANT: Fetch polyfill must be loaded FIRST before any other imports
// This fixes "fetch failed" errors with Google AI SDK on Node.js
import './utils/fetchPolyfill';

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
import User from './models/User';
import { initializeGoogleOAuth } from './config/passport';

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

// Configure CORS with all necessary options
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In production, still allow the request but log it
      console.warn(`CORS request from unknown origin: ${origin}`);
      callback(null, true); // Allow all origins for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Handle OPTIONS requests explicitly for all routes
// Express 5.x requires named wildcards - use '{*path}' instead of '*'
app.options('{*path}', cors());

// Serve static files from the 'public' directory at the root of the project.
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB connection
mongoose
  .connect(config.mongo.uri)
  .then(() => {
    logger.info('Connected to MongoDB');
    // Initialize Google OAuth after MongoDB is ready
    initializeGoogleOAuth(User, config.backendUrl);
  })
  .catch((err: Error) => {
    logger.error('MongoDB connection error:', err);
  });

// Middleware setup
setupMiddleware(app);

// Initialize Passport
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
