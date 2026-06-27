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
 * - Request-context enrichment: {@link getRequestContext} is called
 *   synchronously at the top of each handler invocation (before the
 *   fire-and-forget promise) so the ALS store is captured on the same
 *   microtask tick as the log call site. When no store is active (startup,
 *   crons, tests) the context fields are omitted entirely. `role` is NOT
 *   persisted — it has no column and is reserved for SPEC-180/Sentry.
 */

import type { LogEntry } from '@repo/logger';
import { registerHook } from '@repo/logger';
import type { CreateAppLogEntry } from '@repo/schemas';
import { AppLogEntryService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import { getRequestContext } from './request-context';

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
/**
 * Extracts the actionable reason from a sink insert failure.
 *
 * The service/model layer (and Drizzle underneath) wrap the original driver
 * error, so `err.message` is a generic "Failed query: insert into ..." string
 * that hides WHY the insert failed. The real cause — a missing column, a NOT
 * NULL / type / check violation, a Zod parse failure on the input — lives on
 * `err.cause`. We surface it so the throttled stderr report is diagnosable
 * without a DB session.
 *
 * @param err - The rejection value from `recordEntry`.
 * @returns A single-line message including the wrapped cause when present.
 */
const formatSinkError = (err: unknown): string => {
    if (!(err instanceof Error)) {
        return String(err);
    }
    const cause = (err as { cause?: unknown }).cause;
    const causeMsg =
        cause instanceof Error ? cause.message : cause !== undefined ? String(cause) : undefined;
    return causeMsg ? `${err.message} | cause: ${causeMsg}` : err.message;
};

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

        // Capture ALS store synchronously here — before any await boundary —
        // so we read the correct per-request store regardless of when the
        // fire-and-forget promise settles.
        const reqCtx = getRequestContext();
        const contextFields: Pick<CreateAppLogEntry, 'requestId' | 'userId' | 'method' | 'path'> =
            reqCtx !== undefined
                ? {
                      requestId: reqCtx.requestId,
                      method: reqCtx.method,
                      path: reqCtx.path,
                      ...(reqCtx.userId !== undefined ? { userId: reqCtx.userId } : {})
                  }
                : {};

        const input: CreateAppLogEntry = { ...mapEntryToCreateInput(entry), ...contextFields };

        // Fire-and-forget: never awaited, rejection swallowed.
        service.recordEntry({ data: input }).catch((err) => {
            failuresSinceReport += 1;
            const now = Date.now();
            if (now - lastReportAt >= SINK_REPORT_THROTTLE_MS) {
                lastReportAt = now;
                const detail = formatSinkError(err);
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
