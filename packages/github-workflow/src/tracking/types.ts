/**
 * Type definitions for the tracking system
 *
 * This module defines the core types used for tracking planning tasks,
 * code comments, and their synchronization with GitHub Issues.
 *
 * @module tracking/types
 */

/**
 * Type of tracking record
 */
export type TrackingRecordType = 'planning-task' | 'code-comment';

/**
 * Synchronization status
 */
export type SyncStatus = 'pending' | 'synced' | 'updated' | 'failed';

/**
 * Source information for a tracking record
 */
export type TrackingSource = {
    /**
     * Planning session ID (e.g., "P-003")
     */
    sessionId?: string;

    /**
     * Task ID within the session (e.g., "T-003-001")
     */
    taskId?: string;

    /**
     * Code comment identifier
     */
    commentId?: string;

    /**
     * File path for code comments
     */
    filePath?: string;

    /**
     * Line number for code comments
     */
    lineNumber?: number;
};

/**
 * GitHub issue mapping information
 */
export type GitHubMapping = {
    /**
     * GitHub issue number
     */
    issueNumber: number;

    /**
     * Full URL to the GitHub issue
     */
    issueUrl: string;

    /**
     * ISO timestamp when the issue was created
     */
    createdAt: string;

    /**
     * ISO timestamp of the last update
     */
    updatedAt: string;
};

/**
 * Snapshot of task state for change detection
 */
export type TaskSnapshot = {
    /** Task title */
    title: string;
    /** Task description */
    description?: string;
    /** Task status */
    status: string;
    /** Task estimate */
    estimate?: string;
    /** Task assignee */
    assignee?: string;
};

/**
 * Snapshot of comment state for change detection
 */
export type CommentSnapshot = {
    /** Comment content */
    content: string;
    /** File path */
    filePath: string;
    /** Line number */
    lineNumber: number;
    /** Priority level */
    priority?: string;
    /** Assigned user */
    assignee?: string;
    /** Labels/tags */
    labels?: string[];
};

/**
 * Individual tracking record
 */
export type TrackingRecord = {
    /**
     * Unique tracking identifier
     */
    id: string;

    /**
     * Type of record being tracked
     */
    type: TrackingRecordType;

    /**
     * Source information
     */
    source: TrackingSource;

    /**
     * GitHub mapping (if synced)
     */
    github?: GitHubMapping;

    /**
     * Current synchronization status
     */
    status: SyncStatus;

    /**
     * ISO timestamp of last successful sync
     */
    lastSyncedAt?: string;

    /**
     * Number of sync attempts made
     */
    syncAttempts: number;

    /**
     * Last error message (if failed)
     */
    lastError?: string;

    /**
     * ISO timestamp when record was created
     */
    createdAt: string;

    /**
     * ISO timestamp of last modification
     */
    updatedAt: string;

    /**
     * Snapshot of task state (for planning-task type)
     */
    taskSnapshot?: TaskSnapshot;

    /**
     * Snapshot of comment state (for code-comment type)
     */
    commentSnapshot?: CommentSnapshot;
};

/**
 * Statistics about tracking records
 */
export type TrackingMetadata = {
    /**
     * ISO timestamp of last sync operation
     */
    lastSync: string;

    /**
     * Total number of records
     */
    totalRecords: number;

    /**
     * Count of records by status
     */
    byStatus: Record<SyncStatus, number>;
};

/**
 * Complete tracking database structure
 */
export type TrackingDatabase = {
    /**
     * Schema version for migrations
     */
    version: string;

    /**
     * All tracking records
     */
    records: TrackingRecord[];

    /**
     * Aggregate metadata
     */
    metadata: TrackingMetadata;
};

/**
 * Input for creating a new tracking record
 */
export type CreateTrackingRecordInput = Omit<TrackingRecord, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Statistics result
 */
export type TrackingStatistics = {
    /**
     * Total number of records
     */
    total: number;

    /**
     * Count by status
     */
    byStatus: Record<SyncStatus, number>;

    /**
     * Count by type
     */
    byType: Record<TrackingRecordType, number>;

    /**
     * Count by session
     */
    bySession: Record<string, number>;
};
