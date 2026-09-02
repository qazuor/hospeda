/**
 * Durable audit seat for a MercadoPago pause that the provider refused (HOS-995).
 *
 * ## Why this exists
 *
 * Two Hospeda-owned flows are the same provider call underneath — `pause` on a
 * preapproval:
 *
 * - the host's self-serve pause (`routes/billing/subscription-pause.ts`),
 * - a courtesy gift, which IS a paused preapproval plus a local window
 *   (`services/courtesy-grant.service.ts`, HOS-180).
 *
 * Both are fail-closed: if MercadoPago refuses, nothing is written to the
 * subscription and nobody is left marked paused/courtesy while still being
 * charged. But fail-closed is not the same as *detectable*. Until this module,
 * a refusal produced one `apiLogger.error` line and no row anywhere — and log
 * lines are not queryable after the fact (they are shipped, sampled, and in this
 * repo a redirected `hops logs` is known to drop ERROR and WARN entirely).
 *
 * The admin pause is a third caller of the same MercadoPago endpoint, but it
 * runs inside qzpay-hono's own admin routes (`qzpay-admin-hooks.ts` only sees
 * the AFTER hook, so a refusal never reaches Hospeda code). It is deliberately
 * NOT seated here — {@link PauseRefusalSource} lists only what this module
 * actually records, so the absence of an `admin-pause` value is the honest
 * signal that the path is uncovered rather than an oversight.
 *
 * ## What it is actually for
 *
 * HOS-995 retired the guard that refused to pause annual subscriptions. That
 * guard rested on a premise HOS-171 (card-first) destroyed: an annual
 * subscription is a recurring preapproval today (MP `frequency: 12,
 * frequency_type: 'months'`), so there IS something to pause. What nobody has
 * verified is whether MercadoPago's pause endpoint behaves the same on a
 * twelve-month preapproval as on a one-month one — that is a manual sandbox
 * observation, not something code can assert.
 *
 * So this seat is the tripwire that stands in for the experiment until it runs.
 * If MercadoPago does refuse annual pauses, every occurrence lands in
 * `billing_subscription_events` carrying the interval and the provider's own
 * message, and the question is answered by a single query instead of by a
 * customer complaint:
 *
 * ```sql
 * SELECT metadata->>'billingInterval', count(*)
 * FROM billing_subscription_events
 * WHERE event_type = 'SUBSCRIPTION_PAUSE_PROVIDER_REFUSED'
 * GROUP BY 1;
 * ```
 *
 * @module services/billing/pause-refusal-audit
 */

import { billingSubscriptionEvents, getDb } from '@repo/db';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';

/**
 * Which caller was refused. Mirrors the `trigger_source` vocabulary already
 * used by the successful pause paths, so a refusal and the success it failed to
 * become sort together in the audit trail.
 */
export type PauseRefusalSource = 'host-pause' | 'admin-courtesy-grant';

/** Input for {@link recordPauseProviderRefusal}. */
export interface RecordPauseProviderRefusalInput {
    /** UUID of the subscription whose preapproval MercadoPago refused to pause. */
    readonly subscriptionId: string;
    /** The flow that attempted the pause. */
    readonly triggerSource: PauseRefusalSource;
    /**
     * The subscription's billing cadence, as recorded in its metadata. This is
     * the field the whole seat exists to collect — see the module docblock.
     * `null` when the row does not record one.
     */
    readonly billingInterval: string | null;
    /** Whatever the provider call threw. */
    readonly error: unknown;
}

/**
 * Records that MercadoPago refused to pause a preapproval.
 *
 * ## Never throws, by design
 *
 * Every caller is already on a failure path, handling a provider error it must
 * surface to the user. If writing this row failed and that failure propagated,
 * the audit seat would replace the real error with a database error — the
 * caller would report the wrong cause, and the refusal it was trying to record
 * would be lost anyway. So a failed write degrades to a log line and the
 * original error continues on its way untouched.
 *
 * @param input - See {@link RecordPauseProviderRefusalInput}.
 * @returns `true` when the row was written, `false` when the write itself
 *   failed. Callers may ignore it; tests assert on it.
 *
 * @example
 * ```ts
 * try {
 *   await billing.subscriptions.pause(id);
 * } catch (error) {
 *   await recordPauseProviderRefusal({
 *     subscriptionId: id,
 *     triggerSource: 'host-pause',
 *     billingInterval: 'annual',
 *     error,
 *   });
 *   throw new HTTPException(502, { message: 'PAUSE_PROVIDER_REFUSED: ...' });
 * }
 * ```
 */
export async function recordPauseProviderRefusal(
    input: RecordPauseProviderRefusalInput
): Promise<boolean> {
    const { subscriptionId, triggerSource, billingInterval, error } = input;
    const providerMessage = error instanceof Error ? error.message : String(error);

    try {
        await getDb().insert(billingSubscriptionEvents).values({
            subscriptionId,
            eventType: BILLING_EVENT_TYPES.SUBSCRIPTION_PAUSE_PROVIDER_REFUSED,
            // No `newStatus`: nothing transitioned. This is an operational
            // event on a subscription that stayed exactly as it was, which
            // is what the schema's nullable status columns are for.
            triggerSource,
            metadata: { billingInterval, providerMessage }
        });
        return true;
    } catch (auditError) {
        apiLogger.error(
            {
                subscriptionId,
                triggerSource,
                billingInterval,
                providerMessage,
                auditError: auditError instanceof Error ? auditError.message : String(auditError)
            },
            'Could not record the MercadoPago pause refusal; the refusal itself still stands'
        );
        return false;
    }
}
