/**
 * Logger db-sink hook (SPEC-184).
 *
 * Persists WARN and ERROR log entries into `app_log_entries` so they are
 * queryable from the admin log viewer. Registered once at server startup
 * (after DB init) via {@link registerAppLogDbSink}.
 *
 * Design notes:
 * - Volume guard: only WARN | ERROR are written; every other level returns
 *   immediately. Enforced here at the sink (the hook registry dispatches all
 *   levels).
 * - Fire-and-forget: the insert promise is never awaited and its rejection is
 *   swallowed, so a persistence failure can never break a logging call site.
 * - Feedback-loop guard BY CONSTRUCTION: the insert goes through the model's
 *   QUIET path (`createQuiet`, no logQuery/logError), so a failed insert
 *   emits no DB-layer log and can never re-enter this sink. Every legitimate
 *   WARN/ERROR is therefore always attempted — nothing is dropped while the
 *   DB recovers. Failures are reported to stderr (which bypasses the logger)
 *   with a throttle on the REPORT only, never on the insert attempts.
 */

import type { LogEntry } from '@repo/logger';
import { registerHook } from '@repo/logger';
import type { CreateAppLogEntry } from '@repo/schemas';
import { AppLogEntryService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/** Minimum gap between stderr failure reports (throttles the report, NOT the inserts). */
export const SINK_REPORT_THROTTLE_MS = 30_000;

/** Hook name in the shared logger hook registry. */
export const APP_LOG_SINK_HOOK_NAME = 'db-sink';

/**
 * Maps a structured logger entry to the service's create input.
 * Non-object `data` payloads (arrays, primitives) are wrapped under `value`
 * so they satisfy the jsonb record shape.
 */
const mapEntryToCreateInput = (entry: LogEntry): CreateAppLogEntry => {
    let data: Record<string, unknown> | undefined;
    if (entry.data !== undefined) {
        data =
            typeof entry.data === 'object' && entry.data !== null && !Array.isArray(entry.data)
                ? (entry.data as Record<string, unknown>)
                : { value: entry.data };
    }

    return {
        level: entry.level as CreateAppLogEntry['level'],
        category: entry.category ?? null,
        label: entry.label ?? null,
        message: entry.message,
        data,
        loggedAt: new Date(entry.ts)
    };
};

/**
 * Builds the sink handler. Exported separately so tests can exercise the
 * level guard, mapping, and failure behavior with an injected service.
 *
 * The persistence path is log-free (`AppLogEntryService.recordEntry` →
 * `AppLogEntryModel.createQuiet`), so insert failures cannot re-enter this
 * sink through the DB layer's own error logging. Every WARN/ERROR entry is
 * always attempted; failures are reported to stderr (bypasses the logger),
 * throttled to one report per {@link SINK_REPORT_THROTTLE_MS} to avoid spam
 * during a DB outage.
 *
 * @param service - The AppLogEntryService used to persist entries.
 * @returns The hook function to register under {@link APP_LOG_SINK_HOOK_NAME}.
 */
export const createAppLogSinkHandler = (
    service: AppLogEntryService
): ((entry: LogEntry) => void) => {
    let lastReportAt = 0;
    let failuresSinceReport = 0;

    return (entry: LogEntry): void => {
        // Volume guard: WARN + ERROR only.
        if (entry.level !== 'WARN' && entry.level !== 'ERROR') {
            return;
        }

        // Fire-and-forget: never awaited, rejection swallowed.
        service.recordEntry({ data: mapEntryToCreateInput(entry) }).catch((err) => {
            failuresSinceReport += 1;
            const now = Date.now();
            if (now - lastReportAt >= SINK_REPORT_THROTTLE_MS) {
                lastReportAt = now;
                const detail = err instanceof Error ? err.message : String(err);
                process.stderr.write(
                    `[app-log-sink] ${failuresSinceReport} insert failure(s) since last report; latest: ${detail}\n`
                );
                failuresSinceReport = 0;
            }
        });
    };
};

/**
 * Registers the db-sink hook on the shared logger hook registry.
 * Call once at server startup, AFTER the database has been initialized.
 */
export const registerAppLogDbSink = (): void => {
    const service = new AppLogEntryService({ logger: apiLogger });
    registerHook(APP_LOG_SINK_HOOK_NAME, createAppLogSinkHandler(service));
};
