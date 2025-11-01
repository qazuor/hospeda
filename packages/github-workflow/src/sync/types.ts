/**
 * Types for planning and TODO synchronization
 *
 * @module sync/types
 */

import type { CommentType } from '../parsers/types.js';
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

/**
 * Synchronization options for TODO comments
 */
export type TodoSyncOptions = {
    /** Directory to scan for code comments */
    baseDir: string;

    /** Glob patterns to include (defaults to common code file patterns) */
    include?: string[];

    /** Glob patterns to exclude (defaults to node_modules, dist, .git) */
    exclude?: string[];

    /** Types of comments to sync (defaults to TODO, HACK, DEBUG) */
    commentTypes?: CommentType[];

    /** GitHub client configuration */
    githubConfig: GitHubClientConfig;

    /** Path to tracking.json file (default: .todoLinear/tracking.json) */
    trackingPath?: string;

    /** Preview changes without creating issues (default: false) */
    dryRun?: boolean;

    /** Update existing issues if comments changed (default: false) */
    updateExisting?: boolean;

    /** Close issues for removed comments (default: false) */
    closeRemoved?: boolean;
};

/**
 * Information about a created TODO issue
 */
export type CreatedTodoIssue = {
    /** Comment ID from code */
    commentId: string;

    /** Comment type (TODO, HACK, DEBUG) */
    type: CommentType;

    /** File path where comment appears */
    filePath: string;

    /** Line number of comment */
    lineNumber: number;

    /** GitHub issue number */
    issueNumber: number;

    /** Full URL to GitHub issue */
    issueUrl: string;
};

/**
 * Information about an updated TODO issue
 */
export type UpdatedTodoIssue = {
    /** Comment ID from code */
    commentId: string;

    /** GitHub issue number */
    issueNumber: number;

    /** List of fields that changed */
    changes: string[];
};

/**
 * Information about a closed TODO issue
 */
export type ClosedTodoIssue = {
    /** Comment ID from code */
    commentId: string;

    /** GitHub issue number */
    issueNumber: number;

    /** Reason for closing */
    reason: string;
};

/**
 * Information about a skipped TODO
 */
export type SkippedTodo = {
    /** Comment ID from code */
    commentId: string;

    /** Reason for skipping */
    reason: string;
};

/**
 * Information about a failed TODO
 */
export type FailedTodo = {
    /** Comment ID from code */
    commentId: string;

    /** Error message */
    error: string;
};

/**
 * TODO sync statistics
 */
export type TodoSyncStatistics = {
    /** Total number of comments processed */
    totalComments: number;

    /** Number of issues created */
    created: number;

    /** Number of issues updated */
    updated: number;

    /** Number of issues closed */
    closed: number;

    /** Number of comments skipped */
    skipped: number;

    /** Number of comments failed */
    failed: number;
};

/**
 * Result of TODO synchronization
 */
export type TodoSyncResult = {
    /** Whether sync was successful overall */
    success: boolean;

    /** Scan statistics */
    scanned: {
        /** Number of files scanned */
        filesScanned: number;

        /** Number of comments found */
        commentsFound: number;
    };

    /** Issues that were created */
    created: CreatedTodoIssue[];

    /** Issues that were updated */
    updated: UpdatedTodoIssue[];

    /** Issues that were closed */
    closed: ClosedTodoIssue[];

    /** Comments that were skipped */
    skipped: SkippedTodo[];

    /** Comments that failed */
    failed: FailedTodo[];

    /** Summary statistics */
    statistics: TodoSyncStatistics;
};

/**
 * Comment changes detected for update
 */
export type CommentChanges = {
    /** Whether content changed */
    contentChanged: boolean;

    /** Whether file path changed */
    filePathChanged: boolean;

    /** Whether line number changed */
    lineNumberChanged: boolean;

    /** Whether priority changed */
    priorityChanged: boolean;

    /** Whether assignee changed */
    assigneeChanged: boolean;

    /** Whether labels changed */
    labelsChanged: boolean;

    /** List of changed field names */
    changedFields: string[];
};
