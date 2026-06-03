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
 * - Feedback-loop guard: a failed insert makes the DB layer emit its own
 *   ERROR log, which re-enters this sink. Without protection that chain would
 *   spin forever while the DB is down. On any insert failure the sink
 *   disables itself for a cooldown window, cutting the loop and self-healing
 *   once the DB recovers.
 */

import type { LogEntry } from '@repo/logger';
import { registerHook } from '@repo/logger';
import type { CreateAppLogEntry } from '@repo/schemas';
import { AppLogEntryService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/** How long the sink stays disabled after an insert failure. */
export const SINK_FAILURE_COOLDOWN_MS = 30_000;

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
 * level guard, mapping, and cooldown behavior with an injected service.
 *
 * @param service - The AppLogEntryService used to persist entries.
 * @returns The hook function to register under {@link APP_LOG_SINK_HOOK_NAME}.
 */
export const createAppLogSinkHandler = (
    service: AppLogEntryService
): ((entry: LogEntry) => void) => {
    let disabledUntil = 0;

    return (entry: LogEntry): void => {
        // Volume guard: WARN + ERROR only.
        if (entry.level !== 'WARN' && entry.level !== 'ERROR') {
            return;
        }
        // Cooldown: skip while disabled after a recent insert failure.
        if (Date.now() < disabledUntil) {
            return;
        }

        // Fire-and-forget: never awaited, rejection swallowed.
        service.recordEntry({ data: mapEntryToCreateInput(entry) }).catch(() => {
            disabledUntil = Date.now() + SINK_FAILURE_COOLDOWN_MS;
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
