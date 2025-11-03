/**
 * Tests for offline connectivity detector
 *
 * @module test/sync/offline-detector
 */

import { describe, expect, it } from 'vitest';
import { OfflineDetector } from '../../src/sync/offline-detector';

describe('OfflineDetector', () => {
    describe('isNetworkError', () => {
        it('should detect ENOTFOUND error', () => {
            // Arrange
            const detector = new OfflineDetector();
            const error = new Error('getaddrinfo ENOTFOUND api.github.com');
            (error as any).code = 'ENOTFOUND';

            // Act
            const result = detector.isNetworkError(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should detect ECONNREFUSED error', () => {
            // Arrange
            const detector = new OfflineDetector();
            const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
            (error as any).code = 'ECONNREFUSED';

            // Act
            const result = detector.isNetworkError(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should detect ETIMEDOUT error', () => {
            // Arrange
            const detector = new OfflineDetector();
            const error = new Error('Socket timeout');
            (error as any).code = 'ETIMEDOUT';

            // Act
            const result = detector.isNetworkError(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should detect network timeout in message', () => {
            // Arrange
            const detector = new OfflineDetector();
            const error = new Error('Network request failed: timeout');

            // Act
            const result = detector.isNetworkError(error);

            // Assert
            expect(result).toBe(true);
        });

        it('should not detect non-network errors', () => {
            // Arrange
            const detector = new OfflineDetector();
            const error = new Error('Validation failed');

            // Act
            const result = detector.isNetworkError(error);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('calculateBackoff', () => {
        it('should calculate exponential backoff', () => {
            // Arrange
            const detector = new OfflineDetector();

            // Act & Assert - expect values within ±10% jitter
            const delay0 = detector.calculateBackoff(0);
            const delay1 = detector.calculateBackoff(1);
            const delay2 = detector.calculateBackoff(2);
            const delay3 = detector.calculateBackoff(3);

            expect(delay0).toBeGreaterThanOrEqual(900); // 1000 * 0.9
            expect(delay0).toBeLessThanOrEqual(1100); // 1000 * 1.1

            expect(delay1).toBeGreaterThanOrEqual(1800); // 2000 * 0.9
            expect(delay1).toBeLessThanOrEqual(2200); // 2000 * 1.1

            expect(delay2).toBeGreaterThanOrEqual(3600); // 4000 * 0.9
            expect(delay2).toBeLessThanOrEqual(4400); // 4000 * 1.1

            expect(delay3).toBeGreaterThanOrEqual(7200); // 8000 * 0.9
            expect(delay3).toBeLessThanOrEqual(8800); // 8000 * 1.1
        });

        it('should cap backoff at maximum', () => {
            // Arrange
            const detector = new OfflineDetector({ maxBackoff: 10000 });

            // Act & Assert - expect capped value within ±10% jitter
            const delay = detector.calculateBackoff(10);
            expect(delay).toBeGreaterThanOrEqual(9000); // 10000 * 0.9
            expect(delay).toBeLessThanOrEqual(11000); // 10000 * 1.1
        });

        it('should respect base delay', () => {
            // Arrange
            const detector = new OfflineDetector({ baseDelay: 2000 });

            // Act & Assert - expect values within ±10% jitter
            const delay0 = detector.calculateBackoff(0);
            const delay1 = detector.calculateBackoff(1);

            expect(delay0).toBeGreaterThanOrEqual(1800); // 2000 * 0.9
            expect(delay0).toBeLessThanOrEqual(2200); // 2000 * 1.1

            expect(delay1).toBeGreaterThanOrEqual(3600); // 4000 * 0.9
            expect(delay1).toBeLessThanOrEqual(4400); // 4000 * 1.1
        });
    });

    describe('shouldRetry', () => {
        it('should allow retry within max attempts', () => {
            // Arrange
            const detector = new OfflineDetector({ maxRetries: 5 });

            // Act & Assert
            expect(detector.shouldRetry(0)).toBe(true);
            expect(detector.shouldRetry(4)).toBe(true);
        });

        it('should not allow retry after max attempts', () => {
            // Arrange
            const detector = new OfflineDetector({ maxRetries: 5 });

            // Act & Assert
            expect(detector.shouldRetry(5)).toBe(false);
            expect(detector.shouldRetry(6)).toBe(false);
        });
    });
});
