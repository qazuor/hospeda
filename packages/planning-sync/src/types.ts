/**
 * Planning Sync Types
 * Simple types for GitHub/Linear synchronization of planning sessions
 */

/**
 * Issue tracker platform
 */
export type IssueTrackerPlatform = 'github' | 'linear';

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
    /** Task code (e.g., T-001-001) */
    code: string;
    /** Task title/description */
    title: string;
    /** Current status */
    status: TaskStatus;
    /** Optional detailed description */
    description?: string;
    /** Linear issue ID if synced */
    linearIssueId?: string;
    /** GitHub issue number if synced */
    githubIssueNumber?: number;
}

/**
 * Complete planning session data
 */
export interface PlanningSession {
    /** Feature name */
    feature: string;
    /** Planning code (e.g., P-001) */
    planningCode: string;
    /** Issue tracker platform */
    platform: IssueTrackerPlatform;
    /** Parent Linear issue ID */
    parentIssueId?: string;
    /** Parent GitHub issue number */
    parentGithubIssueNumber?: number;
    /** Linear team ID */
    linearTeamId?: string;
    /** GitHub repository (owner/repo) */
    githubRepo?: string;
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
 * Configuration for GitHub sync
 */
export interface GitHubSyncConfig {
    /** GitHub personal access token */
    token: string;
    /** Repository in format "owner/repo" */
    repo: string;
    /** Optional: parent label name (default: "planning") */
    parentLabel?: string;
    /** Optional: labels to add to all issues */
    labels?: string[];
    /** Optional: milestone title */
    milestone?: string;
}

/**
 * Union of sync configurations
 */
export type SyncConfig =
    | ({ platform: 'linear' } & LinearSyncConfig)
    | ({ platform: 'github' } & GitHubSyncConfig);

/**
 * Result of a sync operation
 */
export interface SyncResult {
    /** Parent issue URL */
    parentIssueUrl: string;
    /** Parent issue ID (Linear) or number (GitHub) */
    parentIssueId: string | number;
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
    /** Issue ID (Linear) or number (GitHub) */
    issueId: string | number;
    /** Issue URL */
    issueUrl: string;
}
