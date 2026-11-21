/**
 * Provider watch battery cron (HOS-1512, AC:B1:15, AC:B1:18, AC:B1:20).
 *
 * Repeats the measurements behind the fake's lies and rules against the real provider, reads
 * what changed, mails the administrator and adjusts nothing. This file only wires ports: the
 * engine, its guards and the catalog live in `@repo/payments`.
 *
 * One job, one DAILY tick, in both accounts (owner decision 2026-11-18). The environment decides
 * the account: staging watches the sandbox test account, production watches production, and a
 * manual trigger runs either at any time. No measurement moves money. Production still does not
 * start without the owner's authorization of the current month.
 *
 * The external watchdog is pinged ONLY by a run that completed and measured at least one
 * entry. A run that failed, was aborted by a guard or measured nothing (the catalog is empty)
 * returns a non-success result and never pings: it can never report green.
 *
 * @module cron/jobs/provider-watch-battery
 */
import {
    runWatchBattery,
    WATCH_CATALOG,
    type WatchAccount,
    type WatchAuthorization,
    type WatchAuthorizationMiss,
    type WatchEntry,
    type WatchRunRecord,
    type WatchSettings,
    type WatchShapeBaseline,
    type WatchTransport
} from '@repo/payments';
import { PlatformSettingsService } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { env } from '../../utils/env.js';
import { pingHealthchecks } from '../../utils/healthchecks-ping.js';
import { apiLogger } from '../../utils/logger.js';
import {
    closeWatchRun,
    openWatchRun,
    readAcceptedBaseline,
    recordWatchProgress
} from '../../utils/provider-watch/provider-watch-run-store.js';
import {
    isScheduledTickDue,
    PROVIDER_WATCH_JOB_NAME,
    PROVIDER_WATCH_RUN_BUDGET_MS,
    PROVIDER_WATCH_RUN_DEADLINE_MS,
    resolveWatchAccount
} from '../../utils/provider-watch/provider-watch-schedule.js';
import { buildWatchTransport } from '../../utils/provider-watch/provider-watch-transport.js';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** Daily 07:17, in both accounts. */
export const PROVIDER_WATCH_SCHEDULE = '17 7 * * *';

/** What the job reads and writes; every one is replaceable in tests. */
export interface ProviderWatchBatteryDeps {
    readonly resolveAccount: () => WatchAccount | null;
    readonly catalog: readonly WatchEntry[];
    /** What the creating measurements need: the payer email and the return URL. Read per run. */
    readonly readSettings: () => WatchSettings;
    /** Builds the transport; the run's signal is combined with each request's timeout. */
    readonly buildTransport: (args: {
        readonly signal?: AbortSignal | undefined;
    }) => WatchTransport;
    readonly readAuthorization: () => Promise<WatchAuthorization | null>;
    /** The shapes the owner accepted. */
    readonly readBaseline: (args: {
        readonly account: WatchAccount;
    }) => Promise<WatchShapeBaseline | null>;
    /**
     * Opens the run's row; a production run takes the authorization atomically with it: consumed
     * when above 0, taken for the market day when 0 (owner decision on B1, 2026-11-19).
     */
    readonly startRun: (args: {
        readonly account: WatchAccount;
        readonly startedAt: Date;
        readonly consumeAuthorization?: {
            readonly month: string;
            readonly maxChargeMinor: number;
            readonly accountId: string;
            readonly day: string;
        };
    }) => Promise<{
        readonly runId: string;
        readonly authorizationConsumed: boolean;
        readonly authorizationMiss?: WatchAuthorizationMiss;
    }>;
    /** Persists a provider id the moment a write answers it. */
    readonly recordProgress: (args: {
        readonly runId: string;
        readonly measurementId: string;
        readonly providerIds?: readonly string[];
        readonly writeKeys?: readonly string[];
    }) => Promise<void>;
    /** Closes the run and queues its alert mail. */
    readonly finishRun: (args: {
        readonly runId: string;
        readonly run: WatchRunRecord;
        readonly correlationId: string;
    }) => Promise<unknown>;
    readonly now: () => Date;
    /** Pings the external watchdog. Best effort: it never throws. */
    readonly pingWatchdog: () => Promise<void>;
}

/** The production wiring. */
export function createProviderWatchBatteryDeps(): ProviderWatchBatteryDeps {
    const settings = new PlatformSettingsService({ logger: apiLogger });
    return {
        resolveAccount: () =>
            resolveWatchAccount({ slugPrefix: env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX }),
        catalog: WATCH_CATALOG,
        readSettings: () => ({
            payerEmail: env.HOSPEDA_PROVIDER_WATCH_PAYER_EMAIL,
            returnUrl: env.HOSPEDA_SITE_URL
        }),
        buildTransport: buildWatchTransport,
        readAuthorization: async () => {
            const stored = await settings.getProviderWatchAuthorization();
            if (!stored) return null;
            return {
                month: stored.month,
                maxChargeMinor: stored.maxChargeMinor,
                ...(stored.accountId === undefined ? {} : { accountId: stored.accountId }),
                ...(stored.consumedByRunId === undefined
                    ? {}
                    : { consumedByRunId: stored.consumedByRunId })
            };
        },
        readBaseline: readAcceptedBaseline,
        startRun: openWatchRun,
        recordProgress: recordWatchProgress,
        finishRun: closeWatchRun,
        now: () => getClock().clock.now(),
        pingWatchdog: () => pingHealthchecks({ job: PROVIDER_WATCH_JOB_NAME, signal: 'success' })
    };
}

function result(args: {
    readonly ctx: CronJobContext;
    readonly success: boolean;
    readonly message: string;
    readonly processed?: number;
    readonly errors?: number;
    readonly details?: Record<string, unknown>;
}): CronJobResult {
    return {
        success: args.success,
        message: args.message,
        processed: args.processed ?? 0,
        errors: args.errors ?? (args.success ? 0 : 1),
        durationMs: Date.now() - args.ctx.startedAt.getTime(),
        ...(args.details ? { details: args.details } : {})
    };
}

/**
 * Builds the job over its ports.
 *
 * @param deps - See {@link ProviderWatchBatteryDeps}
 * @returns The cron job definition
 */
export function createProviderWatchBatteryJob(deps: ProviderWatchBatteryDeps): CronJobDefinition {
    return {
        name: PROVIDER_WATCH_JOB_NAME,
        description:
            'Repeat the provider measurements, compare values and response shapes, and mail the administrator what changed (HOS-1512, AC:B1:15)',
        schedule: PROVIDER_WATCH_SCHEDULE,
        exclusive: true,
        enabled: true,
        timeoutMs: PROVIDER_WATCH_RUN_DEADLINE_MS,
        budgetMs: PROVIDER_WATCH_RUN_BUDGET_MS,
        handler: async (ctx) => {
            const { logger, dryRun } = ctx;
            if (dryRun) {
                logger.info('Dry run mode - skipping the provider watch battery');
                return result({
                    ctx,
                    success: true,
                    message: 'Dry run - nothing measured',
                    details: { dryRun: true }
                });
            }
            const account = deps.resolveAccount();
            if (account === null) {
                logger.error(
                    'Provider watch battery cannot tell which account to watch: HOSPEDA_HEALTHCHECKS_SLUG_PREFIX is not staging or prod',
                    {},
                    { capture: true }
                );
                return result({
                    ctx,
                    success: false,
                    message: 'The environment does not say which provider account to watch'
                });
            }
            if (
                ctx.executionMode !== 'manual' &&
                !isScheduledTickDue({ account, now: deps.now() })
            ) {
                logger.info('Provider watch battery is not due today', { account });
                return result({
                    ctx,
                    success: true,
                    message: 'Not due today',
                    details: { account, skipped: 'not-due' }
                });
            }
            try {
                const { run, mayPingWatchdog } = await runWatchBattery({
                    account,
                    catalog: deps.catalog,
                    settings: deps.readSettings(),
                    transport: deps.buildTransport({ signal: ctx.signal }),
                    authorization: await deps.readAuthorization(),
                    clock: { now: deps.now },
                    signal: ctx.signal,
                    deadlineAt: ctx.deadlineAt,
                    readBaseline: deps.readBaseline,
                    startRun: deps.startRun,
                    recordProgress: deps.recordProgress,
                    finishRun: async ({ runId, run: record }) => {
                        await deps.finishRun({
                            runId,
                            run: record,
                            correlationId: ctx.correlationId
                        });
                    }
                });
                const details = {
                    account,
                    outcome: run.outcome,
                    measured: Object.keys(run.measurements).length,
                    alerts: run.alerts.length,
                    ...(run.reason === undefined ? {} : { reason: run.reason })
                };
                // B1: an authorization of 0 covers one run a day. A second run the same day (a manual
                // one, or a tick after one) finds the day taken: an expected skip, not a failure, so
                // it is logged at info, never sent to Sentry, and the job is not failed (re-review of
                // #4538, A2). The run row stays closed as refused, with its reason.
                if (
                    run.outcome === 'refused' &&
                    run.reason?.startsWith('AUTHORIZATION_DAY_TAKEN') === true
                ) {
                    logger.info('Provider watch battery skipped: today already ran', details);
                    return result({
                        ctx,
                        success: true,
                        message: 'Skipped: the authorization of 0 already covered a run today',
                        details: { ...details, skipped: 'day-taken' }
                    });
                }
                if (run.outcome !== 'completed') {
                    logger.error(
                        `Provider watch battery ${run.outcome}: ${run.reason ?? 'no reason recorded'}`,
                        details,
                        { capture: true }
                    );
                    return result({
                        ctx,
                        success: false,
                        message:
                            `Provider watch battery ${run.outcome}: ${run.reason ?? ''}`.trim(),
                        processed: details.measured,
                        details
                    });
                }
                if (mayPingWatchdog && ctx.signal?.aborted !== true) await deps.pingWatchdog();
                logger.info('Provider watch battery completed', details);
                return result({
                    ctx,
                    success: true,
                    message: `Measured ${details.measured}, ${details.alerts} change(s) mailed`,
                    processed: details.measured,
                    details
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(
                    'Provider watch battery failed',
                    { error: message },
                    { capture: true }
                );
                return result({
                    ctx,
                    success: false,
                    message: `Provider watch battery failed: ${message}`,
                    details: { account }
                });
            }
        }
    };
}

/** The registered job. */
export const providerWatchBatteryJob: CronJobDefinition = createProviderWatchBatteryJob(
    createProviderWatchBatteryDeps()
);
