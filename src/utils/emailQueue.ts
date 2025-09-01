import { Queue } from 'bullmq';
import config from '../config';
// Use the same Redis connection details as your caching setup
const redisConnection = {
  url: config.redis.url,
  port: config.redis.port,
};
// Create and export the queue for sending emails
export const emailQueue = new Queue('email-sending', { connection: redisConnection });
