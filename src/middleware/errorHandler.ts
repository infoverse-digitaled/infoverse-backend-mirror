import { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/httpError';
import logger from '../utils/logger';
import config from '../config';

// _next must stay unused: Express detects error-handling middleware by
// function arity (exactly 4 params), so dropping it would stop this from
// being recognized as an error handler at all.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error(err.message, { stack: err.stack });

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Handle OakApiError and similar errors with statusCode
  if (err.statusCode && typeof err.statusCode === 'number') {
    const { statusCode } = err;
    let code = 'API_ERROR';
    if (statusCode === 404) code = 'NOT_FOUND';
    else if (statusCode === 429) code = 'RATE_LIMIT_EXCEEDED';
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message || 'An error occurred',
      },
    });
  }

  // Handle database connection timeouts specifically
  if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message:
          'The server is currently unable to connect to the database. Please try again in a few minutes.',
      },
    });
  }

  // For production, send a generic message
  if (config.env === 'production') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong. Please try again later.',
      },
    });
  }

  // For development, send a detailed error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
      stack: err.stack,
    },
  });
};

export default errorHandler;
