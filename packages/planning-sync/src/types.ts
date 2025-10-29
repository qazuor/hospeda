/**
 * Planning Sync Types
 * Simple types for Linear synchronization of planning sessions
 */

/**
 * Status of a planning task
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * A single task from TODOs.md
 */
export interface PlanningTask {
    /** Unique identifier (generated from content) */
    id: string;
    /** Task title/description */
    title: string;
    /** Current status */
    status: TaskStatus;
    /** Optional detailed description */
    description?: string;
    /** Linear issue ID if synced */
    linearIssueId?: string;
}

/**
 * Complete planning session data
 */
export interface PlanningSession {
    /** Feature name */
    feature: string;
    /** Parent Linear issue ID */
    parentIssueId?: string;
    /** Linear team ID */
    linearTeamId?: string;
    /** Last sync timestamp */
    syncedAt?: string;
    /** List of tasks */
    tasks: PlanningTask[];
}

/**
 * Configuration for Linear sync
 */
export interface LinearSyncConfig {
    /** Linear API key */
    apiKey: string;
    /** Linear team ID */
    teamId: string;
    /** Optional: parent label name (default: "Planning") */
    parentLabel?: string;
    /** Optional: IDE link template */
    ideLinkTemplate?: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
    /** Parent issue URL */
    parentIssueUrl: string;
    /** Parent issue ID */
    parentIssueId: string;
    /** Number of tasks created */
    tasksCreated: number;
    /** Number of tasks updated */
    tasksUpdated: number;
    /** Number of tasks unchanged */
    tasksUnchanged: number;
}

/**
 * Result of marking a task as completed
 */
export interface CompleteTaskResult {
    /** Task ID that was completed */
    taskId: string;
    /** Linear issue ID */
    linearIssueId: string;
    /** Linear issue URL */
    issueUrl: string;
}
