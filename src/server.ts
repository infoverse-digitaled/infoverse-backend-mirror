import express from 'express';
import { createClient } from 'redis';

export const redisClient = createClient();

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis', err);
  }
};

const startServer = (app: express.Application) => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectRedis();
  });
};

export default startServer;
