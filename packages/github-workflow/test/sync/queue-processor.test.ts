/**
 * Tests for queue processor
 *
 * @module test/sync/queue-processor
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/core/github-client';
import { OfflineQueue } from '../../src/sync/offline-queue';
import { QueueProcessor } from '../../src/sync/queue-processor';
import type { QueuedOperation } from '../../src/sync/types';

describe('QueueProcessor', () => {
    const testQueuePath = join(__dirname, '../fixtures/test-processor-queue.json');

    beforeEach(() => {
        // Ensure fixtures directory exists
        const fixturesDir = join(__dirname, '../fixtures');
        if (!existsSync(fixturesDir)) {
            mkdirSync(fixturesDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test queue file
        if (existsSync(testQueuePath)) {
            rmSync(testQueuePath);
        }
    });

    describe('processQueue', () => {
        it('should process create-issue operations', async () => {
            // Arrange
            const mockGitHub = {
                createIssue: vi.fn().mockResolvedValue(42)
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath);
            await queue.load();
            await queue.clear(); // Clear any existing operations

            const operation: QueuedOperation = {
                id: 'op-1',
                type: 'create-issue',
                data: {
                    title: 'Test Issue',
                    body: 'Description',
                    labels: ['test']
                },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            };

            await queue.enqueue(operation);

            const processor = new QueueProcessor(queue, mockGitHub);

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockGitHub.createIssue).toHaveBeenCalledWith({
                title: 'Test Issue',
                body: 'Description',
                labels: ['test']
            });
        });

        it('should process update-issue operations', async () => {
            // Arrange
            const mockGitHub = {
                updateIssue: vi.fn().mockResolvedValue(undefined)
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath);
            await queue.load();

            const operation: QueuedOperation = {
                id: 'op-1',
                type: 'update-issue',
                data: {
                    issueNumber: 42,
                    title: 'Updated Title'
                },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            };

            await queue.enqueue(operation);

            const processor = new QueueProcessor(queue, mockGitHub);

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(mockGitHub.updateIssue).toHaveBeenCalledWith(42, {
                title: 'Updated Title'
            });
        });

        it('should handle network errors with retry', async () => {
            // Arrange
            const networkError = new Error('Network timeout');
            (networkError as any).code = 'ETIMEDOUT';

            const mockGitHub = {
                createIssue: vi
                    .fn()
                    .mockRejectedValueOnce(networkError) // First attempt fails
                    .mockResolvedValue(42) // Second attempt succeeds
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath);
            await queue.load();

            const operation: QueuedOperation = {
                id: 'op-1',
                type: 'create-issue',
                data: { title: 'Test' },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            };

            await queue.enqueue(operation);

            const processor = new QueueProcessor(queue, mockGitHub, {
                retryDelay: 100 // Short delay for testing
            });

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(1);
            expect(result.succeeded).toBe(1); // Eventually succeeds
            expect(mockGitHub.createIssue).toHaveBeenCalledTimes(2);
        });

        it('should mark operation as failed after max retries', async () => {
            // Arrange
            const networkError = new Error('Network timeout');
            (networkError as any).code = 'ETIMEDOUT';

            const mockGitHub = {
                createIssue: vi.fn().mockRejectedValue(networkError)
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath, { maxAttempts: 3 });
            await queue.load();

            const operation: QueuedOperation = {
                id: 'op-1',
                type: 'create-issue',
                data: { title: 'Test' },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            };

            await queue.enqueue(operation);

            const processor = new QueueProcessor(queue, mockGitHub, {
                maxRetries: 3,
                retryDelay: 10
            });

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(1);
            expect(result.failed).toBe(1);
            expect(mockGitHub.createIssue).toHaveBeenCalledTimes(3);
        });

        it('should process multiple operations', async () => {
            // Arrange
            const mockGitHub = {
                createIssue: vi.fn().mockResolvedValue(42),
                updateIssue: vi.fn().mockResolvedValue(undefined),
                closeIssue: vi.fn().mockResolvedValue(undefined)
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath);
            await queue.load();

            await queue.enqueue({
                id: 'op-1',
                type: 'create-issue',
                data: { title: 'Test 1' },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            });

            await queue.enqueue({
                id: 'op-2',
                type: 'update-issue',
                data: { issueNumber: 42, title: 'Updated' },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            });

            await queue.enqueue({
                id: 'op-3',
                type: 'close-issue',
                data: { issueNumber: 43 },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            });

            const processor = new QueueProcessor(queue, mockGitHub);

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(3);
            expect(result.succeeded).toBe(3);
            expect(result.failed).toBe(0);
        });

        it('should skip non-network errors', async () => {
            // Arrange
            const validationError = new Error('Validation failed');

            const mockGitHub = {
                createIssue: vi.fn().mockRejectedValue(validationError)
            } as unknown as GitHubClient;

            const queue = new OfflineQueue(testQueuePath);
            await queue.load();

            const operation: QueuedOperation = {
                id: 'op-1',
                type: 'create-issue',
                data: { title: 'Test' },
                createdAt: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            };

            await queue.enqueue(operation);

            const processor = new QueueProcessor(queue, mockGitHub);

            // Act
            const result = await processor.processQueue();

            // Assert
            expect(result.processed).toBe(1);
            expect(result.failed).toBe(1);
            expect(mockGitHub.createIssue).toHaveBeenCalledTimes(1); // No retry for non-network errors
        });
    });
});
