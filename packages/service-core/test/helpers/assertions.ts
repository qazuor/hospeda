import { expect } from 'vitest';

/**
 * Asserts that the result contains a FORBIDDEN error code.
 * @template T - The result type, must have an optional error.code property.
 * @param result - The result object to check.
 * @returns void
 */
export function expectForbiddenError<T extends { error?: { code?: string } }>(result: T): void {
    expect(result.error?.code).toBe('FORBIDDEN');
}

/**
 * Asserts that the result contains a VALIDATION_ERROR code.
 * @template T - The result type, must have an optional error.code property.
 * @param result - The result object to check.
 * @returns void
 */
export function expectValidationError<T extends { error?: { code?: string } }>(result: T): void {
    expect(result.error?.code).toBe('VALIDATION_ERROR');
}

/**
 * Asserts that the result contains an INTERNAL_ERROR code.
 * @template T - The result type, must have an optional error.code property.
 * @param result - The result object to check.
 * @returns void
 */
export function expectInternalError<T extends { error?: { code?: string } }>(result: T): void {
    expect(result.error?.code).toBe('INTERNAL_ERROR');
}

/**
 * Asserts that the result contains a NOT_FOUND error code.
 * @template T - The result type, must have an optional error.code property.
 * @param result - The result object to check.
 * @returns void
 */
export function expectNotFoundError<T extends { error?: { code?: string } }>(result: T): void {
    expect(result.error?.code).toBe('NOT_FOUND');
}

/**
 * Asserts that the result is a success: error is undefined and data is defined.
 * @template T - The result type, must have optional data and error properties.
 * @param result - The result object to check.
 * @returns void
 */
export function expectSuccess<T extends { data?: unknown; error?: unknown }>(result: T): void {
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
}

/**
 * Asserts that the result contains an UNAUTHORIZED error code.
 * @template T - The result type, must have an optional error.code property.
 * @param result - The result object to check.
 * @returns void
 */
export function expectUnauthorizedError<T extends { error?: { code?: string } }>(result: T): void {
    expect(result.error?.code).toBe('UNAUTHORIZED');
}
