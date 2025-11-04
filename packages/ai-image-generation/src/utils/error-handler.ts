/**
 * Error handling and retry logic for mockup generation
 *
 * @module utils/error-handler
 */

import { MockupError } from '../types';

/**
 * Utility class for error handling and retry logic
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Static utility class pattern is intentional for consistency
export class ErrorHandler {
    /**
     * Determines if an error is retryable
     *
     * @param error - The error to check
     * @returns True if error is retryable, false otherwise
     *
     * @example
     * ```ts
     * const error = new MockupError('Timeout', ErrorCode.NETWORK_TIMEOUT, true);
     * if (ErrorHandler.isRetryable(error)) {
     *   // Retry the operation
     * }
     * ```
     */
    static isRetryable(error: MockupError): boolean {
        return error.retryable;
    }

    /**
     * Executes a function with exponential backoff retry logic
     *
     * @param fn - The async function to execute
     * @param maxRetries - Maximum number of retry attempts
     * @returns The result of the function
     *
     * @throws {MockupError} If all retries are exhausted or error is non-retryable
     *
     * @example
     * ```ts
     * const result = await ErrorHandler.withRetry(
     *   async () => {
     *     return await replicateAPI.generate(prompt);
     *   },
     *   3
     * );
     * ```
     */
    static async withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
        let lastError: Error | undefined;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                // Check if it's a MockupError and if it's retryable
                const isMockupError = error instanceof MockupError;
                const isRetryable = isMockupError && error.retryable;

                // If not retryable or last attempt, throw immediately
                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }

                // Calculate exponential backoff: 2^attempt seconds
                const backoffMs = 2 ** attempt * 1000;

                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, backoffMs));

                attempt++;
            }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError;
    }
}
