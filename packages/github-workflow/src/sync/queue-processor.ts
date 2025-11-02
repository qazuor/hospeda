/**
 * Queue processor for offline operations
 *
 * Processes queued operations and handles retries with exponential backoff.
 *
 * @module sync/queue-processor
 */

import { logger } from '@repo/logger';
import type { GitHubClient } from '../core/github-client';
import { OfflineDetector } from './offline-detector';
import type { OfflineQueue } from './offline-queue';
import type { QueuedOperation } from './types';

/**
 * Queue processor options
 */
export type QueueProcessorOptions = {
	/** Maximum retry attempts (default: 5) */
	maxRetries?: number;

	/** Retry delay in milliseconds (default: 1000) */
	retryDelay?: number;

	/** Maximum backoff in milliseconds (default: 60000 = 1 minute) */
	maxBackoff?: number;
};

/**
 * Queue processing result
 */
export type QueueProcessingResult = {
	/** Number of operations processed */
	processed: number;

	/** Number of operations that succeeded */
	succeeded: number;

	/** Number of operations that failed */
	failed: number;

	/** IDs of failed operations */
	failedOperations: string[];
};

/**
 * Default processor options
 */
const DEFAULT_OPTIONS: Required<QueueProcessorOptions> = {
	maxRetries: 5,
	retryDelay: 1000,
	maxBackoff: 60000
};

/**
 * Queue processor
 *
 * Processes pending operations in the offline queue with retry logic.
 *
 * @example
 * ```typescript
 * const queue = new OfflineQueue('.github-workflow/offline-queue.json');
 * await queue.load();
 *
 * const processor = new QueueProcessor(queue, githubClient);
 * const result = await processor.processQueue();
 *
 * console.log(`Processed ${result.processed} operations`);
 * console.log(`Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
 * ```
 */
export class QueueProcessor {
	private readonly options: Required<QueueProcessorOptions>;
	private readonly detector: OfflineDetector;

	/**
	 * Create a new queue processor
	 *
	 * @param queue - Offline queue to process
	 * @param githubClient - GitHub client for operations
	 * @param options - Processor options
	 */
	constructor(
		private readonly queue: OfflineQueue,
		private readonly githubClient: GitHubClient,
		options?: QueueProcessorOptions
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.detector = new OfflineDetector({
			baseDelay: this.options.retryDelay,
			maxBackoff: this.options.maxBackoff,
			maxRetries: this.options.maxRetries
		});
	}

	/**
	 * Process all pending operations in queue
	 *
	 * Attempts to execute each pending operation with retry logic
	 * for network errors.
	 *
	 * @returns Processing result
	 */
	async processQueue(): Promise<QueueProcessingResult> {
		const result: QueueProcessingResult = {
			processed: 0,
			succeeded: 0,
			failed: 0,
			failedOperations: []
		};

		const pendingOperations = await this.queue.getPendingOperations();

		if (pendingOperations.length === 0) {
			logger.info('No pending operations in queue');
			return result;
		}

		logger.info({ count: pendingOperations.length }, 'Processing offline queue');

		for (const operation of pendingOperations) {
			result.processed++;

			const success = await this.processOperation(operation);

			if (success) {
				result.succeeded++;
			} else {
				result.failed++;
				result.failedOperations.push(operation.id);
			}
		}

		logger.info(
			{
				processed: result.processed,
				succeeded: result.succeeded,
				failed: result.failed
			},
			'Queue processing completed'
		);

		return result;
	}

	/**
	 * Process a single operation with retry logic
	 *
	 * @param operation - Operation to process
	 * @returns True if succeeded, false if failed
	 */
	private async processOperation(operation: QueuedOperation): Promise<boolean> {
		let attempts = operation.attempts;

		while (this.detector.shouldRetry(attempts)) {
			try {
				// Execute operation based on type
				await this.executeOperation(operation);

				// Mark as completed
				await this.queue.markCompleted(operation.id);

				logger.info(
					{
						operationId: operation.id,
						type: operation.type,
						attempts: attempts + 1
					},
					'Operation completed successfully'
				);

				return true;
			} catch (error) {
				const errorMessage = (error as Error).message;

				// Check if it's a network error
				if (this.detector.isNetworkError(error)) {
					attempts++;

					logger.warn(
						{
							operationId: operation.id,
							type: operation.type,
							attempts,
							maxRetries: this.options.maxRetries,
							error: errorMessage
						},
						'Network error, will retry'
					);

					// Mark failed with retry
					await this.queue.markFailed(operation.id, errorMessage);

					// Check if we should retry
					if (this.detector.shouldRetry(attempts)) {
						// Calculate backoff and wait
						const delay = this.detector.calculateBackoff(attempts);
						await this.sleep(delay);
						continue; // Retry
					} else {
						// Max retries reached
						logger.error(
							{
								operationId: operation.id,
								type: operation.type,
								attempts,
								error: errorMessage
							},
							'Max retries reached, operation failed'
						);
						return false;
					}
				} else {
					// Non-network error, don't retry
					logger.error(
						{
							operationId: operation.id,
							type: operation.type,
							error: errorMessage
						},
						'Non-network error, not retrying'
					);

					await this.queue.markFailed(operation.id, errorMessage);
					return false;
				}
			}
		}

		return false;
	}

	/**
	 * Execute operation based on type
	 *
	 * @param operation - Operation to execute
	 * @throws {Error} If operation fails
	 */
	private async executeOperation(operation: QueuedOperation): Promise<void> {
		const data = operation.data as any;

		switch (operation.type) {
			case 'create-issue':
				await this.githubClient.createIssue(data);
				break;

			case 'update-issue': {
				// Extract issueNumber and pass rest of data
				const { issueNumber, ...updateData } = data;
				await this.githubClient.updateIssue(issueNumber, updateData);
				break;
			}

			case 'close-issue':
				await this.githubClient.closeIssue(data.issueNumber);
				break;

			case 'add-labels':
				await this.githubClient.addLabels(data.issueNumber, data.labels);
				break;

			case 'link-issues':
				await this.githubClient.linkIssues(data.parentNumber, data.childNumber);
				break;

			default:
				throw new Error(`Unknown operation type: ${operation.type}`);
		}
	}

	/**
	 * Sleep for specified milliseconds
	 *
	 * @param ms - Milliseconds to sleep
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
