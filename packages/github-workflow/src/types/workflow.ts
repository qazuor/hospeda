/**
 * Workflow types for planning sync and automation
 *
 * @module types/workflow
 */

/**
 * Planning session metadata
 */
export type PlanningSession = {
    /** Session identifier (e.g., P-001) */
    id: string;
    /** Session title */
    title: string;
    /** Session directory path */
    path: string;
    /** PDR file path */
    pdrPath?: string;
    /** Tech analysis file path */
    techAnalysisPath?: string;
    /** TODOs file path */
    todosPath?: string;
    /** Session creation date */
    createdAt: Date;
};

/**
 * TODO item from planning
 */
export type TodoItem = {
    /** TODO identifier (e.g., PB-001) */
    id: string;
    /** TODO title */
    title: string;
    /** TODO description */
    description: string;
    /** Estimated hours */
    estimate?: number;
    /** Dependencies (other TODO IDs) */
    dependencies?: string[];
    /** Labels/tags */
    labels?: string[];
    /** Priority level */
    priority?: 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Sync operation result (legacy type)
 * @deprecated Use SyncResult from sync/types.ts instead
 */
export type LegacySyncResult = {
    /** Success status */
    success: boolean;
    /** Number of items synced */
    synced: number;
    /** Number of items failed */
    failed: number;
    /** Created issue numbers */
    created: number[];
    /** Error messages */
    errors: string[];
};

/**
 * Enrichment result
 */
export type EnrichmentResult = {
    /** Success status */
    success: boolean;
    /** Original issue number */
    issueNumber: number;
    /** Enriched content added */
    enriched: boolean;
    /** Error message if failed */
    error?: string;
};

/**
 * Workflow execution context
 */
export type WorkflowContext = {
    /** Current session being processed */
    session?: PlanningSession;
    /** Current TODO being processed */
    todo?: TodoItem;
    /** Current issue being processed */
    issue?: number;
    /** Dry run mode (no actual changes) */
    dryRun?: boolean;
};
