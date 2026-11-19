/**
 * Enqueues the provider watch alert mail on the common email outbox (U2, HOS-1512, AC:B1:15).
 *
 * The mail goes to every SUPER_ADMIN, in the same transaction that writes the run, so a run
 * that provoked an alert and a mail that was never queued cannot both exist. One template,
 * one dedup key per recipient and run: a retry never queues a second mail.
 *
 * @module utils/provider-watch/provider-watch-alert-outbox
 */
import type { DrizzleClient } from '@repo/db';
import { buildEmailDedupKey, buildEventOccurrence, emailOutboxModel } from '@repo/db';
import type { JsonValue, WatchAccount, WatchAlert, WatchRunOutcome } from '@repo/payments';

/** Template of the alert mail. Its renderer lives in `@repo/notifications`. */
export const PROVIDER_WATCH_ALERT_TEMPLATE = 'billing.provider-watch-alert';

/** The channel every alert goes out on today. */
export const PROVIDER_WATCH_ALERT_CHANNEL = 'email';

/** Longest value rendered in the mail; the stored run keeps the whole value. */
const MAX_RENDERED_VALUE_LENGTH = 600;

/** Most alerts one mail carries; the stored run keeps them all. */
const MAX_ALERTS_PER_MAIL = 100;

/**
 * Renders a JSON value as bounded text for the mail.
 *
 * @param args.value - The value
 * @returns Its JSON text, cut to the mail's limit
 */
export function describeValue(args: { readonly value: JsonValue }): string {
    const text = JSON.stringify(args.value) ?? 'undefined';
    return text.length > MAX_RENDERED_VALUE_LENGTH
        ? `${text.slice(0, MAX_RENDERED_VALUE_LENGTH)}…`
        : text;
}

/** Inputs of {@link enqueueProviderWatchAlerts}. */
export interface EnqueueProviderWatchAlertsInput {
    readonly runId: string;
    readonly account: WatchAccount;
    readonly finishedAt: Date;
    readonly alerts: readonly WatchAlert[];
    /** How the run ended; a run that did not complete says so in the mail, with its reason. */
    readonly outcome: WatchRunOutcome;
    readonly reason?: string | undefined;
    readonly recipients: readonly { readonly userId: string; readonly email: string }[];
    readonly correlationId: string;
    readonly tx: DrizzleClient;
}

/**
 * Queues one alert mail per recipient (one per SUPER_ADMIN, deduplicated by recipient and run),
 * carrying every alert of the run and, when the run failed or was aborted, how and why.
 *
 * @param input - See {@link EnqueueProviderWatchAlertsInput}
 * @returns How many mails were queued
 */
export async function enqueueProviderWatchAlerts(
    input: EnqueueProviderWatchAlertsInput
): Promise<{ readonly queued: number }> {
    const payload = {
        account: input.account,
        finishedAt: input.finishedAt.toISOString(),
        ...(input.outcome === 'failed' || input.outcome === 'aborted'
            ? {
                  run: {
                      outcome: input.outcome,
                      ...(input.reason === undefined ? {} : { reason: input.reason })
                  }
              }
            : {}),
        omitted: Math.max(0, input.alerts.length - MAX_ALERTS_PER_MAIL),
        alerts: input.alerts.slice(0, MAX_ALERTS_PER_MAIL).map((alert) => ({
            measurementId: alert.measurementId,
            kind: alert.kind,
            ...(alert.label === undefined ? {} : { label: alert.label }),
            expected: describeValue({ value: alert.expected }),
            obtained: describeValue({ value: alert.obtained }),
            details: [...alert.details]
        }))
    };
    let queued = 0;
    for (const recipient of input.recipients) {
        const result = await emailOutboxModel.enqueue(
            {
                recipientUserId: recipient.userId,
                recipientEmail: recipient.email,
                template: PROVIDER_WATCH_ALERT_TEMPLATE,
                payload,
                dedupKey: buildEmailDedupKey({
                    recipient: recipient.userId,
                    template: PROVIDER_WATCH_ALERT_TEMPLATE,
                    occurrence: buildEventOccurrence({ eventId: input.runId })
                }),
                correlationId: input.correlationId
            },
            input.tx
        );
        if (result.enqueued) queued += 1;
    }
    return { queued };
}
