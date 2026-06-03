/**
 * App Logs Feature Types
 *
 * Type definitions for application log entry viewing in the admin panel.
 * Canonical types come from @repo/schemas (SPEC-184).
 */

// Re-export canonical types from schemas so all feature code
// references a single source of truth.
export type { AppLogEntry, AppLogEntryFilter, AppLogEntryLevel } from '@repo/schemas';

/**
 * Paginated response envelope returned by GET /api/v1/admin/logs.
 */
export interface AppLogListResponse {
    /** Log entries for the current page */
    readonly items: import('@repo/schemas').AppLogEntry[];
    /** Total number of entries matching the current filters */
    readonly total: number;
    /** Current page number (1-based) */
    readonly page: number;
    /** Number of items per page */
    readonly pageSize: number;
}
