import { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/httpError';
import logger from '../utils/logger';
import config from '../config';

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

  // For production, send a generic message
  if (config.env === 'production') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    });
  }

  // For development, send a detailed error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
      stack: err.stack,
    },
  });
};

export default errorHandler;
