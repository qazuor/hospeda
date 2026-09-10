/**
 * The one write that closes a subscription row whose checkout never completed
 * (HOS-1326).
 *
 * ---
 * WHAT THIS REPLACES
 *
 * Both create paths used to close such a row by calling
 * `billing.subscriptions.cancel(localRowId)`. That qzpay-core helper does two
 * things, not one: it forwards a cancel to the payment adapter, AND — whenever
 * `cancelAtPeriodEnd` is falsy, as it is on every one of these calls — it writes
 * `status: 'canceled'` + `canceledAt` on the LOCAL row.
 *
 * That local write is wrong twice over on a checkout that never started:
 *
 * - **wrong word** — the customer did not end a relationship, one never began.
 *   `abandoned` is the state this repo already has for it, and what the
 *   `abandoned-pending-subs` reaper writes for the same situation an hour later;
 * - **wrong spelling** — `canceled` is qzpay's American form, while every direct
 *   Hospeda writer uses `cancelled`. The row lands on the far side of a
 *   two-vocabulary column and is counted as churn by everything that reads
 *   cancellations (`billing-metrics.service.ts` filters on both spellings and on
 *   no product domain at all).
 *
 * ---
 * WHY IT IS A FUNCTION AND NOT THREE INLINE UPDATEs
 *
 * Because the WHERE is the part that is easy to get wrong, and it was gotten
 * wrong: the first version of this write asked `mp_subscription_id IS NULL` on a
 * column that holds `''`, matched zero rows, and left the subscription
 * non-terminal forever — strictly worse than the mislabelled row it replaced.
 * One implementation means one place to be right about that, and
 * {@link hasNoLinkedPreapprovalCondition} carries the reasoning.
 *
 * ---
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does **not** touch the provider. Callers that hold a real preapproval must
 * cancel it themselves first — through the payment adapter, never through
 * `billing.subscriptions.cancel()` — and only then call this. Bundling the two
 * would hide from the call site whether a live authorization was closed, which
 * is the one thing a compensating path must never be vague about.
 *
 * @module services/billing/abandon-never-confirmed-subscription
 */

import { PENDING_PROVIDER_STORED_STATUSES } from '@repo/billing';
import {
    and,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    hasNoLinkedPreapprovalCondition,
    inArray,
    isNull
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';

/** Which create path is closing the row — for the log line only. */
export type AbandonNeverConfirmedSource =
    | 'paid-subscription-create-missing-provider-id'
    | 'own-preapproval-create-local-write-failed';

/**
 * Input for {@link abandonNeverConfirmedSubscription}.
 */
export interface AbandonNeverConfirmedSubscriptionInput {
    /** The local `billing_subscriptions` row to close. */
    readonly subscriptionId: string;
    /**
     * The preapproval id this caller OBSERVED on the row, or `null` when the
     * checkout never obtained one.
     *
     * It becomes a precondition of the write, not a value written: passing an id
     * requires the column to still hold exactly that id, and passing `null`
     * requires it to still hold no usable id at all (`NULL` **or** `''` — see
     * {@link hasNoLinkedPreapprovalCondition}). Either way, a preapproval linked
     * between the caller's read and this write makes the UPDATE a no-op rather
     * than stranding a live authorization behind a terminal row.
     */
    readonly expectedMpSubscriptionId: string | null;
    /** Which path is calling — for the log line. */
    readonly source: AbandonNeverConfirmedSource;
    /** Optional client override (tests, or a caller inside a transaction). */
    readonly db?: DrizzleClient;
}

/**
 * Write the terminal `abandoned` status onto a never-confirmed subscription row.
 *
 * **Never throws.** Every caller is already on an error path returning its own
 * error, and a failure here only means the hourly `abandoned-pending-subs` reaper
 * closes the row instead — provided it is still pending, which is exactly what
 * the diagnostic log line below reports on.
 *
 * @param input - Row id, the observed preapproval id (as a preconditon), source.
 * @returns Whether the row was actually written.
 */
export async function abandonNeverConfirmedSubscription(
    input: AbandonNeverConfirmedSubscriptionInput
): Promise<{ readonly abandoned: boolean }> {
    const { subscriptionId, expectedMpSubscriptionId, source } = input;

    try {
        const writeClient = input.db ?? getDb();

        // A caller that observed an id demands that exact id; a caller that
        // observed none demands there is still none, in EITHER spelling.
        const mpGuard = expectedMpSubscriptionId
            ? eq(billingSubscriptions.mpSubscriptionId, expectedMpSubscriptionId)
            : hasNoLinkedPreapprovalCondition();

        const [row] = await writeClient
            .update(billingSubscriptions)
            .set({ status: SubscriptionStatusEnum.ABANDONED, updatedAt: new Date() })
            .where(
                and(
                    eq(billingSubscriptions.id, subscriptionId),
                    inArray(billingSubscriptions.status, [...PENDING_PROVIDER_STORED_STATUSES]),
                    mpGuard,
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .returning({ id: billingSubscriptions.id });

        if (row) {
            apiLogger.warn(
                { subscriptionId, source },
                'HOS-1326: abandoned a subscription whose checkout never completed'
            );
            return { abandoned: true };
        }

        // Re-read so the log says WHICH precondition refused, not merely that one
        // did. A no-op has two very different causes — a concurrent path already
        // moved the row (benign) versus a preapproval linked mid-flight (a live
        // authorization) — and naming neither is how a WHERE that matches nothing
        // looks identical to healthy contention.
        const [current] = await writeClient
            .select({
                status: billingSubscriptions.status,
                mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
                deletedAt: billingSubscriptions.deletedAt
            })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId))
            .limit(1);

        apiLogger.warn(
            {
                subscriptionId,
                source,
                expectedMpSubscriptionId,
                observedStatus: current?.status ?? null,
                observedMpSubscriptionId: current?.mpSubscriptionId ?? null,
                observedDeleted: current?.deletedAt != null,
                rowFound: current !== undefined
            },
            'HOS-1326: the abandon write matched no row. The abandoned-pending cron re-evaluates it hourly ONLY while it is still pending; a row that already left the pending statuses needs a human.'
        );
        return { abandoned: false };
    } catch (abandonError) {
        apiLogger.error(
            {
                subscriptionId,
                source,
                error: abandonError instanceof Error ? abandonError.message : String(abandonError)
            },
            'HOS-1326: FAILED to abandon a never-confirmed subscription — the abandoned-pending cron is the backstop while the row is still pending'
        );
        return { abandoned: false };
    }
}
