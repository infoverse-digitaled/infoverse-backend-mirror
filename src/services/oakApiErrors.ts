import { OakApiError } from './oakApiTypes';

/**
 * Thrown by OakApiService for Oak API/rate-limit failures. A real Error
 * subclass (rather than a plain object) so stack traces survive into
 * logging/error-handling middleware that checks `err.stack`.
 */
export class OakApiRequestError extends Error implements OakApiError {
  statusCode: number;

  error?: string;

  constructor({ message, statusCode, error }: OakApiError) {
    super(message);
    this.name = 'OakApiRequestError';
    this.statusCode = statusCode;
    this.error = error;
  }
}
