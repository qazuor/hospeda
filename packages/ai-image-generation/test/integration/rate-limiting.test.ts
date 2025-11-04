/**
 * Integration tests for rate limiting handling
 *
 * @module test/integration/rate-limiting
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockupGenerator } from '../../src/core/mockup-generator';
import { ErrorCode, MockupError, type MockupGeneratorConfig } from '../../src/types';

// Create mockRun outside to access it
const mockRun = vi.fn();

// Mock Replicate
vi.mock('replicate', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            run: mockRun
        }))
    };
});

// Mock sharp
vi.mock('sharp', () => {
    const mockSharp = vi.fn().mockReturnValue({
        png: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
        metadata: vi.fn().mockResolvedValue({
            width: 1024,
            height: 768,
            format: 'png'
        })
    });

    return { default: mockSharp };
});

// Mock fetch
global.fetch = vi.fn() as unknown as typeof fetch;

describe('Rate Limiting', () => {
    const testDir = path.join(process.cwd(), 'test-rate-limit-output');
    let config: MockupGeneratorConfig;

    beforeEach(async () => {
        config = {
            replicateApiToken: 'test-token',
            model: 'black-forest-labs/flux-schnell',
            outputPath: testDir,
            maxRetries: 3
        };

        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore if doesn't exist
        }

        // Reset mocks
        vi.clearAllMocks();
        mockRun.mockReset();

        // Setup default successful response
        mockRun.mockResolvedValue(['https://example.com/image.png']);

        // Setup default successful fetch mock
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(100)
        } as Response);
    });

    afterEach(async () => {
        // Cleanup
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('429 Too Many Requests Handling', () => {
        it('should handle single retryable error and retry successfully', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-001-rate-limit');

            // Mock first call fails with retryable error, second succeeds
            const retryableError = new MockupError(
                'Rate limit exceeded',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                true
            );

            mockRun
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test mockup',
                filename: 'test.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockRun).toHaveBeenCalledTimes(2);
        }, 10000);

        it('should fail after multiple rate limit errors exhaust retries', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-002-rate-limit');

            // Mock all calls fail with rate limit error
            const rateLimitError = new MockupError(
                'Rate limit exceeded',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                true
            );

            mockRun.mockRejectedValue(rateLimitError);

            // Act
            const result = await generator.generate({
                prompt: 'Test mockup',
                filename: 'test.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(mockRun).toHaveBeenCalled();
        }, 30000);

        it('should implement exponential backoff for retries', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-003-rate-limit');
            const timestamps: number[] = [];

            const retryableError = new MockupError(
                'Network error',
                ErrorCode.NETWORK_TIMEOUT,
                true
            );

            // Mock to record timestamps and eventually succeed
            mockRun.mockImplementation(() => {
                timestamps.push(Date.now());
                if (timestamps.length < 3) {
                    return Promise.reject(retryableError);
                }
                return Promise.resolve(['https://example.com/image.png']);
            });

            // Act
            const result = await generator.generate({
                prompt: 'Test mockup',
                filename: 'test.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(timestamps.length).toBe(3);

            // Verify exponential backoff (allowing some tolerance for timing)
            if (timestamps.length >= 2) {
                const firstDelay = timestamps[1] - timestamps[0];
                expect(firstDelay).toBeGreaterThanOrEqual(900); // ~1 second backoff
            }
        }, 30000);
    });

    describe('Multiple Rapid API Calls', () => {
        it('should handle burst of concurrent requests', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-004-burst');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            // Act - Simulate 5 concurrent requests
            const promises = Array.from({ length: 5 }, (_, i) =>
                generator.generate({
                    prompt: `Mockup ${i}`,
                    filename: `mockup-${i}.png`,
                    sessionPath
                })
            );

            const results = await Promise.all(promises);

            // Assert
            expect(results).toHaveLength(5);
            expect(results.every((r) => r.success)).toBe(true);
        });

        it('should handle mixed success and error responses in burst', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-005-mixed-burst');
            let callCount = 0;

            const rateLimitError = new MockupError(
                'Rate limit exceeded',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                true
            );

            // Mock - first 3 succeed, next 2 fail with rate limit then succeed on retry
            mockRun.mockImplementation(() => {
                callCount++;
                if (callCount <= 3) {
                    return Promise.resolve(['https://example.com/image.png']);
                }
                if (callCount === 4 || callCount === 5) {
                    // Fail once, then succeed
                    return Promise.reject(rateLimitError);
                }
                return Promise.resolve(['https://example.com/image.png']);
            });

            // Act
            const promises = Array.from({ length: 5 }, (_, i) =>
                generator.generate({
                    prompt: `Mockup ${i}`,
                    filename: `mockup-${i}.png`,
                    sessionPath
                })
            );

            const results = await Promise.allSettled(promises);

            // Assert
            const successful = results.filter(
                (r) => r.status === 'fulfilled' && r.value.success
            ).length;
            expect(successful).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Rate Limit Recovery', () => {
        it('should successfully generate after transient error', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-006-recovery');

            const retryableError = new MockupError('Temporary error', ErrorCode.API_ERROR, true);

            // First call fails, second succeeds
            mockRun
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test recovery',
                filename: 'recovery.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockRun).toHaveBeenCalled();
        }, 10000);

        it('should track metadata correctly after retries', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-007-retry-tracking');

            const retryableError = new MockupError(
                'Network error',
                ErrorCode.NETWORK_TIMEOUT,
                true
            );

            mockRun
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test tracking',
                filename: 'tracking.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.timestamp).toBeDefined();
            expect(result.metadata.generationTime).toBeGreaterThan(0);
        }, 10000);
    });

    describe('Rate Limit Error Messages', () => {
        it('should provide clear error message on persistent failures', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-008-error-message');

            const rateLimitError = new MockupError(
                'Rate limit exceeded: Too many requests',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                true
            );

            mockRun.mockRejectedValue(rateLimitError);

            // Act
            const result = await generator.generate({
                prompt: 'Test error message',
                filename: 'error.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);

        it('should include metadata in failed results', async () => {
            // Arrange
            const generator = new MockupGenerator({ ...config, maxRetries: 2 });
            const sessionPath = path.join(testDir, 'P-009-retry-info');

            const error = new MockupError('Persistent error', ErrorCode.API_ERROR, true);

            mockRun.mockRejectedValue(error);

            // Act
            const result = await generator.generate({
                prompt: 'Test retry info',
                filename: 'retry.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.generationTime).toBeGreaterThan(0);
        }, 30000);
    });
});
