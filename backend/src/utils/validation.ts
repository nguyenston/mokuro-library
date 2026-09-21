/**
 * Validation Utilities
 *
 * Common validation patterns used across routes and services.
 */

import type { FastifyReply } from 'fastify';
import { ErrorResponses } from './errorHandler.js';

/**
 * Type guard to check if value is a non-empty array of strings
 *
 * @param ids - Value to check
 * @returns true if ids is a non-empty string array
 */
export function validateIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string');
}

/**
 * Validates and returns IDs or sends 400 error response
 *
 * @param reply - Fastify reply object
 * @param ids - IDs to validate
 * @returns true if valid, false if error response was sent
 *
 * @example
 * ```typescript
 * if (!requireIds(reply, request.body.ids)) return;
 * // Safe to use request.body.ids as string[]
 * ```
 */
export function requireIds(reply: FastifyReply, ids: unknown): ids is string[] {
  if (!validateIds(ids)) {
    reply.status(400).send(ErrorResponses.badRequest('No valid IDs provided'));
    return false;
  }
  return true;
}

/**
 * Validates that a string is not empty
 *
 * @param value - String to validate
 * @returns true if string is non-empty
 */
export function validateNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates that a value is a positive integer
 *
 * @param value - Value to validate
 * @returns true if value is a positive integer
 */
export function validatePositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validates pagination parameters
 *
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validated and normalized pagination params
 */
export function validatePagination(
  page: unknown,
  limit: unknown
): { page: number; limit: number } {
  const validatedPage = validatePositiveInt(page) ? page : 1;
  const validatedLimit = validatePositiveInt(limit)
    ? Math.min(Math.max(limit, 1), 100) // Clamp between 1 and 100
    : 20; // Default

  return {
    page: validatedPage,
    limit: validatedLimit
  };
}

/**
 * Validates boolean query parameter
 *
 * @param value - Query parameter value
 * @param defaultValue - Default if value is undefined
 * @returns Parsed boolean value
 */
export function validateBooleanParam(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined) return defaultValue;
  return value !== 'false' && value !== '0';
}

/**
 * Validates enum value
 *
 * @param value - Value to validate
 * @param allowedValues - Array of allowed values
 * @param defaultValue - Default value if validation fails
 * @returns Validated value or default
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  if (typeof value === 'string' && allowedValues.includes(value as T)) {
    return value as T;
  }
  return defaultValue;
}
