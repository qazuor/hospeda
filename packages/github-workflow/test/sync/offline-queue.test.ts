/**
 * Tests for offline queue manager
 *
 * @module test/sync/offline-queue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OfflineQueue } from '../../src/sync/offline-queue';
import type { QueuedOperation } from '../../src/sync/types';

describe('OfflineQueue', () => {
	const testQueuePath = join(__dirname, '../fixtures/test-queue.json');

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

	describe('enqueue', () => {
		it('should add operation to queue', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			const operation: QueuedOperation = {
				id: 'test-1',
				type: 'create-issue',
				data: {
					title: 'Test Issue',
					body: 'Test body',
					labels: ['test']
				},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			};

			// Act
			await queue.enqueue(operation);

			// Assert
			const pending = await queue.getPendingOperations();
			expect(pending).toHaveLength(1);
			expect(pending[0].id).toBe('test-1');
		});

		it('should auto-save after enqueue', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			const operation: QueuedOperation = {
				id: 'test-1',
				type: 'create-issue',
				data: { title: 'Test' },
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			};

			// Act
			await queue.enqueue(operation);

			// Assert - verify file was written
			expect(existsSync(testQueuePath)).toBe(true);

			// Load new instance to verify persistence
			const queue2 = new OfflineQueue(testQueuePath);
			await queue2.load();
			const pending = await queue2.getPendingOperations();
			expect(pending).toHaveLength(1);
		});
	});

	describe('getPendingOperations', () => {
		it('should return only pending operations', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			await queue.enqueue({
				id: 'test-2',
				type: 'update-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'completed'
			});

			// Act
			const pending = await queue.getPendingOperations();

			// Assert
			expect(pending).toHaveLength(1);
			expect(pending[0].id).toBe('test-1');
		});

		it('should return empty array when queue is empty', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			// Act
			const pending = await queue.getPendingOperations();

			// Assert
			expect(pending).toHaveLength(0);
		});
	});

	describe('markCompleted', () => {
		it('should mark operation as completed', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			// Act
			await queue.markCompleted('test-1');

			// Assert
			const pending = await queue.getPendingOperations();
			expect(pending).toHaveLength(0);
		});

		it('should throw error if operation not found', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			// Act & Assert
			await expect(queue.markCompleted('nonexistent')).rejects.toThrow('Operation not found');
		});
	});

	describe('markFailed', () => {
		it('should increment attempts and update status', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			// Act
			await queue.markFailed('test-1', 'Network error');

			// Assert
			const operations = await queue.getAllOperations();
			const operation = operations.find(op => op.id === 'test-1');
			expect(operation?.attempts).toBe(1);
			expect(operation?.lastError).toBe('Network error');
			expect(operation?.status).toBe('pending'); // Still pending for retry
		});

		it('should mark as failed after max attempts', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath, { maxAttempts: 3 });
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 2, // Already 2 attempts
				status: 'pending'
			});

			// Act
			await queue.markFailed('test-1', 'Network error');

			// Assert
			const operations = await queue.getAllOperations();
			const operation = operations.find(op => op.id === 'test-1');
			expect(operation?.attempts).toBe(3);
			expect(operation?.status).toBe('failed');
		});
	});

	describe('clear', () => {
		it('should remove all operations', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			await queue.enqueue({
				id: 'test-2',
				type: 'update-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			// Act
			await queue.clear();

			// Assert
			const operations = await queue.getAllOperations();
			expect(operations).toHaveLength(0);
		});
	});

	describe('getStatistics', () => {
		it('should return correct statistics', async () => {
			// Arrange
			const queue = new OfflineQueue(testQueuePath);
			await queue.load();

			await queue.enqueue({
				id: 'test-1',
				type: 'create-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'pending'
			});

			await queue.enqueue({
				id: 'test-2',
				type: 'update-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 0,
				status: 'completed'
			});

			await queue.enqueue({
				id: 'test-3',
				type: 'close-issue',
				data: {},
				createdAt: new Date().toISOString(),
				attempts: 5,
				status: 'failed'
			});

			// Act
			const stats = await queue.getStatistics();

			// Assert
			expect(stats.total).toBe(3);
			expect(stats.pending).toBe(1);
			expect(stats.completed).toBe(1);
			expect(stats.failed).toBe(1);
		});
	});
});
