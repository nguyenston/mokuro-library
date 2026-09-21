/**
 * Error Handling Utilities
 *
 * Centralized error handling for consistent API responses across all routes.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { HttpError } from '../types/error';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Handles route errors with consistent logging and response format
 *
 * @param fastify - Fastify instance for logging
 * @param reply - Fastify reply object
 * @param error - The error that occurred
 * @param context - Context description for logging (e.g., 'Error deleting series')
 * @param defaultMessage - Default message if error doesn't have one
 * @returns FastifyReply with appropriate error response
 *
 * @example
 * ```typescript
 * try {
 *   await someDangerousOperation();
 * } catch (error) {
 *   return handleRouteError(
 *     fastify,
 *     reply,
 *     error,
 *     'Error during dangerous operation',
 *     'Failed to complete operation'
 *   );
 * }
 * ```
 */
export function handleRouteError(
  fastify: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
  context: string,
  defaultMessage = 'An unexpected error occurred'
): FastifyReply {
  const httpError = error as HttpError;
  const statusCode = httpError.statusCode ?? 500;
  const message = error instanceof Error ? error.message : defaultMessage;

  // For client errors (4xx), return immediately without logging
  if (statusCode < 500) {
    return reply.status(statusCode).send({ message });
  }

  // For server errors (5xx), log and return structured response
  fastify.log.error({ err: error }, context);
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message
  });
}

/**
 * Standard error response builders
 */
export const ErrorResponses = {
  notFound: (message: string): ErrorResponse => ({
    statusCode: 404,
    error: 'Not Found',
    message
  }),

  forbidden: (message: string): ErrorResponse => ({
    statusCode: 403,
    error: 'Forbidden',
    message
  }),

  badRequest: (message: string): ErrorResponse => ({
    statusCode: 400,
    error: 'Bad Request',
    message
  }),

  unauthorized: (message: string): ErrorResponse => ({
    statusCode: 401,
    error: 'Unauthorized',
    message
  }),

  serverError: (message: string): ErrorResponse => ({
    statusCode: 500,
    error: 'Internal Server Error',
    message
  }),

  conflict: (message: string): ErrorResponse => ({
    statusCode: 409,
    error: 'Conflict',
    message
  })
};
