/**
 * The watch battery's two database ports (HOS-1512): the shapes of the previous completed
 * run, and the write of the run together with the alert mail it provokes.
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

const baselineSchema = z.record(
    z.string(),
    z.object({ shapes: z.record(z.string(), z.record(z.string(), z.string())) })
);

/**
 * Reads the shapes of the latest completed run of an account: the baseline the next run
 * compares against. A stored run whose shapes cannot be read is logged and treated as no
 * baseline, so one bad row cannot stop the battery for good.
 *
 * @param args.account - The account the run targets
 * @returns The baseline, or `null` when the account has no completed run yet
 */
export async function readPreviousShapes(args: {
    readonly account: WatchAccount;
}): Promise<WatchShapeBaseline | null> {
    const row = await providerWatchRunModel.findLatestCompleted({ account: args.account });
    if (!row) return null;
    const parsed = baselineSchema.safeParse(row.measurements);
    if (!parsed.success) {
        apiLogger.warn(
            { runId: row.id, issues: parsed.error.issues.length },
            'Provider watch: the previous run has unreadable shapes; starting without a baseline'
        );
        return null;
    }
    return Object.fromEntries(Object.entries(parsed.data).map(([id, m]) => [id, m.shapes]));
}

/**
 * Writes one run and queues its alert mail in a single transaction. The write is part of the
 * run: when it fails, nothing is stored and nothing is mailed, and the error propagates so the
 * run fails.
 *
 * Alerts with no SUPER_ADMIN to receive them are an error too: a change nobody can be told
 * about must not be stored as if it had been reported.
 *
 * @param args.run - The run as it ended
 * @param args.correlationId - Correlation of the cron run
 * @returns The stored run id and how many mails were queued
 * @throws When there are alerts and no recipient, or when the database fails
 */
export async function recordWatchRun(args: {
    readonly run: WatchRunRecord;
    readonly correlationId: string;
}): Promise<{ readonly runId: string; readonly mailsQueued: number }> {
    const { run } = args;
    return getDb().transaction(async (tx) => {
        const recipients = run.alerts.length > 0 ? await listSuperAdminRecipients({ tx }) : [];
        if (run.alerts.length > 0 && recipients.length === 0) {
            throw new Error(
                'The provider watch run found changes and there is no SUPER_ADMIN to tell'
            );
        }
        const stored = await providerWatchRunModel.insert({
            run: {
                account: run.account,
                startedAt: run.startedAt,
                finishedAt: run.finishedAt,
                outcome: run.outcome,
                reason: run.reason ?? null,
                measurements: { ...run.measurements },
                alerts: run.alerts.map((alert) => ({
                    ...alert,
                    channel: PROVIDER_WATCH_ALERT_CHANNEL,
                    recipients: recipients.length
                }))
            },
            tx
        });
        const { queued } =
            run.alerts.length > 0
                ? await enqueueProviderWatchAlerts({
                      runId: stored.id,
                      account: run.account,
                      finishedAt: run.finishedAt,
                      alerts: run.alerts,
                      recipients,
                      correlationId: args.correlationId,
                      tx
                  })
                : { queued: 0 };
        return { runId: stored.id, mailsQueued: queued };
    });
}
