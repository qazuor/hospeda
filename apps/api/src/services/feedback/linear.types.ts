/**
 * Type definitions for the Linear feedback service.
 *
 * Extracted from linear.service.ts to keep the service file under
 * 500 lines. Contains config shape interfaces and the public API types.
 */
import type {
    FEEDBACK_CONFIG as FeedbackConfigType,
    REPORT_TYPES as ReportTypesType,
    SEVERITY_LEVELS as SeverityLevelsType
} from '@repo/feedback/config';

// Re-export for backwards compatibility
export type { FeedbackConfigType, ReportTypesType, SeverityLevelsType };

// ---------------------------------------------------------------------------
// Config shape types (mirrors @repo/feedback/config shapes)
// ---------------------------------------------------------------------------

/** Shape of a single report type entry */
export interface ReportTypeEntry {
    readonly id: string;
    readonly label: string;
    readonly linearLabelId: string;
}

/** Shape of a single severity level entry */
export interface SeverityLevelEntry {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly linearPriority: number;
}

/** Shape of the Linear config sub-object */
export interface LinearConfigEntry {
    readonly teamId: string;
    readonly projectId?: string;
    readonly defaultStateId?: string;
    readonly labels: {
        readonly source: {
            readonly web: string;
            readonly admin: string;
            readonly standalone: string;
        };
        readonly environment: {
            readonly beta: string;
        };
    };
}

/** Minimal feedback config shape needed by the Linear service */
export interface FeedbackConfigInput {
    readonly linear: LinearConfigEntry;
    readonly reportTypes: readonly ReportTypeEntry[];
    readonly severityLevels: readonly SeverityLevelEntry[];
}
