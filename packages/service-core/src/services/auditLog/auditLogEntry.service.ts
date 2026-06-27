import { AuditLogEntryModel } from '@repo/db';
import {
    AUDIT_LOG_MESSAGE_MAX_LENGTH,
    type AuditLogEntry,
    type AuditLogEntryFilter,
    AuditLogEntryFilterSchema,
    AuditLogEntrySortInputSchema,
    type AuditLogType,
    AuditLogTypeEnum,
    type CreateAuditLogEntry,
    CreateAuditLogEntrySchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { checkCanViewAuditLogType } from './auditLog.permissions.js';

/** Default retention window (days) for the optional purge operation. */
const DEFAULT_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Input schema for listEntries (logType + filter + optional sort; actor handled by wrapper). */
const ListEntriesInputSchema = z.object({
    logType: AuditLogTypeEnum,
    filter: AuditLogEntryFilterSchema,
    sort: AuditLogEntrySortInputSchema.optional()
});

/**
 * Service for persisted audit/security log entries (SPEC-162).
 *
 * Does NOT extend BaseCrudService: `audit_log_entries` is an append-only system
 * log, not a user-facing CRUD entity. Recording and purging are system
 * operations (no actor); the read path (listEntries) is admin-tier and gated by
 * the permission matching the requested `logType`
 * ({@link checkCanViewAuditLogType}).
 *
 * Recording is invoked fire-and-forget from the audit-logger's injected
 * persister: the caller is expected to `.catch()` the promise so a persistence
 * failure never breaks the logging call site.
 */
export class AuditLogEntryService extends BaseService {
    static readonly ENTITY_NAME = 'audit_log_entries';
    protected readonly entityName = AuditLogEntryService.ENTITY_NAME;
    protected readonly model: AuditLogEntryModel;

    constructor(ctx: ServiceConfig, model?: AuditLogEntryModel) {
        super(ctx, AuditLogEntryService.ENTITY_NAME);
        this.model = model ?? new AuditLogEntryModel();
    }

    /**
     * Persists a single audit/security event.
     *
     * System operation (no actor). Validates the payload, truncates an oversized
     * `message` (keeping the full text under `data.messageFull`), and inserts the
     * row via the model's QUIET path (`createQuiet`): the insert emits no DB-layer
     * log, so a failed insert can never re-enter the logger through its own error
     * log. Throws on validation/DB failure — the persister MUST `.catch()` so
     * recording never breaks the logging call site.
     *
     * @param input.data - The event to persist.
     * @returns The created entry.
     */
    public async recordEntry(input: { data: CreateAuditLogEntry }): Promise<AuditLogEntry> {
        const data = CreateAuditLogEntrySchema.parse(input.data);

        let message = data.message;
        const dataField: Record<string, unknown> | undefined =
            data.data || message.length > AUDIT_LOG_MESSAGE_MAX_LENGTH
                ? { ...(data.data ?? {}) }
                : undefined;
        if (message.length > AUDIT_LOG_MESSAGE_MAX_LENGTH && dataField) {
            dataField.messageFull = message;
            message = message.slice(0, AUDIT_LOG_MESSAGE_MAX_LENGTH);
        }

        const created = await this.model.createQuiet({
            logType: data.logType,
            eventType: data.eventType,
            severity: data.severity,
            actorId: data.actorId ?? null,
            actorRole: data.actorRole ?? null,
            targetId: data.targetId ?? null,
            ip: data.ip ?? null,
            method: data.method ?? null,
            path: data.path ?? null,
            statusCode: data.statusCode ?? null,
            message,
            data: dataField ?? null,
            loggedAt: data.loggedAt
            // biome-ignore lint/suspicious/noExplicitAny: db Partial<row> vs schema type bridge
        } as any);

        // TYPE-WORKAROUND: AuditLogEntryModel uses its own local `$inferSelect` row type
        // while this service returns the @repo/schemas AuditLogEntry; the shapes are
        // structurally identical but TypeScript treats them as distinct nominal types.
        return created as unknown as AuditLogEntry;
    }

    /**
     * Lists audit/security log entries with filters, pagination, and optional sort
     * (admin-tier).
     *
     * The `logType` is supplied by the route (never the client) and selects both
     * the table filter and the required permission: `audit` → AUDIT_LOG_VIEW,
     * `security` → SECURITY_LOG_VIEW. The `sort` input must already be validated
     * by the caller; it is propagated as-is so the DB layer never receives
     * arbitrary field names.
     *
     * @param input.actor - Actor performing the action.
     * @param input.logType - Log family to query ('audit' | 'security').
     * @param input.filter - Optional filters + pagination.
     * @param input.sort - Optional validated sort (field whitelisted to loggedAt | severity).
     * @returns The matching page of entries and total count.
     */
    public async listEntries(input: {
        actor: Actor;
        logType: AuditLogType;
        filter?: Partial<AuditLogEntryFilter>;
        sort?: { field: 'loggedAt' | 'severity'; direction: 'asc' | 'desc' };
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ items: AuditLogEntry[]; total: number }>> {
        const { actor, logType, filter, sort, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'listEntries',
            input: {
                actor,
                logType,
                filter: AuditLogEntryFilterSchema.parse(filter ?? {}),
                sort
            },
            schema: ListEntriesInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewAuditLogType(actor, validated.logType);
                const result = await this.model.listEntries({
                    ...validated.filter,
                    logType: validated.logType,
                    sort: validated.sort
                });
                // TYPE-WORKAROUND: same DB-model vs @repo/schemas nominal mismatch as recordEntry.
                return result as unknown as { items: AuditLogEntry[]; total: number };
            }
        });
    }

    /**
     * Deletes entries past the retention window (system operation, no actor).
     * Optional hardening — the table is append-only by default.
     *
     * @param input.retentionDays - Keep entries this many days (default 90).
     * @returns The number of deleted rows.
     */
    public async purgeOld(input?: { retentionDays?: number }): Promise<number> {
        const retentionDays = input?.retentionDays ?? DEFAULT_RETENTION_DAYS;
        const before = new Date(Date.now() - retentionDays * MS_PER_DAY);

        const deleted = await this.model.purgeOlderThan({ before });
        this.logger.info({ deleted, retentionDays }, 'audit_log_entries purge completed');
        return deleted;
    }
}
