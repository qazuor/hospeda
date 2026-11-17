/**
 * Provider watch battery cron (HOS-1512, AC:B1:15, AC:B1:18, AC:B1:20).
 *
 * Repeats the measurements behind the fake's lies and rules against the real provider, reads
 * what changed, mails the administrator and adjusts nothing. This file only wires ports: the
 * engine, its guards and the catalog live in `@repo/payments`.
 *
 * One job, one weekly tick. The environment decides the account and the cadence: staging
 * watches the sandbox test account every week, production watches production on the first tick
 * of each month, and a manual trigger runs either at any time. Production does not start
 * without the owner's authorization of the current month.
 *
 * The external watchdog is pinged ONLY by a run that completed and measured at least one
 * entry. A run that failed, was aborted by a guard or measured nothing (the catalog is empty)
 * returns a non-success result and never pings: it can never report green.
 *
 * @module cron/jobs/provider-watch-battery
 */
import {
    createWatchTransport,
    runWatchBattery,
    WATCH_CATALOG,
    type WatchAccount,
    type WatchAuthorization,
    type WatchEntry,
    type WatchRunRecord,
    type WatchShapeBaseline,
    type WatchTransport
} from '@repo/payments';
import { PlatformSettingsService } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { env } from '../../utils/env.js';
import { pingHealthchecks } from '../../utils/healthchecks-ping.js';
import { apiLogger } from '../../utils/logger.js';
import {
    readPreviousShapes,
    recordWatchRun
} from '../../utils/provider-watch/provider-watch-run-store.js';
import {
    isScheduledTickDue,
    PROVIDER_WATCH_JOB_NAME,
    resolveWatchAccount
} from '../../utils/provider-watch/provider-watch-schedule.js';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** Weekly, Monday 07:17 market time. Production runs only the first tick of each month. */
export const PROVIDER_WATCH_SCHEDULE = '17 7 * * 1';

/** What the job reads and writes; every one is replaceable in tests. */
export interface ProviderWatchBatteryDeps {
    readonly resolveAccount: () => WatchAccount | null;
    readonly catalog: readonly WatchEntry[];
    readonly buildTransport: () => WatchTransport;
    readonly readAuthorization: () => Promise<WatchAuthorization | null>;
    readonly readPreviousShapes: (args: {
        readonly account: WatchAccount;
    }) => Promise<WatchShapeBaseline | null>;
    readonly recordRun: (args: {
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
        buildTransport: () => {
            const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
            if (!accessToken) {
                throw new Error(
                    'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN is not set: nothing to measure with'
                );
            }
            return createWatchTransport({
                baseUrl: env.HOSPEDA_MERCADO_PAGO_API_BASE_URL,
                accessToken,
                timeoutMs: env.HOSPEDA_MERCADO_PAGO_TIMEOUT
            });
        },
        readAuthorization: () => settings.getProviderWatchAuthorization(),
        readPreviousShapes,
        recordRun: recordWatchRun,
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
        timeoutMs: 600_000,
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
                logger.info('Provider watch battery is not due this week', { account });
                return result({
                    ctx,
                    success: true,
                    message: 'Not due this week',
                    details: { account, skipped: 'not-due' }
                });
            }
            try {
                const { run, mayPingWatchdog } = await runWatchBattery({
                    account,
                    catalog: deps.catalog,
                    transport: deps.buildTransport(),
                    authorization: await deps.readAuthorization(),
                    clock: { now: deps.now },
                    readPreviousShapes: deps.readPreviousShapes,
                    recordRun: ({ run: record }) =>
                        deps
                            .recordRun({ run: record, correlationId: ctx.correlationId })
                            .then(() => undefined)
                });
                const details = {
                    account,
                    outcome: run.outcome,
                    measured: Object.keys(run.measurements).length,
                    alerts: run.alerts.length,
                    ...(run.reason === undefined ? {} : { reason: run.reason })
                };
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
                if (mayPingWatchdog) await deps.pingWatchdog();
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
