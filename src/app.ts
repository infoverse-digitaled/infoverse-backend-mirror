import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import errorHandler from './middleware/errorHandler';
import setupMiddleware from './middleware/index';
import setRoutes from './routes/setRoutes';
import authRoutes from './routes/auth';
import { setupSwagger } from './swagger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infoverseDB';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err: Error) => {
    console.error('MongoDB connection error:', err);
  });

// Middleware setup
setupMiddleware(app);

// Routes
app.use('/api/auth', authRoutes);
setRoutes(app);

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger
setupSwagger(app);

// Global error handler
app.use(errorHandler);

export default app;