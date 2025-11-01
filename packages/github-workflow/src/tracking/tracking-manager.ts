/**
 * Tracking manager for planning tasks and code comments
 *
 * This module provides the main interface for managing tracking records,
 * including CRUD operations, queries, and synchronization state management.
 *
 * @module tracking/tracking-manager
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@repo/logger';
import { createBackup, readTrackingFile, writeTrackingFile } from './file-operations';
import type {
    CreateTrackingRecordInput,
    SyncStatus,
    TrackingDatabase,
    TrackingRecord,
    TrackingStatistics
} from './types';

/**
 * Error thrown when tracking operations fail
 */
export class TrackingError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'TrackingError';
    }
}

/**
 * Manager for tracking records
 *
 * Provides high-level operations for managing tracking records with
 * in-memory caching and automatic persistence.
 *
 * @example
 * ```typescript
 * const manager = new TrackingManager('.github-workflow/tracking.json');
 * await manager.load();
 *
 * const record = await manager.addRecord({
 *   type: 'planning-task',
 *   source: { sessionId: 'P-003', taskId: 'T-003-001' },
 *   status: 'pending',
 *   syncAttempts: 0
 * });
 *
 * await manager.save();
 * ```
 */
export class TrackingManager {
    private database: TrackingDatabase | null = null;
    private loaded = false;

    /**
     * Create a new tracking manager
     *
     * @param filePath - Path to tracking file
     */
    constructor(private readonly filePath: string) {}

    /**
     * Load tracking database from file
     *
     * @throws {TrackingError} If loading fails
     */
    async load(): Promise<void> {
        try {
            this.database = await readTrackingFile(this.filePath);
            this.loaded = true;
            logger.info(
                `Loaded tracking database: ${this.filePath} (${this.database.records.length} records)`
            );
        } catch (error) {
            throw new TrackingError(
                `Failed to load tracking database: ${(error as Error).message}`,
                'LOAD_FAILED',
                { filePath: this.filePath, error }
            );
        }
    }

    /**
     * Save tracking database to file
     *
     * Creates a backup before writing.
     *
     * @throws {TrackingError} If saving fails
     */
    async save(): Promise<void> {
        this.ensureLoaded();

        try {
            // Create backup before saving
            await createBackup(this.filePath);

            // Update metadata before saving
            this.updateMetadata();

            // Write to file
            await writeTrackingFile(this.filePath, this.database!);

            logger.info(
                `Saved tracking database: ${this.filePath} (${this.database?.records.length} records)`
            );
        } catch (error) {
            throw new TrackingError(
                `Failed to save tracking database: ${(error as Error).message}`,
                'SAVE_FAILED',
                { filePath: this.filePath, error }
            );
        }
    }

    /**
     * Add a new tracking record
     *
     * @param input - Record data
     * @returns Created tracking record
     * @throws {TrackingError} If creation fails
     */
    async addRecord(input: CreateTrackingRecordInput): Promise<TrackingRecord> {
        this.ensureLoaded();

        try {
            const now = new Date().toISOString();
            const record: TrackingRecord = {
                id: this.generateId(),
                ...input,
                createdAt: now,
                modifiedAt: now
            };

            this.database?.records.push(record);
            this.updateMetadata();

            logger.debug(`Added tracking record: ${record.id} (${record.type})`);

            return record;
        } catch (error) {
            throw new TrackingError(
                `Failed to add tracking record: ${(error as Error).message}`,
                'ADD_FAILED',
                { input, error }
            );
        }
    }

    /**
     * Update an existing tracking record
     *
     * @param id - Record ID
     * @param updates - Fields to update
     * @returns Updated tracking record
     * @throws {TrackingError} If record not found or update fails
     */
    async updateRecord(
        id: string,
        updates: Partial<Omit<TrackingRecord, 'id' | 'createdAt'>>
    ): Promise<TrackingRecord> {
        this.ensureLoaded();

        const record = this.findRecordById(id);

        if (!record) {
            throw new TrackingError('Record not found', 'RECORD_NOT_FOUND', { id });
        }

        try {
            Object.assign(record, updates, {
                modifiedAt: new Date().toISOString()
            });

            this.updateMetadata();

            logger.debug(`Updated tracking record: ${id}`);

            return record;
        } catch (error) {
            throw new TrackingError(
                `Failed to update tracking record: ${(error as Error).message}`,
                'UPDATE_FAILED',
                { id, updates, error }
            );
        }
    }

    /**
     * Delete a tracking record
     *
     * @param id - Record ID
     * @returns True if deleted, false if not found
     */
    async deleteRecord(id: string): Promise<boolean> {
        this.ensureLoaded();

        const index = this.database?.records.findIndex((r) => r.id === id);

        if (index === -1) {
            return false;
        }

        this.database?.records.splice(index, 1);
        this.updateMetadata();

        logger.debug(`Deleted tracking record: ${id}`);

        return true;
    }

    /**
     * Find record by ID
     *
     * @param id - Record ID
     * @returns Tracking record or undefined
     */
    async findById(id: string): Promise<TrackingRecord | undefined> {
        this.ensureLoaded();
        return this.findRecordById(id);
    }

    /**
     * Find record by task ID
     *
     * @param taskId - Task ID
     * @returns Tracking record or undefined
     */
    async findByTaskId(taskId: string): Promise<TrackingRecord | undefined> {
        this.ensureLoaded();
        return this.database?.records.find((r) => r.source.taskId === taskId);
    }

    /**
     * Find record by comment ID
     *
     * @param commentId - Comment ID
     * @returns Tracking record or undefined
     */
    async findByCommentId(commentId: string): Promise<TrackingRecord | undefined> {
        this.ensureLoaded();
        return this.database?.records.find((r) => r.source.commentId === commentId);
    }

    /**
     * Find record by GitHub issue number
     *
     * @param issueNumber - GitHub issue number
     * @returns Tracking record or undefined
     */
    async findByIssueNumber(issueNumber: number): Promise<TrackingRecord | undefined> {
        this.ensureLoaded();
        return this.database?.records.find((r) => r.github?.issueNumber === issueNumber);
    }

    /**
     * Get all records with specific status
     *
     * @param status - Sync status
     * @returns Array of tracking records
     */
    async getRecordsByStatus(status: SyncStatus): Promise<TrackingRecord[]> {
        this.ensureLoaded();
        return this.database?.records.filter((r) => r.status === status);
    }

    /**
     * Get all records for a session
     *
     * @param sessionId - Session ID
     * @returns Array of tracking records
     */
    async getRecordsBySession(sessionId: string): Promise<TrackingRecord[]> {
        this.ensureLoaded();
        return this.database?.records.filter((r) => r.source.sessionId === sessionId);
    }

    /**
     * Mark record as successfully synced
     *
     * @param id - Record ID
     * @param issueNumber - GitHub issue number
     * @param issueUrl - GitHub issue URL
     * @returns Updated tracking record
     * @throws {TrackingError} If record not found
     */
    async markAsSynced(id: string, issueNumber: number, issueUrl: string): Promise<TrackingRecord> {
        this.ensureLoaded();

        const record = this.findRecordById(id);

        if (!record) {
            throw new TrackingError('Record not found', 'RECORD_NOT_FOUND', { id });
        }

        const now = new Date().toISOString();

        record.status = 'synced';
        record.github = {
            issueNumber,
            issueUrl,
            createdAt: record.github?.createdAt ?? now,
            updatedAt: now
        };
        record.lastSyncedAt = now;
        record.syncAttempts += 1;
        record.modifiedAt = now;
        record.lastError = undefined;

        this.updateMetadata();

        logger.info(`Marked record as synced: ${id} -> Issue #${issueNumber} (${issueUrl})`);

        return record;
    }

    /**
     * Mark record as failed
     *
     * @param id - Record ID
     * @param error - Error message
     * @returns Updated tracking record
     * @throws {TrackingError} If record not found
     */
    async markAsFailed(id: string, error: string): Promise<TrackingRecord> {
        this.ensureLoaded();

        const record = this.findRecordById(id);

        if (!record) {
            throw new TrackingError('Record not found', 'RECORD_NOT_FOUND', { id });
        }

        record.status = 'failed';
        record.lastError = error;
        record.syncAttempts += 1;
        record.modifiedAt = new Date().toISOString();

        this.updateMetadata();

        logger.warn(`Marked record as failed: ${id} (attempt ${record.syncAttempts}) - ${error}`);

        return record;
    }

    /**
     * Reset failed records to pending
     *
     * @returns Array of reset records
     */
    async resetPending(): Promise<TrackingRecord[]> {
        this.ensureLoaded();

        const failedRecords = this.database?.records.filter((r) => r.status === 'failed');

        for (const record of failedRecords) {
            record.status = 'pending';
            record.syncAttempts = 0;
            record.lastError = undefined;
            record.modifiedAt = new Date().toISOString();
        }

        this.updateMetadata();

        logger.info(`Reset ${failedRecords.length} failed records to pending`);

        return failedRecords;
    }

    /**
     * Get statistics about tracking records
     *
     * @returns Statistics object
     */
    async getStatistics(): Promise<TrackingStatistics> {
        this.ensureLoaded();

        const stats: TrackingStatistics = {
            total: this.database?.records.length,
            byStatus: {
                pending: 0,
                synced: 0,
                updated: 0,
                failed: 0
            },
            byType: {
                'planning-task': 0,
                'code-comment': 0
            },
            bySession: {}
        };

        for (const record of this.database?.records) {
            stats.byStatus[record.status]++;
            stats.byType[record.type]++;

            if (record.source.sessionId) {
                stats.bySession[record.source.sessionId] =
                    (stats.bySession[record.source.sessionId] ?? 0) + 1;
            }
        }

        return stats;
    }

    /**
     * Update metadata based on current records
     */
    private updateMetadata(): void {
        if (!this.database) return;

        const byStatus: Record<SyncStatus, number> = {
            pending: 0,
            synced: 0,
            updated: 0,
            failed: 0
        };

        for (const record of this.database.records) {
            byStatus[record.status]++;
        }

        this.database.metadata = {
            lastSync: new Date().toISOString(),
            totalRecords: this.database.records.length,
            byStatus
        };
    }

    /**
     * Generate unique ID for tracking record
     */
    private generateId(): string {
        return `track-${randomUUID()}`;
    }

    /**
     * Find record by ID (internal helper)
     */
    private findRecordById(id: string): TrackingRecord | undefined {
        return this.database?.records.find((r) => r.id === id);
    }

    /**
     * Ensure database is loaded
     */
    private ensureLoaded(): void {
        if (!this.loaded || !this.database) {
            throw new TrackingError(
                'Tracking database not loaded. Call load() first.',
                'NOT_LOADED'
            );
        }
    }
}
