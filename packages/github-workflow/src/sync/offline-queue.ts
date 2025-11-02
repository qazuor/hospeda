/**
 * Offline queue manager for GitHub operations
 *
 * Manages a queue of operations that failed due to network issues
 * and provides functionality to retry them when connection is restored.
 *
 * @module sync/offline-queue
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '@repo/logger';
import type {
	OfflineQueueOptions,
	OperationStatus,
	QueueStatistics,
	QueuedOperation
} from './types';

/**
 * Default queue options
 */
const DEFAULT_OPTIONS: Required<OfflineQueueOptions> = {
	maxAttempts: 5,
	autoSave: true
};

/**
 * Queue data structure
 */
type QueueData = {
	/** Queue version for compatibility */
	version: string;

	/** Timestamp of last update */
	updatedAt: string;

	/** List of operations */
	operations: QueuedOperation[];
};

/**
 * Offline queue manager
 *
 * Provides functionality to queue operations that fail due to
 * network issues and retry them when connection is restored.
 *
 * @example
 * ```typescript
 * const queue = new OfflineQueue('.github-workflow/offline-queue.json');
 * await queue.load();
 *
 * // Enqueue failed operation
 * await queue.enqueue({
 *   id: 'op-1',
 *   type: 'create-issue',
 *   data: { title: 'Test', body: 'Description' },
 *   createdAt: new Date().toISOString(),
 *   attempts: 0,
 *   status: 'pending'
 * });
 *
 * // Process pending operations
 * const pending = await queue.getPendingOperations();
 * for (const op of pending) {
 *   try {
 *     await processOperation(op);
 *     await queue.markCompleted(op.id);
 *   } catch (error) {
 *     await queue.markFailed(op.id, error.message);
 *   }
 * }
 * ```
 */
export class OfflineQueue {
	private data: QueueData | null = null;
	private loaded = false;
	private readonly options: Required<OfflineQueueOptions>;

	/**
	 * Create a new offline queue instance
	 *
	 * @param filePath - Path to queue file
	 * @param options - Queue options
	 */
	constructor(
		private readonly filePath: string,
		options?: OfflineQueueOptions
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	/**
	 * Load queue from file
	 *
	 * Creates new queue file if it doesn't exist.
	 *
	 * @throws {Error} If loading fails
	 */
	async load(): Promise<void> {
		try {
			if (existsSync(this.filePath)) {
				const content = readFileSync(this.filePath, 'utf-8');
				this.data = JSON.parse(content) as QueueData;
				logger.info({ filePath: this.filePath, operations: this.data.operations.length }, 'Loaded offline queue');
			} else {
				// Initialize empty queue
				this.data = {
					version: '1.0.0',
					updatedAt: new Date().toISOString(),
					operations: []
				};
				logger.info({ filePath: this.filePath }, 'Initialized new offline queue');
			}

			this.loaded = true;
		} catch (error) {
			throw new Error(`Failed to load offline queue: ${(error as Error).message}`);
		}
	}

	/**
	 * Save queue to file
	 *
	 * @throws {Error} If saving fails
	 */
	async save(): Promise<void> {
		this.ensureLoaded();

		try {
			// Ensure directory exists
			const dir = dirname(this.filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// Update timestamp
			this.data!.updatedAt = new Date().toISOString();

			// Write file
			writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');

			logger.debug({ filePath: this.filePath }, 'Saved offline queue');
		} catch (error) {
			throw new Error(`Failed to save offline queue: ${(error as Error).message}`);
		}
	}

	/**
	 * Add operation to queue
	 *
	 * @param operation - Operation to enqueue
	 * @throws {Error} If enqueueing fails
	 */
	async enqueue(operation: QueuedOperation): Promise<void> {
		this.ensureLoaded();

		this.data!.operations.push(operation);

		logger.info(
			{
				operationId: operation.id,
				type: operation.type,
				sessionId: operation.sessionId,
				taskCode: operation.taskCode
			},
			'Enqueued operation'
		);

		if (this.options.autoSave) {
			await this.save();
		}
	}

	/**
	 * Get all pending operations
	 *
	 * @returns List of pending operations
	 */
	async getPendingOperations(): Promise<QueuedOperation[]> {
		this.ensureLoaded();

		return this.data!.operations.filter(op => op.status === 'pending');
	}

	/**
	 * Get all operations
	 *
	 * @returns List of all operations
	 */
	async getAllOperations(): Promise<QueuedOperation[]> {
		this.ensureLoaded();

		return [...this.data!.operations];
	}

	/**
	 * Mark operation as completed
	 *
	 * @param operationId - Operation ID
	 * @throws {Error} If operation not found
	 */
	async markCompleted(operationId: string): Promise<void> {
		this.ensureLoaded();

		const operation = this.data!.operations.find(op => op.id === operationId);
		if (!operation) {
			throw new Error(`Operation not found: ${operationId}`);
		}

		operation.status = 'completed';
		operation.lastAttemptAt = new Date().toISOString();

		logger.info({ operationId }, 'Marked operation as completed');

		if (this.options.autoSave) {
			await this.save();
		}
	}

	/**
	 * Mark operation as failed
	 *
	 * Increments attempt counter and updates status.
	 * If max attempts reached, marks as permanently failed.
	 *
	 * @param operationId - Operation ID
	 * @param errorMessage - Error message
	 * @throws {Error} If operation not found
	 */
	async markFailed(operationId: string, errorMessage: string): Promise<void> {
		this.ensureLoaded();

		const operation = this.data!.operations.find(op => op.id === operationId);
		if (!operation) {
			throw new Error(`Operation not found: ${operationId}`);
		}

		operation.attempts += 1;
		operation.lastError = errorMessage;
		operation.lastAttemptAt = new Date().toISOString();

		// Mark as permanently failed if max attempts reached
		if (operation.attempts >= this.options.maxAttempts) {
			operation.status = 'failed';
			logger.warn(
				{
					operationId,
					attempts: operation.attempts,
					maxAttempts: this.options.maxAttempts,
					error: errorMessage
				},
				'Operation failed permanently'
			);
		} else {
			logger.info(
				{
					operationId,
					attempts: operation.attempts,
					maxAttempts: this.options.maxAttempts,
					error: errorMessage
				},
				'Operation failed, will retry'
			);
		}

		if (this.options.autoSave) {
			await this.save();
		}
	}

	/**
	 * Remove all operations from queue
	 *
	 * @throws {Error} If clearing fails
	 */
	async clear(): Promise<void> {
		this.ensureLoaded();

		const count = this.data!.operations.length;
		this.data!.operations = [];

		logger.info({ count }, 'Cleared offline queue');

		if (this.options.autoSave) {
			await this.save();
		}
	}

	/**
	 * Get queue statistics
	 *
	 * @returns Queue statistics
	 */
	async getStatistics(): Promise<QueueStatistics> {
		this.ensureLoaded();

		const operations = this.data!.operations;

		return {
			total: operations.length,
			pending: operations.filter(op => op.status === 'pending').length,
			completed: operations.filter(op => op.status === 'completed').length,
			failed: operations.filter(op => op.status === 'failed').length
		};
	}

	/**
	 * Ensure queue is loaded
	 *
	 * @throws {Error} If queue not loaded
	 */
	private ensureLoaded(): void {
		if (!this.loaded || !this.data) {
			throw new Error('Queue not loaded. Call load() first.');
		}
	}
}
