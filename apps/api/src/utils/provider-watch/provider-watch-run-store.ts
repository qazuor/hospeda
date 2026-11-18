/**
 * The watch battery's database ports (HOS-1512): the shapes the owner ACCEPTED, the opening of a
 * run (which consumes the production authorization atomically), and the closing of a run together
 * with the alert mail it provokes.
 *
 * @module utils/provider-watch/provider-watch-run-store
 */
import { getDb, listSuperAdminRecipients, providerWatchRunModel } from '@repo/db';
import type { WatchAccount, WatchRunRecord, WatchShapeBaseline } from '@repo/payments';
import { z } from 'zod';
import { apiLogger } from '../logger.js';
import {
    enqueueProviderWatchAlerts,
    PROVIDER_WATCH_ALERT_CHANNEL
} from './provider-watch-alert-outbox.js';
import { PROVIDER_WATCH_RUN_DEADLINE_MS } from './provider-watch-schedule.js';

const shapesSchema = z.record(z.string(), z.record(z.string(), z.string()));

/**
 * Reads the shapes the owner accepted for an account. A baseline only advances when the owner
 * accepts a new shape in the admin; a run never moves it. A stored baseline that cannot be read is
 * logged and treated as absent.
 *
 * @param args.account - The account the run targets
 * @returns The accepted shapes by measurement id, or `null` when none was accepted yet
 */
export async function readAcceptedBaseline(args: {
    readonly account: WatchAccount;
}): Promise<WatchShapeBaseline | null> {
    const rows = await providerWatchRunModel.listBaselines({ account: args.account });
    if (rows.length === 0) return null;
    const baseline: Record<string, z.infer<typeof shapesSchema>> = {};
    for (const row of rows) {
        const parsed = shapesSchema.safeParse(row.shapes);
        if (!parsed.success) {
            apiLogger.warn(
                { account: args.account, measurementId: row.measurementId },
                'Provider watch: an accepted baseline is unreadable; that measurement has none'
            );
            continue;
        }
        baseline[row.measurementId] = parsed.data;
    }
    return baseline;
}

/**
 * Opens the run's row. For a production run that passed pre-flight it also consumes the owner's
 * authorization, atomically, in the same transaction.
 *
 * @param args.account - The account the run targets
 * @param args.startedAt - The run's instant
 * @param args.consumeAuthorization - The authorization to consume, with the values the run was pre-flighted with
 *
 * In the same transaction, any `running` row of this environment's account that is already past
 * the run deadline is closed as `failed` (reason `abandoned`) so a dead run never lingers; the
 * provider ids it recorded are kept.
 *
 * @returns The run id and whether this run consumed the authorization
 */
export async function openWatchRun(args: {
    readonly account: WatchAccount;
    readonly startedAt: Date;
    readonly consumeAuthorization?: {
        readonly month: string;
        readonly maxChargeMinor: number;
        readonly accountId: string;
    };
}): Promise<{ readonly runId: string; readonly authorizationConsumed: boolean }> {
    return providerWatchRunModel.open({
        ...args,
        abandonRunsStartedBefore: new Date(
            args.startedAt.getTime() - PROVIDER_WATCH_RUN_DEADLINE_MS
        )
    });
}

/**
 * Persists a provider id the moment the write that created it answers. It runs in its own
 * statement, never inside the closing transaction, so the id survives a run that dies or whose
 * closing rolls back.
 *
 * @param args.runId - The run
 * @param args.measurementId - The measurement that created it
 * @param args.providerIds - The ids the provider answered
 */
export async function recordWatchProgress(args: {
    readonly runId: string;
    readonly measurementId: string;
    readonly providerIds: readonly string[];
}): Promise<void> {
    await providerWatchRunModel.appendProviderIds(args);
}

/**
 * Closes the run and queues its alert mail in a single transaction. The write is part of the run:
 * when it fails, nothing is stored or mailed and the error propagates so the run fails.
 *
 * Alerts with no SUPER_ADMIN to receive them still persist the run, as FAILED, with its
 * measurements and the provider ids of what it created (a human needs them to cancel or refund),
 * and then fail the run: a change nobody can be told about is never stored as if it had been
 * reported.
 *
 * @param args.runId - The run opened by {@link openWatchRun}
 * @param args.run - The run as it ended
 * @param args.correlationId - Correlation of the cron run
 * @returns How many mails were queued
 * @throws When there are alerts and no recipient (after persisting the failed run), or when the
 *   database fails
 */
export async function closeWatchRun(args: {
    readonly runId: string;
    readonly run: WatchRunRecord;
    readonly correlationId: string;
}): Promise<{ readonly mailsQueued: number }> {
    const { run } = args;
    const outcome = await getDb().transaction(async (tx) => {
        const recipients = run.alerts.length > 0 ? await listSuperAdminRecipients({ tx }) : [];
        const undeliverable = run.alerts.length > 0 && recipients.length === 0;
        await providerWatchRunModel.close({
            id: args.runId,
            finishedAt: run.finishedAt,
            // A run that was already aborted or failed keeps that outcome; only a completed one
            // becomes failed because its alerts could not be delivered.
            outcome: undeliverable && run.outcome === 'completed' ? 'failed' : run.outcome,
            reason: undeliverable
                ? `ALERTS_NOT_DELIVERED: the run found changes and there is no SUPER_ADMIN to tell${run.reason ? ` (original: ${run.reason})` : ''}`
                : (run.reason ?? null),
            measurements: { ...run.measurements },
            alerts: run.alerts.map((alert) => ({
                ...alert,
                channel: undeliverable ? null : PROVIDER_WATCH_ALERT_CHANNEL,
                recipients: recipients.length
            })),
            tx
        });
        if (undeliverable) return { undeliverable: true as const, mailsQueued: 0 };
        const { queued } =
            run.alerts.length > 0
                ? await enqueueProviderWatchAlerts({
                      runId: args.runId,
                      account: run.account,
                      finishedAt: run.finishedAt,
                      alerts: run.alerts,
                      recipients,
                      correlationId: args.correlationId,
                      tx
                  })
                : { queued: 0 };
        return { undeliverable: false as const, mailsQueued: queued };
    });
    if (outcome.undeliverable) {
        throw new Error(
            `The provider watch run ${args.runId} found changes and there is no SUPER_ADMIN to tell; it was stored as failed`
        );
    }
    return { mailsQueued: outcome.mailsQueued };
}
