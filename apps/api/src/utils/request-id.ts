/**
 * Utility function to generate unique request IDs
 */

import { randomUUID } from 'node:crypto';

/**
 * Generate a unique request ID using a cryptographically secure UUID.
 *
 * Uses `crypto.randomUUID()` instead of `Math.random()` to ensure
 * uniqueness and unpredictability across distributed environments.
 *
 * @returns A UUID v4 string suitable for use as a request identifier
 */
export const generateRequestId = (): string => {
    return randomUUID();
};
