// Environment variables are now loaded globally in app.ts
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
  jwtSecret: string; // Shorthand for jwt.secret
  frontendUrl: string;
  backendUrl: string;
  oak: {
    apiBaseUrl: string;
    apiKey: string;
    rateLimit: number;
  };
  paystack: {
    secretKey: string;
  };
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
    OAK_API_BASE_URL,
    OAK_API_KEY,
    OAK_API_RATE_LIMIT,
    PAYSTACK_SECRET_KEY,
  } = process.env;

  // --- Validation for required variables ---
  if (!MONGO_URI) {
    throw new Error('Missing required environment variable: MONGO_URI');
  }

  if (!JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }

  // NOTE: In a real production scenario, we should enforce PAYSTACK_SECRET_KEY presence.
  // For development or if payment is optional, we might make it optional or provide a default/mock.
  // Here we'll treat it as optional for now to avoid breaking existing setups without the key,
  // but strictly strictly speaking for the feature request, it's needed.
  // Let's default to an empty string if missing, but log a warning if needed (logging not shown here).
  const paystackSecretKey = PAYSTACK_SECRET_KEY || '';

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
  const env = NODE_ENV || 'development';
  // Default to 127.0.0.1 (localhost) for development to ensure Redis connectivity
  const redisUrl = REDIS_URL || 'redis://127.0.0.1:6379';

  if (!redisUrl) {
    throw new Error('Missing required environment variable: REDIS_URL (for production)');
  }

  const frontendUrl = FRONTEND_URL || 'http://localhost:3000';
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;

  return {
    env,
    port,
    logLevel: LOG_LEVEL || 'info',
    mongo: {
      uri: MONGO_URI,
    },
    redis: {
      url: redisUrl,
      port: redisPort,
    },
    jwt: {
      secret: JWT_SECRET,
      expiresIn: JWT_EXPIRES_IN || '1d',
    },
    jwtSecret: JWT_SECRET,
    frontendUrl,
    backendUrl,
    oak: {
      apiBaseUrl: OAK_API_BASE_URL || 'https://open-api.thenational.academy/api/v0',
      apiKey: OAK_API_KEY || '',
      rateLimit: OAK_API_RATE_LIMIT ? parseInt(OAK_API_RATE_LIMIT, 10) : 100,
    },
    paystack: {
      secretKey: paystackSecretKey,
    },
  };
};

// Create and export the configuration object.
const config = validateConfig();

export default config;