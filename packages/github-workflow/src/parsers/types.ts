/**
 * Types for planning session parsers
 *
 * @module parsers/types
 */

/**
 * Status of a task in TODOs.md
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Planning session metadata from PDR.md
 */
export type PlanningMetadata = {
    /** Planning code (e.g., P-003) */
    planningCode: string;
    /** Feature name from PDR title */
    featureName: string;
    /** Executive summary from PDR */
    summary: string;
    /** Creation date (optional) */
    createdAt?: string;
    /** Planning status (optional) */
    status?: string;
};

/**
 * GitHub issue information
 */
export type GitHubIssueInfo = {
    /** Issue number */
    number: number;
    /** Full URL to issue */
    url: string;
};

/**
 * Task from TODOs.md
 */
export type Task = {
    /** Generated task ID (e.g., task-001) */
    id: string;
    /** Task code (e.g., T-003-001) */
    code: string;
    /** Task title */
    title: string;
    /** Task description (from > lines) */
    description?: string;
    /** Task status */
    status: TaskStatus;
    /** Assignee (optional) */
    assignee?: string;
    /** Estimate in hours (optional) */
    estimate?: string;
    /** Phase number (optional) */
    phase?: number;
    /** GitHub issue information (optional) */
    githubIssue?: GitHubIssueInfo;
    /** Nested subtasks */
    subtasks?: Task[];
    /** Nesting level (0 = parent, 1 = sub, 2 = sub-sub) */
    level: number;
    /** Line number in TODOs.md file */
    lineNumber: number;
};

/**
 * Parsed planning session with full metadata and tasks
 */
export type ParsedPlanningSession = {
    /** Planning metadata from PDR */
    metadata: PlanningMetadata;
    /** All tasks from TODOs.md */
    tasks: Task[];
    /** Path to planning session directory */
    sessionPath: string;
};

/**
 * Type of code comment marker
 */
export type CommentType = 'TODO' | 'HACK' | 'DEBUG';

/**
 * Priority level for code comments
 */
export type CommentPriority = 'high' | 'medium' | 'low' | 'P1' | 'P2' | 'P3';

/**
 * Parsed code comment with metadata
 */
export type CodeComment = {
    /** Generated unique identifier */
    id: string;
    /** Type of comment (TODO, HACK, DEBUG) */
    type: CommentType;
    /** Comment text content */
    content: string;
    /** File path relative to project root */
    filePath: string;
    /** Line number where comment appears */
    lineNumber: number;
    /** Priority level if specified */
    priority?: CommentPriority;
    /** Assigned user if specified */
    assignee?: string;
    /** Labels/tags extracted from comment */
    labels?: string[];
    /** Additional metadata extracted from comment */
    metadata?: Record<string, string>;
};

/**
 * Options for code comment scanner
 */
export type CodeCommentScanOptions = {
    /** Base directory to scan (defaults to process.cwd()) */
    baseDir?: string;
    /** Glob patterns to include (defaults to common code files) */
    include?: string[];
    /** Glob patterns to exclude (defaults to node_modules, dist, etc.) */
    exclude?: string[];
    /** Respect .gitignore patterns (defaults to true) */
    respectGitignore?: boolean;
    /** Comment types to detect (defaults to all) */
    commentTypes?: CommentType[];
};

/**
 * Result of code comment scanning
 */
export type CodeCommentScanResult = {
    /** All detected code comments */
    comments: CodeComment[];
    /** Number of files scanned */
    filesScanned: number;
    /** Number of comments found */
    commentsFound: number;
    /** Comments grouped by type */
    byType: Record<CommentType, CodeComment[]>;
    /** Comments grouped by file */
    byFile: Record<string, CodeComment[]>;
};
