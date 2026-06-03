import { AppLogEntryModel } from '@repo/db';
import {
    APP_LOG_MESSAGE_MAX_LENGTH,
    type AppLogEntry,
    type AppLogEntryFilter,
    AppLogEntryFilterSchema,
    type CreateAppLogEntry,
    CreateAppLogEntrySchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { checkCanViewAppLogs } from './appLog.permissions.js';

/** Default retention window (days) for the purge operation — uniform for WARN and ERROR. */
const DEFAULT_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Input schema for listEntries (filter is validated; actor is handled by the wrapper). */
const ListEntriesInputSchema = z.object({ filter: AppLogEntryFilterSchema });

/**
 * Service for persisted application log entries (SPEC-184 / BETA-82).
 *
 * Does NOT extend BaseCrudService: `app_log_entries` is an append-only system
 * log, not a user-facing CRUD entity. Recording and purging are system
 * operations (no actor), while the read path (listEntries) is admin-tier and
 * gated by {@link checkCanViewAppLogs}.
 *
 * Recording is invoked fire-and-forget from the logger's 'db-sink' hook: the
 * caller is expected to `.catch()` the promise so a persistence failure never
 * breaks the logging call site.
 */
export class AppLogEntryService extends BaseService {
    static readonly ENTITY_NAME = 'app_log_entries';
    protected readonly entityName = AppLogEntryService.ENTITY_NAME;
    protected readonly model: AppLogEntryModel;

    constructor(ctx: ServiceConfig, model?: AppLogEntryModel) {
        super(ctx, AppLogEntryService.ENTITY_NAME);
        this.model = model ?? new AppLogEntryModel();
    }

    /**
     * Persists a single WARN/ERROR log entry.
     *
     * System operation (no actor). Validates the payload, truncates an
     * oversized `message` (keeping the full text under `data.messageFull`),
     * and inserts the row via the model's QUIET path (`createQuiet`): the
     * insert emits no DB-layer log, so a failed sink insert can never
     * re-enter the sink through its own error log (feedback-loop guard by
     * construction). Throws on validation/DB failure — the db-sink hook MUST
     * `.catch()` so recording never breaks the logging call site.
     *
     * @param input.data - The log entry to persist.
     * @returns The created entry.
     */
    public async recordEntry(input: { data: CreateAppLogEntry }): Promise<AppLogEntry> {
        const data = CreateAppLogEntrySchema.parse(input.data);

        let message = data.message;
        const dataField: Record<string, unknown> | undefined =
            data.data || message.length > APP_LOG_MESSAGE_MAX_LENGTH
                ? { ...(data.data ?? {}) }
                : undefined;
        if (message.length > APP_LOG_MESSAGE_MAX_LENGTH && dataField) {
            dataField.messageFull = message;
            message = message.slice(0, APP_LOG_MESSAGE_MAX_LENGTH);
        }

        const created = await this.model.createQuiet({
            level: data.level,
            category: data.category ?? null,
            label: data.label ?? null,
            message,
            data: dataField ?? null,
            loggedAt: data.loggedAt
            // biome-ignore lint/suspicious/noExplicitAny: db Partial<row> vs schema type bridge
        } as any);

        // TYPE-WORKAROUND: AppLogEntryModel uses its own local `$inferSelect` row type
        // while this service returns the @repo/schemas AppLogEntry; the shapes are
        // structurally identical but TypeScript treats them as distinct nominal types.
        return created as unknown as AppLogEntry;
    }

    /**
     * Lists app log entries with filters + pagination (admin-tier).
     *
     * @param input.actor - Actor performing the action (needs SYSTEM_MAINTENANCE_MODE).
     * @param input.filter - Optional filters + pagination.
     * @returns The matching page of entries and total count.
     */
    public async listEntries(input: {
        actor: Actor;
        filter?: Partial<AppLogEntryFilter>;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ items: AppLogEntry[]; total: number }>> {
        const { actor, filter, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'listEntries',
            input: { actor, filter: AppLogEntryFilterSchema.parse(filter ?? {}) },
            schema: ListEntriesInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewAppLogs(actor);
                const result = await this.model.listEntries(validated.filter);
                // TYPE-WORKAROUND: same DB-model vs @repo/schemas nominal mismatch as recordEntry.
                return result as unknown as { items: AppLogEntry[]; total: number };
            }
        });
    }

    /**
     * Deletes entries past the retention window (system operation, no actor).
     * Uniform retention for WARN and ERROR.
     *
     * @param input.retentionDays - Keep entries this many days (default 30).
     * @returns The number of deleted rows.
     */
    public async purgeOld(input?: { retentionDays?: number }): Promise<number> {
        const retentionDays = input?.retentionDays ?? DEFAULT_RETENTION_DAYS;
        const before = new Date(Date.now() - retentionDays * MS_PER_DAY);

        const deleted = await this.model.purgeOlderThan({ before });
        this.logger.info({ deleted, retentionDays }, 'app_log_entries purge completed');
        return deleted;
    }
}
