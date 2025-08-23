/**
 * Type definitions for the TODO-Linear synchronization system v2
 */

/**
 * Type of comment that can be tracked
 */
export type CommentType = 'todo' | 'hack' | 'debug';

/**
 * Parsed comment from source code
 */
export type ParsedComment = {
    /** Type of comment */
    type: CommentType;
    /** File path relative to project root */
    filePath: string;
    /** Line number in the file */
    line: number;
    /** Comment title/description */
    title: string;
    /** Assignee username (optional) */
    assignee?: string;
    /** Label name (optional) */
    label?: string;
    /** Additional description (optional) */
    description?: string;
    /** Linear issue ID if already linked */
    issueId?: string;
    /** Original indentation for preserving formatting */
    indentation?: string;
};

/**
 * Tracked comment entry in the filesystem
 */
export type TrackedComment = {
    /** Linear issue ID */
    linearId: string;
    /** Type of comment */
    type: CommentType;
    /** File path relative to project root */
    filePath: string;
    /** Line number in the file */
    line: number;
    /** Comment title */
    title: string;
    /** When this comment was first created */
    createdAt: string;
    /** When this comment was last updated */
    updatedAt: string;
    /** Whether this issue is orphaned (doesn't exist in Linear) */
    isOrphan: boolean;
};

/**
 * Main tracking file structure
 */
export type TrackingData = {
    /** List of all tracked comments */
    comments: TrackedComment[];
    /** Timestamp of last successful sync */
    lastSync: string;
};

/**
 * Sync operation types
 */
export type SyncOperationType = 'create' | 'update' | 'archive';

/**
 * Result of a sync operation
 */
export type SyncOperation = {
    /** Type of operation performed */
    type: SyncOperationType;
    /** Comment that was processed */
    comment: ParsedComment;
    /** Linear issue ID */
    issueId: string;
    /** Success status */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Whether the operation was skipped */
    skipped?: boolean;
};

/**
 * Overall sync result
 */
export type SyncResult = {
    /** All operations performed */
    operations: SyncOperation[];
    /** Total comments found in codebase */
    totalComments: number;
    /** Number of successful operations */
    successful: number;
    /** Number of failed operations */
    failed: number;
    /** Number of skipped operations */
    skipped: number;
    /** Duration in milliseconds */
    duration: number;
    /** List of orphaned issue IDs found */
    orphans: string[];
    /** List of errors encountered */
    errors: string[];
};

/**
 * Configuration for the TODO-Linear system
 */
export type TodoLinearConfig = {
    /** Linear API key */
    linearApiKey: string;
    /** Linear team ID */
    linearTeamId: string;
    /** Default user email for assignment */
    defaultUserEmail: string;
    /** File patterns to include in scanning */
    includePatterns: string[];
    /** File patterns to exclude from scanning */
    excludePatterns: string[];
    /** Project root directory */
    projectRoot: string;
};

/**
 * Clean operation options
 */
export type CleanOptions = {
    /** Clean all TODOs */
    all?: boolean;
    /** Specific issue ID to clean */
    issueId?: string;
};

/**
 * Utility type for creating unique comment keys
 */
export type CommentKey = string; // Format: "filePath:line:title"

/**
 * Lists for processing during sync
 */
export type SyncLists = {
    /** Comments to create in Linear */
    toCreate: ParsedComment[];
    /** Comments to update in Linear */
    toUpdate: Array<{ comment: ParsedComment; tracked: TrackedComment }>;
    /** Comments to archive in Linear */
    toArchive: TrackedComment[];
    /** Orphaned issue IDs found in code */
    orphans: string[];
};
