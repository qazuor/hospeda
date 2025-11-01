/**
 * Types for planning synchronization
 *
 * @module sync/types
 */

import type { GitHubClientConfig } from '../types/github.js';

/**
 * Synchronization options for planning sessions
 */
export type SyncOptions = {
    /** Path to planning session directory */
    sessionPath: string;

    /** GitHub client configuration */
    githubConfig: GitHubClientConfig;

    /** Path to tracking.json file (default: .todoLinear/tracking.json) */
    trackingPath?: string;

    /** Preview changes without creating issues (default: false) */
    dryRun?: boolean;

    /** Update existing issues if tasks changed (default: false) */
    updateExisting?: boolean;
};

/**
 * Information about a created issue
 */
export type CreatedIssue = {
    /** Task ID from planning */
    taskId: string;

    /** Task code (e.g., T-003-001) */
    taskCode: string;

    /** GitHub issue number */
    issueNumber: number;

    /** Full URL to GitHub issue */
    issueUrl: string;
};

/**
 * Information about an updated issue
 */
export type UpdatedIssue = {
    /** Task ID from planning */
    taskId: string;

    /** Task code (e.g., T-003-001) */
    taskCode: string;

    /** GitHub issue number */
    issueNumber: number;

    /** List of fields that changed */
    changes: string[];
};

/**
 * Information about a skipped task
 */
export type SkippedTask = {
    /** Task ID from planning */
    taskId: string;

    /** Reason for skipping */
    reason: string;
};

/**
 * Information about a failed task
 */
export type FailedTask = {
    /** Task ID from planning */
    taskId: string;

    /** Error message */
    error: string;
};

/**
 * Sync statistics
 */
export type SyncStatistics = {
    /** Total number of tasks processed */
    totalTasks: number;

    /** Number of issues created */
    created: number;

    /** Number of issues updated */
    updated: number;

    /** Number of tasks skipped */
    skipped: number;

    /** Number of tasks failed */
    failed: number;
};

/**
 * Result of planning synchronization
 */
export type SyncResult = {
    /** Whether sync was successful overall */
    success: boolean;

    /** Planning session ID */
    sessionId: string;

    /** Issues that were created */
    created: CreatedIssue[];

    /** Issues that were updated */
    updated: UpdatedIssue[];

    /** Tasks that were skipped */
    skipped: SkippedTask[];

    /** Tasks that failed */
    failed: FailedTask[];

    /** Summary statistics */
    statistics: SyncStatistics;
};

/**
 * Task changes detected for update
 */
export type TaskChanges = {
    /** Whether title changed */
    titleChanged: boolean;

    /** Whether description changed */
    descriptionChanged: boolean;

    /** Whether status changed */
    statusChanged: boolean;

    /** Whether estimate changed */
    estimateChanged: boolean;

    /** Whether assignee changed */
    assigneeChanged: boolean;

    /** List of changed field names */
    changedFields: string[];
};
