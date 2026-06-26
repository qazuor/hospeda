import { type SQL, gte, lt, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { auditLogEntries } from '../../schemas/audit-log/audit_log_entry.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Validated sort input for audit log list queries.
 * Field is constrained to the whitelisted sortable columns; direction is asc | desc.
 * This type is intentionally inline (not imported from @repo/schemas) so the db
 * package stays independent of the schemas package at the type level.
 */
export interface AuditLogEntrySortInput {
    /** Whitelisted sortable field — only loggedAt and severity are accepted */
    field: 'loggedAt' | 'severity';
    /** Sort direction */
    direction: 'asc' | 'desc';
}

/** Row type inferred from the audit_log_entries table */
type AuditLogEntry = typeof auditLogEntries.$inferSelect;

/** Insert type inferred from the audit_log_entries table */
type AuditLogEntryInsert = typeof auditLogEntries.$inferInsert;

/**
 * Model for the append-only `audit_log_entries` table (SPEC-162).
 *
 * Persists the audit/security events emitted by `audit-logger.ts` and powers the
 * two admin log viewers (audit + security), discriminated by `logType`.
 *
 * Inserts come fire-and-forget from the audit-logger's injected persister (via
 * {@link createQuiet}); the table is append-only (no soft-delete).
 *
 * Custom queries (time-range listing) live here because they need range
 * conditions, which the generic BaseModel helpers (equality-only `where`) cannot
 * express.
 */
export class AuditLogEntryModel extends BaseModelImpl<AuditLogEntry> {
    protected table = auditLogEntries;
    public entityName = 'audit_log_entries';

    protected getTableName(): string {
        return 'audit_log_entries';
    }

    /**
     * Inserts a log entry WITHOUT emitting any DB-layer log (no logQuery /
     * logError).
     *
     * This is the write path used by the audit-logger's persister. The base
     * `create` logs its own failure via `dbLogger.error(...)`; keeping this path
     * log-free prevents a failed insert from re-entering the logger while the DB
     * is down.
     *
     * @param data - The entry row to insert.
     * @param tx - Optional transaction client.
     * @returns The created entry.
     * @throws The raw driver error on failure — callers MUST catch (the persister
     * is fire-and-forget).
     */
    async createQuiet(data: AuditLogEntryInsert, tx?: DrizzleClient): Promise<AuditLogEntry> {
        const db = this.getClient(tx);
        const result = await db.insert(auditLogEntries).values(data).returning();
        if (!result[0]) {
            throw new Error(`Insert failed for entity '${this.entityName}'`);
        }
        return result[0] as AuditLogEntry;
    }

    /**
     * Lists audit/security log entries matching the given filters, paginated and
     * sorted.
     *
     * Equality filters (`logType`/`eventType`/`severity`/`actorId`) and the
     * `loggedAt` date range are applied at the DB layer. Pagination + total count
     * come from the base `findAll`.
     *
     * The sort field is whitelisted to `loggedAt` and `severity` only — the caller
     * MUST validate the field name before passing it here. The default sort is
     * `loggedAt desc` when no sort input is provided.
     *
     * @param filter - Optional filters (equality, date range), pagination, and sort.
     * @param tx - Optional transaction client.
     * @returns The matching page of entries and the total count.
     */
    async listEntries(
        filter: {
            logType?: string;
            eventType?: string;
            severity?: string;
            /** Exact match on the acting user UUID */
            actorId?: string;
            fromDate?: Date;
            toDate?: Date;
            page?: number;
            pageSize?: number;
            /**
             * Validated sort input. Field must be a whitelisted column name.
             * When absent the default is loggedAt desc.
             */
            sort?: AuditLogEntrySortInput;
        } = {},
        tx?: DrizzleClient
    ): Promise<{ items: AuditLogEntry[]; total: number }> {
        const where: Record<string, unknown> = {};
        if (filter.logType) where.logType = filter.logType;
        if (filter.eventType) where.eventType = filter.eventType;
        if (filter.severity) where.severity = filter.severity;
        if (filter.actorId) where.actorId = filter.actorId;

        const conditions: SQL[] = [];
        if (filter.fromDate) conditions.push(gte(auditLogEntries.loggedAt, filter.fromDate));
        if (filter.toDate) conditions.push(lte(auditLogEntries.loggedAt, filter.toDate));

        const sortBy = filter.sort?.field ?? 'loggedAt';
        const sortOrder = filter.sort?.direction ?? 'desc';

        return this.findAll(
            where,
            {
                page: filter.page,
                pageSize: filter.pageSize,
                sortBy,
                sortOrder
            },
            conditions.length > 0 ? conditions : undefined,
            tx
        );
    }

    /**
     * Hard-deletes entries emitted strictly before the given date.
     * Provided for a future retention purge (out of scope for the initial SPEC-162
     * shipment but mirrors the app_log_entries model surface).
     *
     * @param input.before - Delete entries with `loggedAt` strictly before this date.
     * @param tx - Optional transaction client.
     * @returns The number of deleted rows.
     */
    async purgeOlderThan(input: { before: Date }, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const result = await db
            .delete(auditLogEntries)
            .where(lt(auditLogEntries.loggedAt, input.before))
            .returning({ id: auditLogEntries.id });
        return result.length;
    }
}

/** Singleton instance of AuditLogEntryModel for use across the application. */
export const auditLogEntryModel = new AuditLogEntryModel();
