/**
 * Calendar sync status enum — outcome of the most recent sync attempt for an
 * `accommodation_calendar_sync` connection (HOS-157 Phase 2).
 *
 * - PENDING: The connection was created but no sync run has completed yet
 *   (initial state right after `upsertConnection`).
 * - OK: The most recent sync run completed successfully.
 * - ERROR: The most recent sync run failed. `lastErrorMessage` carries the
 *   failure detail.
 */
export enum CalendarSyncStatusEnum {
    PENDING = 'PENDING',
    OK = 'OK',
    ERROR = 'ERROR'
}
