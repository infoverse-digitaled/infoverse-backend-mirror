import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';

// BullMQ v5 requires maxRetriesPerRequest: null on the IORedis connection
export const redisConnection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

// Create and export the queue for sending emails
export const emailQueue = new Queue('email-sending', { connection: redisConnection });
