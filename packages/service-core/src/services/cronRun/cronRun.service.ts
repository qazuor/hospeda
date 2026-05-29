import { CronRunModel } from '@repo/db';
import {
    type CreateCronRun,
    CreateCronRunSchema,
    type CronRun,
    type CronRunFilter,
    CronRunFilterSchema,
    type CronRunSummary
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { checkCanViewCronRuns } from './cronRun.permissions.js';

/** Maximum length of the persisted `errorMessage`; overflow is moved into `details`. */
const ERROR_MESSAGE_MAX_LENGTH = 2000;

/** Default retention windows (days) for the purge operation. */
const DEFAULT_SUCCESS_RETENTION_DAYS = 60;
const DEFAULT_FAILED_RETENTION_DAYS = 180;

/** Default number of recent failures returned by the summary. */
const DEFAULT_RECENT_FAILURES_LIMIT = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Input schema for listRuns (filter is validated; actor is handled by the wrapper). */
const ListRunsInputSchema = z.object({ filter: CronRunFilterSchema });

/** Input schema for getById. */
const GetByIdInputSchema = z.object({ id: z.string().uuid() });

/** Input schema for getSummary. */
const GetSummaryInputSchema = z.object({
    recentFailuresLimit: z.coerce.number().int().min(1).max(100).optional()
});

/**
 * Service for cron run history.
 *
 * Does NOT extend BaseCrudService: `cron_runs` is an append-only system log, not a
 * user-facing CRUD entity. Recording and purging are system operations (no actor),
 * while the read paths (list/getById/getSummary) are admin-tier and gated by
 * {@link checkCanViewCronRuns}.
 *
 * Recording is invoked fire-and-forget from the cron execution sites: the caller is
 * expected to wrap calls in try/catch so a persistence failure never alters the job
 * outcome.
 */
export class CronRunService extends BaseService {
    static readonly ENTITY_NAME = 'cron_runs';
    protected readonly entityName = CronRunService.ENTITY_NAME;
    protected readonly model: CronRunModel;

    constructor(ctx: ServiceConfig, model?: CronRunModel) {
        super(ctx, CronRunService.ENTITY_NAME);
        this.model = model ?? new CronRunModel();
    }

    /**
     * Persists the outcome of a single cron execution.
     *
     * System operation (no actor). Validates the payload, truncates an oversized
     * `errorMessage` (keeping the full text under `details.errorMessageFull`), and
     * inserts the row. Throws on validation/DB failure — callers in the cron hook
     * MUST wrap this in try/catch so recording never tips over the job.
     *
     * @param input.data - The run outcome to record.
     * @returns The created run record.
     */
    public async recordRun(input: { data: CreateCronRun }): Promise<CronRun> {
        const data = CreateCronRunSchema.parse(input.data);

        let errorMessage = data.errorMessage ?? null;
        const details: Record<string, unknown> = { ...(data.details ?? {}) };
        if (errorMessage && errorMessage.length > ERROR_MESSAGE_MAX_LENGTH) {
            details.errorMessageFull = errorMessage;
            errorMessage = errorMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH);
        }

        const created = await this.model.create({
            jobName: data.jobName,
            status: data.status,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
            durationMs: data.durationMs,
            processed: data.processed,
            errors: data.errors,
            executionMode: data.executionMode,
            dryRun: data.dryRun,
            errorMessage,
            details
            // biome-ignore lint/suspicious/noExplicitAny: db Partial<row> vs schema type bridge
        } as any);

        return created as unknown as CronRun;
    }

    /**
     * Lists cron run records with filters + pagination (admin-tier).
     *
     * @param input.actor - Actor performing the action (needs SYSTEM_MAINTENANCE_MODE).
     * @param input.filter - Optional filters + pagination.
     * @returns The matching page of runs and total count.
     */
    public async listRuns(input: {
        actor: Actor;
        filter?: Partial<CronRunFilter>;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ items: CronRun[]; total: number }>> {
        const { actor, filter, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'listRuns',
            input: { actor, filter: CronRunFilterSchema.parse(filter ?? {}) },
            schema: ListRunsInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewCronRuns(actor);
                const result = await this.model.listRuns(validated.filter);
                return result as unknown as { items: CronRun[]; total: number };
            }
        });
    }

    /**
     * Fetches a single run record by id (admin-tier).
     *
     * @param input.actor - Actor performing the action (needs SYSTEM_MAINTENANCE_MODE).
     * @param input.id - Run id.
     * @returns The run record, or null if not found.
     */
    public async getById(input: {
        actor: Actor;
        id: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<CronRun | null>> {
        const { actor, id, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getById',
            input: { actor, id },
            schema: GetByIdInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewCronRuns(actor);
                const run = await this.model.findById(validated.id);
                return (run as unknown as CronRun | null) ?? null;
            }
        });
    }

    /**
     * Builds the cron health summary for the admin dashboard (last run per job +
     * recent failures). Admin-tier.
     *
     * @param input.actor - Actor performing the action (needs SYSTEM_MAINTENANCE_MODE).
     * @param input.recentFailuresLimit - Optional cap on recent failures (default 20).
     * @returns The aggregated summary.
     */
    public async getSummary(input: {
        actor: Actor;
        recentFailuresLimit?: number;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<CronRunSummary>> {
        const { actor, recentFailuresLimit, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { actor, recentFailuresLimit },
            schema: GetSummaryInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewCronRuns(actor);
                const limit = validated.recentFailuresLimit ?? DEFAULT_RECENT_FAILURES_LIMIT;
                const [lastRunsRaw, recentFailuresRaw] = await Promise.all([
                    this.model.getLatestRunPerJob(),
                    this.model.getRecentFailures(limit)
                ]);
                const lastRuns = lastRunsRaw as unknown as CronRun[];
                const recentFailures = recentFailuresRaw as unknown as CronRun[];
                const failingJobsCount = lastRuns.filter((r) => r.status !== 'success').length;
                return {
                    lastRuns,
                    recentFailures,
                    failingJobsCount,
                    generatedAt: new Date()
                } satisfies CronRunSummary;
            }
        });
    }

    /**
     * Deletes run records past their retention window (system operation, no actor).
     * Differentiated retention: successes are purged sooner than failures/timeouts.
     *
     * @param input.successRetentionDays - Keep `success` runs this many days (default 60).
     * @param input.failedRetentionDays - Keep `failed`/`timeout` runs this many days (default 180).
     * @returns The number of deleted rows.
     */
    public async purgeOld(input?: {
        successRetentionDays?: number;
        failedRetentionDays?: number;
    }): Promise<number> {
        const successDays = input?.successRetentionDays ?? DEFAULT_SUCCESS_RETENTION_DAYS;
        const failedDays = input?.failedRetentionDays ?? DEFAULT_FAILED_RETENTION_DAYS;
        const now = Date.now();
        const successBefore = new Date(now - successDays * MS_PER_DAY);
        const failedBefore = new Date(now - failedDays * MS_PER_DAY);

        const deleted = await this.model.purgeOlderThan({ successBefore, failedBefore });
        this.logger.info(
            {
                deleted,
                successRetentionDays: successDays,
                failedRetentionDays: failedDays
            },
            'cron_runs purge completed'
        );
        return deleted;
    }
}
