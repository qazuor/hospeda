/**
 * Audit-log persistence wiring (SPEC-162).
 *
 * Connects the audit-logger's injected persister to {@link AuditLogEntryService}
 * so every audit/security event emitted by `auditLog()` is written to the
 * queryable `audit_log_entries` table. Registered once at server startup (after
 * DB init) via {@link registerAuditLogPersistence}.
 *
 * Design notes (mirrors the app-log db-sink, SPEC-184):
 * - Fire-and-forget: the insert promise is never awaited and its rejection is
 *   swallowed, so a persistence failure can never break a logging call site.
 * - Feedback-loop guard BY CONSTRUCTION: the insert goes through the model's
 *   QUIET path (`AuditLogEntryService.recordEntry` → `AuditLogEntryModel.createQuiet`,
 *   no logQuery/logError), so a failed insert emits no DB-layer log and can never
 *   re-enter the audit logger. Failures are reported to stderr (which bypasses
 *   the logger) with a throttle on the REPORT only, never on the insert attempts.
 * - Audit entries already carry their own context (actorId, ip, target) from the
 *   middleware/handler that emitted them, so no AsyncLocalStorage enrichment is
 *   needed here (unlike the app-log sink).
 */

import type { CreateAuditLogEntry } from '@repo/schemas';
import { AuditLogEntryService } from '@repo/service-core';
import { registerAuditLogPersister } from '../utils/audit-logger';
import { apiLogger } from '../utils/logger';

/** Minimum gap between stderr failure reports (throttles the report, NOT the inserts). */
export const AUDIT_SINK_REPORT_THROTTLE_MS = 30_000;

/**
 * Builds the persister callback. Exported separately so tests can exercise the
 * fire-and-forget behavior and failure reporting with an injected service.
 *
 * @param service - The AuditLogEntryService used to persist entries.
 * @returns The persister function to register with the audit logger.
 */
export const createAuditLogPersister = (
    service: AuditLogEntryService
): ((record: CreateAuditLogEntry) => void) => {
    let lastReportAt = 0;
    let failuresSinceReport = 0;

    return (record: CreateAuditLogEntry): void => {
        // Fire-and-forget: never awaited, rejection swallowed.
        service.recordEntry({ data: record }).catch((err) => {
            failuresSinceReport += 1;
            const now = Date.now();
            if (now - lastReportAt >= AUDIT_SINK_REPORT_THROTTLE_MS) {
                lastReportAt = now;
                const detail = err instanceof Error ? err.message : String(err);
                process.stderr.write(
                    `[audit-log-sink] ${failuresSinceReport} insert failure(s) since last report; latest: ${detail}\n`
                );
                failuresSinceReport = 0;
            }
        });
    };
};

/**
 * Registers the audit-log persister with the audit logger.
 * Call once at server startup, AFTER the database has been initialized.
 */
export const registerAuditLogPersistence = (): void => {
    const service = new AuditLogEntryService({ logger: apiLogger });
    registerAuditLogPersister(createAuditLogPersister(service));
};
