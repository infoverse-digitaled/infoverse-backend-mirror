import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Defines the shape of the application's configuration.
 */
interface AppConfig {
  env: string;
  port: number;
  logLevel: string;
  mongo: {
    uri: string;
  };
  redis: {
    url: string;
    port: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  frontendUrl: string;
}

/**
 * Validates the environment variables and returns a typed configuration object.
 * Throws an error if a required variable is missing or invalid.
 */
const validateConfig = (): AppConfig => {
  const {
    NODE_ENV,
    PORT,
    LOG_LEVEL,
    MONGO_URI,
    REDIS_URL,
    REDIS_PORT,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    FRONTEND_URL,
  } = process.env;

  // --- Validation for required variables ---
  if (!MONGO_URI) {
    throw new Error('Missing required environment variable: MONGO_URI');
  }

  if (!JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }

  if (!REDIS_URL) {
    // We will default to a standard local Redis URL if not provided
    console.warn('Warning: REDIS_URL not set. Defaulting to redis://localhost:6379');
  }
  const redisPort = REDIS_PORT ? parseInt(REDIS_PORT, 10) : 6379;
  if (Number.isNaN(redisPort)) {
    // We will default to a standard local Redis URL if not provided
    throw new Error('Invalid REDIS_PORT environment variable: Must be a number.');
  }

  // --- Type conversion and validation ---
  const port = PORT ? parseInt(PORT, 10) : 5000;
  if (Number.isNaN(port)) {
    throw new Error('Invalid PORT environment variable: Must be a number.');
  }

  // --- Return the validated and typed config object ---
  return {
    env: NODE_ENV || 'development',
    port,
    logLevel: LOG_LEVEL || 'info',
    mongo: {
      uri: MONGO_URI,
    },
    redis: {
      url: REDIS_URL || 'redis://localhost:6379',
      port: redisPort,
    },
    jwt: {
      secret: JWT_SECRET,
      expiresIn: JWT_EXPIRES_IN || '1d',
    },
    frontendUrl: FRONTEND_URL || 'http://localhost:3000',
  };
};

// Create and export the configuration object.
const config = validateConfig();

export default config;
