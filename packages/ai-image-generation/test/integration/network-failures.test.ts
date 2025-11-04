/**
 * Integration tests for network failure handling
 *
 * @module test/integration/network-failures
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

describe('Network Failures', () => {
    const testDir = path.join(process.cwd(), 'test-network-output');
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

    describe('Connection Timeout (ETIMEDOUT)', () => {
        it('should handle connection timeout and retry', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-001-timeout');

            const timeoutError = new MockupError(
                'Connection timeout',
                ErrorCode.NETWORK_TIMEOUT,
                true
            );

            // First call times out, second succeeds
            mockRun
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test timeout',
                filename: 'timeout.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockRun).toHaveBeenCalledTimes(2);
        }, 10000);

        it('should fail after multiple consecutive timeouts', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-002-timeout');

            const timeoutError = new MockupError(
                'Connection timeout',
                ErrorCode.NETWORK_TIMEOUT,
                true
            );

            mockRun.mockRejectedValue(timeoutError);

            // Act
            const result = await generator.generate({
                prompt: 'Test timeout fail',
                filename: 'timeout-fail.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);
    });

    describe('Connection Refused (ECONNREFUSED)', () => {
        it('should handle connection refused error', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-003-refused');

            const refusedError = new MockupError('Connection refused', ErrorCode.API_ERROR, true);

            mockRun.mockRejectedValue(refusedError);

            // Act
            const result = await generator.generate({
                prompt: 'Test refused',
                filename: 'refused.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);

        it('should recover from temporary connection refused', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-004-refused-recovery');

            const refusedError = new MockupError('Connection refused', ErrorCode.API_ERROR, true);

            // Refuse once, then succeed
            mockRun
                .mockRejectedValueOnce(refusedError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test recovery',
                filename: 'recovery.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        }, 10000);
    });

    describe('DNS Resolution Failure (ENOTFOUND)', () => {
        it('should handle DNS resolution failure', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-005-dns');

            const dnsError = new MockupError('getaddrinfo ENOTFOUND', ErrorCode.API_ERROR, true);

            mockRun.mockRejectedValue(dnsError);

            // Act
            const result = await generator.generate({
                prompt: 'Test DNS',
                filename: 'dns.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);

        it('should handle DNS error in download phase', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-006-dns-download');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            const dnsError = new MockupError(
                'getaddrinfo ENOTFOUND',
                ErrorCode.DOWNLOAD_FAILED,
                true
            );

            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(dnsError);

            // Act
            const result = await generator.generate({
                prompt: 'Test DNS download',
                filename: 'dns-download.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);
    });

    describe('Partial Response / Broken Pipe', () => {
        it('should handle incomplete response and retry', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-007-partial');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            const downloadError = new MockupError(
                'EPIPE: broken pipe',
                ErrorCode.DOWNLOAD_FAILED,
                true
            );

            // Mock fetch to fail once then succeed
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(downloadError)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: async () => new ArrayBuffer(100)
                } as Response);

            // Act
            const result = await generator.generate({
                prompt: 'Test partial',
                filename: 'partial.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        }, 10000);

        it('should handle stream interruption', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-008-stream');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            const streamError = new MockupError(
                'Stream interrupted',
                ErrorCode.DOWNLOAD_FAILED,
                true
            );

            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(streamError);

            // Act
            const result = await generator.generate({
                prompt: 'Test stream',
                filename: 'stream.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);
    });

    describe('SSL/TLS Errors', () => {
        it('should handle SSL certificate error', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-009-ssl');

            const sslError = new MockupError(
                'unable to verify the first certificate',
                ErrorCode.API_ERROR,
                true
            );

            mockRun.mockRejectedValue(sslError);

            // Act
            const result = await generator.generate({
                prompt: 'Test SSL',
                filename: 'ssl.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);

        it('should handle TLS handshake timeout', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-010-tls');

            const tlsError = new MockupError(
                'TLS handshake timeout',
                ErrorCode.NETWORK_TIMEOUT,
                true
            );

            mockRun.mockRejectedValue(tlsError);

            // Act
            const result = await generator.generate({
                prompt: 'Test TLS',
                filename: 'tls.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);
    });

    describe('HTTP Status Errors', () => {
        it('should handle 500 Internal Server Error in download', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-011-500');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            // Act
            const result = await generator.generate({
                prompt: 'Test 500',
                filename: '500.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);

        it('should handle 503 Service Unavailable in download', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-012-503');

            mockRun.mockResolvedValue(['https://example.com/image.png']);

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable'
            } as Response);

            // Act
            const result = await generator.generate({
                prompt: 'Test 503',
                filename: '503.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000);
    });

    describe('Network Error Recovery', () => {
        it('should successfully complete after transient network issues', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-013-recovery');

            const timeoutError = new MockupError('ETIMEDOUT', ErrorCode.NETWORK_TIMEOUT, true);

            const resetError = new MockupError('ECONNRESET', ErrorCode.API_ERROR, true);

            // Simulate multiple transient failures before success
            mockRun
                .mockRejectedValueOnce(timeoutError)
                .mockRejectedValueOnce(resetError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const result = await generator.generate({
                prompt: 'Test recovery',
                filename: 'recovery.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockRun).toHaveBeenCalledTimes(3);
        }, 15000);

        it('should track generation time accurately despite retries', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-014-timing');

            const networkError = new MockupError('Network error', ErrorCode.API_ERROR, true);

            mockRun
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(['https://example.com/image.png']);

            // Act
            const startTime = Date.now();
            const result = await generator.generate({
                prompt: 'Test timing',
                filename: 'timing.png',
                sessionPath
            });
            const endTime = Date.now();

            // Assert
            expect(result.success).toBe(true);
            expect(result.metadata.generationTime).toBeGreaterThan(0);
            expect(result.metadata.generationTime).toBeLessThanOrEqual(endTime - startTime);
        }, 10000);
    });
});
