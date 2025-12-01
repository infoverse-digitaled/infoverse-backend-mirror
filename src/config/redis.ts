import { createClient, RedisClientType } from 'redis';
import config from './index';
import logger from '../utils/logger';

/**
 * Redis client instance for caching and session management.
 * Uses redis library for compatibility with existing controller code.
 */
export const redisClient: RedisClientType = createClient({
  url: config.redis.url,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('❌ Redis connection failed after 10 retries');
        logger.error('💡 Redis timeout? Try running: brew services restart redis');
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis client error:', err);
  if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
    logger.error('💡 Redis timeout? Try running: brew services restart redis');
  }
});

redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});

// Connect the client
redisClient.connect().catch((err) => {
  logger.error('❌ Failed to connect to Redis:', err);
  logger.error('💡 Redis timeout? Try running: brew services restart redis');
});

export default redisClient;
