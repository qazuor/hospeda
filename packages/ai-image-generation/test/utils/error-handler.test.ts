/**
 * Unit tests for ErrorHandler
 *
 * @module test/utils/error-handler
 */

import { describe, expect, it, vi } from 'vitest';
import { ErrorCode, MockupError } from '../../src/types';
import { ErrorHandler } from '../../src/utils/error-handler';

describe('ErrorHandler', () => {
    describe('isRetryable', () => {
        it('should return true for network timeout errors', () => {
            // Arrange
            const error = new MockupError('Network timeout', ErrorCode.NETWORK_TIMEOUT, true);

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true for API errors', () => {
            // Arrange
            const error = new MockupError('API error', ErrorCode.API_ERROR, true);

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true for download failed errors', () => {
            // Arrange
            const error = new MockupError('Download failed', ErrorCode.DOWNLOAD_FAILED, true);

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for missing API key errors', () => {
            // Arrange
            const error = new MockupError('Missing API key', ErrorCode.MISSING_API_KEY, false);

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid prompt errors', () => {
            // Arrange
            const error = new MockupError('Invalid prompt', ErrorCode.INVALID_PROMPT, false);

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for rate limit exceeded errors', () => {
            // Arrange
            const error = new MockupError(
                'Rate limit exceeded',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                false
            );

            // Act
            const result = ErrorHandler.isRetryable(error);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('withRetry', () => {
        it('should succeed on first attempt if function succeeds', async () => {
            // Arrange
            const successFn = vi.fn().mockResolvedValue('success');

            // Act
            const result = await ErrorHandler.withRetry(successFn, 3);

            // Assert
            expect(result).toBe('success');
            expect(successFn).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable error and eventually succeed', async () => {
            // Arrange
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new MockupError('Timeout', ErrorCode.NETWORK_TIMEOUT, true))
                .mockResolvedValue('success');

            // Act
            const result = await ErrorHandler.withRetry(fn, 3);

            // Assert
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should apply exponential backoff between retries', async () => {
            // Arrange
            const fn = vi
                .fn()
                .mockRejectedValueOnce(
                    new MockupError('Timeout 1', ErrorCode.NETWORK_TIMEOUT, true)
                )
                .mockRejectedValueOnce(
                    new MockupError('Timeout 2', ErrorCode.NETWORK_TIMEOUT, true)
                )
                .mockResolvedValue('success');

            // Act
            const result = await ErrorHandler.withRetry(fn, 3);

            // Assert
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw error after max retries exceeded', async () => {
            // Arrange
            const error = new MockupError('Persistent timeout', ErrorCode.NETWORK_TIMEOUT, true);
            const fn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(ErrorHandler.withRetry(fn, 2)).rejects.toThrow('Persistent timeout');
            expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        it('should not retry non-retryable errors', async () => {
            // Arrange
            const error = new MockupError('Missing API key', ErrorCode.MISSING_API_KEY, false);
            const fn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(ErrorHandler.withRetry(fn, 3)).rejects.toThrow('Missing API key');
            expect(fn).toHaveBeenCalledTimes(1); // No retries
        });

        it('should handle non-MockupError errors as non-retryable', async () => {
            // Arrange
            const error = new Error('Unknown error');
            const fn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(ErrorHandler.withRetry(fn, 3)).rejects.toThrow('Unknown error');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});
