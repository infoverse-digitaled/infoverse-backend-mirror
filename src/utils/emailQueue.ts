import { Queue } from 'bullmq';

// Use the same Redis connection details as your caching setup
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

// Create and export the queue for sending emails
export const emailQueue = new Queue('email-sending', { connection: redisConnection });
