/**
 * Subscription Recurring Payment Webhook Handler (SPEC-141 D4).
 *
 * Handles MercadoPago `subscription_authorized_payment.{created,updated}`
 * events — the IPN notifications MP fires when a recurring monthly charge
 * is scheduled / executed against an active preapproval (subscription).
 *
 * What this handler does:
 * - Fetches the full authorized-payment object from MP REST (since the
 *   IPN payload only carries the authorized-payment ID).
 * - Resolves the linked local `billing_subscriptions` row from MP's
 *   `preapproval_id`.
 * - Inserts a `billing_payments` row for the recurring charge, with
 *   per-MP-payment-id idempotency so webhook retries do not duplicate.
 * - Always acknowledges the event so MP stops retrying, even on upstream
 *   failures (errors are logged, never re-thrown).
 *
 * - Converts a card-first trial the moment its day-N charge settles
 *   (HOS-171). This is the PRIMARY conversion path — see below.
 *
 * What this handler does NOT do:
 * - Recover a `past_due` subscription back to `active` when a retry
 *   succeeds — that transition flows through the
 *   `subscription_preapproval.updated` event and is handled upstream.
 *
 * ## Why the trial conversion lives HERE (HOS-171)
 *
 * When MercadoPago charges a card-first trial at day N, the preapproval's own
 * status does not change (`authorized` → `authorized`), so a
 * `subscription_preapproval.updated` event may never fire. THIS event is the
 * only signal that the charge happened at all.
 *
 * If the conversion waited for the daily `trial-reconcile` cron instead, the
 * local row would stay `trialing` with an elapsed `trial_end` for up to 24h —
 * and `middlewares/trial.ts` answers every write from that state with HTTP 402.
 * A customer MercadoPago just charged successfully would be locked out of their
 * own account, right after paying. Converting here closes that window to
 * seconds; the cron stays as the backstop for when this webhook is lost or
 * dropped (see HOS-159 — MP webhooks silently failed to arrive in production
 * for a whole period, which is exactly why a backstop must exist and exactly
 * why it must not be the primary path).
 *
 * @module routes/webhooks/mercadopago/subscription-payment-handler
 */

import type { QZPayCurrency, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import {
    and,
    billingPayments,
    billingPlanPriceChanges,
    billingPlanPriceChangeTargets,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull,
    sql
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    checkSubscriptionStatusTransition,
    detectExternalChargeInterference,
    detectPlanPriceDivergence,
    resolveDiscountAwareExpectedCentavos,
    resolveFullPlanPriceCentavos,
    resolveIntervalScopedPlanPriceCentavos,
    resolveRenewalPromoEffect,
    withServiceTransaction
} from '@repo/service-core';
import { getQZPayBilling } from '../../../middlewares/billing.js';
import { clearEntitlementCache } from '../../../middlewares/entitlement.js';
import { restoreFullPriceMutation } from '../../../services/promo-renewal-mp.service.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    fetchAuthorizedPaymentDetails,
    type MPAuthorizedPaymentDetails
} from '../../../utils/mp-authorized-payment.js';
import { cleanupRequestProviderEventId } from './event-handler.js';
import { markEventFailedByProviderId, markEventProcessedByProviderId } from './utils.js';

const MP_PROVIDER_KEY = 'mercadopago';
const FALLBACK_CURRENCY: QZPayCurrency = 'ARS';

/**
 * Extract the authorized-payment ID from a MercadoPago webhook event
 * payload, if present. MP wraps the ID in `data.id`. Defensive against
 * malformed payloads (returns `null` rather than throwing).
 */
function extractAuthorizedPaymentId(event: { data: unknown }): string | null {
    const data = event.data;
    if (!data || typeof data !== 'object') {
        return null;
    }
    const candidate = (data as Record<string, unknown>).id;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

/**
 * Map a MercadoPago authorized-payment status to a `QZPayPaymentStatus`.
 *
 * Prefers the inner `payment.status` (reflects the actual gateway
 * disposition) and falls back to the outer authorization-lifecycle
 * `status` when the inner block is absent.
 */
function mapMpStatusToQZPayStatus(details: MPAuthorizedPaymentDetails): QZPayPaymentStatus {
    const source = details.paymentStatus ?? details.status;
    switch (source) {
        case 'approved':
        case 'processed':
            return 'succeeded';
        case 'rejected':
            return 'failed';
        case 'cancelled':
        case 'canceled':
            return 'canceled';
        case 'refunded':
            return 'refunded';
        case 'in_process':
        case 'in_mediation':
            return 'processing';
        default:
            return 'pending';
    }
}

/**
 * Find the local `billing_subscriptions` row mapped to a MercadoPago
 * preapproval ID. Returns the bare minimum needed to record a payment
 * (`id`, `customerId`).
 */
async function findLocalSubscriptionByPreapprovalId(preapprovalId: string): Promise<{
    id: string;
    customerId: string;
    planId: string | null;
    status: string;
    trialEnd: Date | null;
    /**
     * Subscription-vocabulary interval (`'month' | 'year'`), or `null`. Additive
     * for HOS-176's plan-price divergence detector; the other caller
     * (`webhook-retry.job.ts`) simply ignores the extra field.
     */
    billingInterval: string | null;
} | null> {
    const db = getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            status: billingSubscriptions.status,
            trialEnd: billingSubscriptions.trialEnd,
            billingInterval: billingSubscriptions.billingInterval
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.mpSubscriptionId, preapprovalId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Convert a card-first trial the moment MercadoPago's day-N charge settles
 * (HOS-171).
 *
 * The provider just took the money, so the local row must stop claiming the
 * customer is on a trial — otherwise `getTrialStatus` reports an elapsed trial
 * and the trial middleware 402s every write from a customer who is paid up.
 *
 * Idempotent by construction: it only acts on a `trialing` row, and the first
 * run leaves it `active`, so a webhook retry (or the backstop cron) finds
 * nothing to do. Writes the same `TRIAL_RECONCILED` event the cron writes —
 * same fact, different discoverer, distinguished by `triggerSource` — which
 * also makes the cron's dedup guard skip this subscription.
 *
 * Never throws: the charge already settled and is already recorded. Failing to
 * flip a status must not turn into a webhook retry storm.
 *
 * @internal
 */
async function convertTrialOnSettledCharge(params: {
    subscription: { id: string; customerId: string; status: string; trialEnd: Date | null };
    eventId: string | number;
    requestId: string;
}): Promise<void> {
    const { subscription, eventId, requestId } = params;

    if (subscription.status !== SubscriptionStatusEnum.TRIALING) {
        return;
    }

    try {
        const guard = checkSubscriptionStatusTransition({
            from: subscription.status as `${SubscriptionStatusEnum}`,
            to: SubscriptionStatusEnum.ACTIVE,
            subscriptionId: subscription.id
        });
        if (!guard.valid) {
            apiLogger.warn(
                { eventId, requestId, localSubscriptionId: subscription.id, reason: guard.reason },
                'MercadoPago webhook: trial conversion blocked by the status guard — the reconcile cron will retry'
            );
            return;
        }

        await withServiceTransaction(async (ctx) => {
            // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
            const tx = ctx.tx!;

            await tx
                .update(billingSubscriptions)
                .set({
                    status: SubscriptionStatusEnum.ACTIVE,
                    trialConverted: true,
                    trialConvertedAt: new Date()
                })
                .where(eq(billingSubscriptions.id, subscription.id));

            await tx.insert(billingSubscriptionEvents).values({
                subscriptionId: subscription.id,
                eventType: BILLING_EVENT_TYPES.TRIAL_RECONCILED,
                previousStatus: subscription.status,
                newStatus: SubscriptionStatusEnum.ACTIVE,
                triggerSource: 'subscription-authorized-payment-webhook',
                metadata: {
                    trialEnd: subscription.trialEnd?.toISOString() ?? null,
                    converted: true,
                    reconciledAt: new Date().toISOString()
                }
            });
        });

        // The customer just gained a paid entitlement set — do not make them wait
        // out the 5-minute cache to use what they paid for (INV-1).
        clearEntitlementCache(subscription.customerId);

        apiLogger.info(
            {
                eventId,
                requestId,
                localSubscriptionId: subscription.id,
                customerId: subscription.customerId
            },
            'MercadoPago webhook: card-first trial converted to active on its first settled charge'
        );
    } catch (err) {
        // The reconcile cron is the backstop; log and let it pick this up.
        apiLogger.error(
            {
                eventId,
                requestId,
                localSubscriptionId: subscription.id,
                error: err instanceof Error ? err.message : String(err)
            },
            'MercadoPago webhook: failed to convert a card-first trial — the reconcile cron will retry',
            { capture: true }
        );
    }
}

/**
 * Report a charge that MercadoPago's own campaign engine altered (HOS-171 §7.5).
 *
 * Deliberately NOT fail-closed: the card was already debited and MP considers
 * the matter closed, so rejecting the charge here would only desynchronise us
 * from reality. We record the money that actually arrived and shout about the
 * gap.
 *
 * Never throws — an accounting alert must not break payment recording.
 *
 * @internal
 */
async function reportExternalChargeInterference(params: {
    details: MPAuthorizedPaymentDetails;
    localSubscriptionId: string;
    planId: string | null;
    chargedAmountCentavos: number;
    eventId: string | number;
    requestId: string;
}): Promise<void> {
    const { details, localSubscriptionId, planId, chargedAmountCentavos, eventId, requestId } =
        params;

    try {
        // Cheap pre-check: the plan price lookup below is only worth a query when
        // MP actually reported a campaign, which is the rare case.
        if (
            (details.couponAmount === null || details.couponAmount <= 0) &&
            (details.campaignId === null || details.campaignId.length === 0)
        ) {
            return;
        }

        const expectedAmountCentavos = await resolveFullPlanPriceCentavos(getDb(), planId);

        const interference = detectExternalChargeInterference({
            couponAmount: details.couponAmount,
            campaignId: details.campaignId,
            chargedAmountCentavos,
            expectedAmountCentavos
        });

        if (!interference) {
            return;
        }

        const detail = {
            eventId,
            requestId,
            localSubscriptionId,
            mpPaymentId: details.paymentId,
            campaignId: interference.campaignId,
            couponAmountCentavos: interference.couponAmountCentavos,
            chargedAmountCentavos: interference.chargedAmountCentavos,
            expectedAmountCentavos: interference.expectedAmountCentavos,
            shortfallCentavos: interference.shortfallCentavos
        };

        // Actionable: someone configured an account-level discount campaign in the
        // MercadoPago panel and it is silently eating subscription revenue.
        apiLogger.error(
            detail,
            'MercadoPago webhook: subscription charge was altered by a MercadoPago discount campaign — payment accepted, revenue does not match the plan',
            { capture: true }
        );
    } catch (err) {
        apiLogger.warn(
            {
                eventId,
                requestId,
                localSubscriptionId,
                error: err instanceof Error ? err.message : String(err)
            },
            'MercadoPago webhook: charge-interference check failed — payment recording unaffected'
        );
    }
}

/**
 * Report a recurring charge whose amount SILENTLY diverges from the current plan
 * price for a reason OTHER than a MercadoPago discount campaign (HOS-176).
 *
 * Sibling to {@link reportExternalChargeInterference}: that one catches MP's own
 * campaign engine (`coupon_amount` / `campaign_id`); this one catches the case
 * those fields are absent yet the charge still differs from the current
 * (discount-aware, interval-scoped) plan price — e.g. a plan price change whose
 * propagation to this subscriber's preapproval failed, or a stale/lagging
 * preapproval the propagate-plan-price-changes cron never re-priced.
 *
 * Suppression (all EXPECTED, non-divergence reasons — checked in order):
 *   1. MP reported a coupon/campaign → {@link reportExternalChargeInterference}'s
 *      job; skip to avoid double-alerting.
 *   2. Non-ARS currency → plan prices are ARS; a cross-currency compare is meaningless.
 *   3. No plan id or no interval → cannot resolve an expected price.
 *   4. An in-flight price change for this plan+interval (`pending`/`applying`/
 *      `noticing`) → a divergence is EXPECTED while propagation is mid-flight.
 *   5. An active target for THIS subscription (`pending`/`deferred`) → this sub is
 *      queued to be (or is being) re-priced right now. A terminal `skipped`/`failed`
 *      target is NOT suppressed — a failed propagation IS a real revenue divergence
 *      worth re-alerting until an operator reconciles it.
 *   6. Expected price unresolvable → warn + skip (cannot compare).
 *   7. Discount-aware expected amount indeterminate → skip (avoid a false positive).
 *
 * Never fail-closed and never throws: the card was already debited and MP considers
 * the matter settled. We record the money that arrived (done upstream) and, if it
 * does not match, shout about it (`capture: true`).
 *
 * KNOWN LIMITATION (HOS-176 v1): a GRANDFATHERED trialing subscriber — one that
 * received an INCREASE notice but was kept at the OLD price through its in-flight
 * trial (owner decision D-4) — will trip this detector once it converts and charges
 * the old (lower) price, because no in-flight change or active target suppresses it
 * by then. This is ACCEPTABLE for now: the increase path is gated OFF
 * (`HOSPEDA_BILLING_PRICE_INCREASE_ENABLED=false`), so it cannot occur in production,
 * and the future "re-price a grandfathered trialing sub after its first charge" item
 * is the real fix. Do NOT special-case trialing subs here to hide it.
 *
 * @internal
 */
async function reportPlanPriceDivergence(params: {
    details: MPAuthorizedPaymentDetails;
    localSubscriptionId: string;
    planId: string | null;
    billingInterval: string | null;
    chargedAmountCentavos: number;
    currency: string;
    eventId: string | number;
    requestId: string;
}): Promise<void> {
    const {
        details,
        localSubscriptionId,
        planId,
        billingInterval,
        chargedAmountCentavos,
        currency,
        eventId,
        requestId
    } = params;

    try {
        // 1. MP campaign already owns this charge — reportExternalChargeInterference
        //    handles it; skip so we do not double-alert on the same gap.
        if (
            (details.couponAmount !== null && details.couponAmount > 0) ||
            (details.campaignId !== null && details.campaignId.length > 0)
        ) {
            return;
        }

        // 2. Plan prices are ARS — a cross-currency comparison is meaningless.
        if (currency !== 'ARS') {
            return;
        }

        // 3. Without a plan id there is no expected price to resolve. The interval
        //    must ALSO be exactly a productized single-period value (`'month'` or
        //    `'year'`) — a lagging row may carry neither, and a non-productized
        //    interval (e.g. the hidden test-`'day'` plan) has no comparable price
        //    row. This narrows `billingInterval` to `'month' | 'year'`, so the
        //    interval-scoped price lookup below receives a correct, safe value.
        if (planId == null || (billingInterval !== 'month' && billingInterval !== 'year')) {
            return;
        }

        const db = getDb();

        // 4. In-flight propagation for this plan+interval → divergence is EXPECTED
        //    while the cron is mid-flight. (No soft-delete column on this table.)
        const inflightChange = await db
            .select({ id: billingPlanPriceChanges.id })
            .from(billingPlanPriceChanges)
            .where(
                and(
                    eq(billingPlanPriceChanges.planId, planId),
                    eq(billingPlanPriceChanges.billingInterval, billingInterval),
                    inArray(billingPlanPriceChanges.status, ['pending', 'applying', 'noticing'])
                )
            )
            .limit(1);
        if (inflightChange.length > 0) {
            return;
        }

        // 5. An active (non-terminal) target for THIS sub → it is queued to be, or is
        //    being, re-priced right now. `skipped`/`failed` are terminal and NOT
        //    suppressed: a failed propagation is a genuine revenue divergence to re-alert.
        const activeTarget = await db
            .select({ id: billingPlanPriceChangeTargets.id })
            .from(billingPlanPriceChangeTargets)
            .where(
                and(
                    eq(billingPlanPriceChangeTargets.subscriptionId, localSubscriptionId),
                    inArray(billingPlanPriceChangeTargets.status, ['pending', 'deferred'])
                )
            )
            .limit(1);
        if (activeTarget.length > 0) {
            return;
        }

        // 6. Interval-SCOPED full plan price (NOT the interval-ambiguous
        //    resolveFullPlanPriceCentavos, which would return a monthly price for an
        //    annual sub and manufacture a false positive). `billingInterval` is
        //    already narrowed to `'month' | 'year'` by the step-3 guard above.
        const fullCentavos = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId,
            billingInterval
        });
        if (fullCentavos === null) {
            apiLogger.warn(
                { eventId, requestId, localSubscriptionId, planId, billingInterval },
                'MercadoPago webhook: cannot determine the expected plan price for divergence check — skipping'
            );
            return;
        }

        // 7. Discount-aware expected amount. Indeterminate → skip (never a false positive).
        const expected = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: localSubscriptionId,
            fullCentavos
        });
        if ('indeterminate' in expected) {
            return;
        }

        const divergence = detectPlanPriceDivergence({
            chargedAmountCentavos,
            expectedAmountCentavos: expected.amount
        });
        if (!divergence) {
            return;
        }

        const detail = {
            eventId,
            requestId,
            localSubscriptionId,
            mpPaymentId: details.paymentId,
            planId,
            billingInterval,
            chargedAmountCentavos: divergence.chargedAmountCentavos,
            expectedAmountCentavos: divergence.expectedAmountCentavos,
            deltaCentavos: divergence.deltaCentavos,
            direction: divergence.direction
        };

        // Actionable: MP charged an amount that does not match the current plan price,
        // and it is NOT an MP campaign, NOT mid-propagation, NOT a queued re-price.
        // Revenue does not match the plan — an operator must reconcile.
        apiLogger.error(
            detail,
            'MercadoPago webhook: subscription charge diverges from the current plan price (no MP campaign, no in-flight propagation) — payment accepted, revenue does not match the plan',
            { capture: true }
        );
    } catch (err) {
        apiLogger.warn(
            {
                eventId,
                requestId,
                localSubscriptionId,
                error: err instanceof Error ? err.message : String(err)
            },
            'MercadoPago webhook: plan-price divergence check failed — payment recording unaffected'
        );
    }
}

/**
 * Check whether a `billing_payments` row already exists for the given
 * MercadoPago payment ID. Uses the JSONB `provider_payment_ids` map
 * (shape `{ mercadopago: paymentId }`) for the lookup, matching the
 * pattern used by qzpay-drizzle's repository.
 */
async function paymentAlreadyRecorded(providerPaymentId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(
            and(
                sql`${billingPayments.providerPaymentIds}->>${MP_PROVIDER_KEY} = ${providerPaymentId}`,
                isNull(billingPayments.deletedAt)
            )
        )
        .limit(1);
    return rows.length > 0;
}

/**
 * Mark a webhook event as processed without ever throwing — logs the
 * failure if the update itself fails so MP can retry.
 */
async function safeMarkProcessed(eventId: string | number): Promise<void> {
    try {
        await markEventProcessedByProviderId({ providerEventId: String(eventId) });
    } catch (err) {
        apiLogger.warn(
            { eventId, error: err instanceof Error ? err.message : String(err) },
            'Failed to mark subscription_authorized_payment event as processed'
        );
    }
}

/**
 * Apply the SPEC-262 multi-cycle promo discount decision after a recurring
 * charge is confirmed.
 *
 * Calls `resolveRenewalPromoEffect` (service-core decides + persists the
 * decremented `promo_effect_remaining_cycles`), then EXECUTES the MercadoPago
 * mutation only when the discount has just been exhausted (`restore-full`).
 *
 * Never throws — a failure here must not block the webhook bucket (the charge
 * already settled). The MP restore is best-effort-with-retry inside
 * `restoreFullPriceMutation`, which reports to Sentry on exhaustion.
 *
 * @internal
 */
async function handleRenewalPromoEffect(params: {
    localSubscriptionId: string;
    mpSubscriptionId: string;
    /**
     * Amount actually charged for this confirmed cycle, in integer centavos.
     * HOS-245: passed through so `resolveRenewalPromoEffect` only advances the
     * discount countdown when the charge reflected the discounted amount.
     */
    chargedAmountCentavos: number;
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    eventId: string | number;
    requestId: string;
}): Promise<void> {
    const {
        localSubscriptionId,
        mpSubscriptionId,
        chargedAmountCentavos,
        billing,
        eventId,
        requestId
    } = params;

    try {
        const decision = await resolveRenewalPromoEffect({
            subscriptionId: localSubscriptionId,
            chargedAmountCentavos
        });

        if (!decision.success) {
            apiLogger.warn(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    error: decision.error.message
                },
                'MercadoPago webhook: failed to resolve renewal promo effect — skipping amount reconciliation'
            );
            return;
        }

        const data = decision.data;

        // comp / noop / apply-discount (still discounted): no MP mutation needed.
        // - comp: never charged, no preapproval to mutate.
        // - apply-discount: the amount is already at the discounted value (set at
        //   apply time); the counter was just decremented by service-core.
        // - noop: no promo, non-discount effect, or already exhausted.
        if (data.action !== 'restore-full') {
            apiLogger.debug(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    action: data.action,
                    remainingCyclesAfter: data.remainingCyclesAfter ?? null
                },
                'MercadoPago webhook: renewal promo effect resolved — no MP amount mutation required'
            );
            return;
        }

        // restore-full: the last discounted cycle just charged. Raise the
        // preapproval amount back to full price for the NEXT cycle (best-effort).
        if (data.targetTransactionAmountMajor === undefined) {
            apiLogger.error(
                { eventId, requestId, localSubscriptionId },
                'MercadoPago webhook: restore-full decision missing targetTransactionAmountMajor — skipping MP restore'
            );
            return;
        }

        const restoreResult = await restoreFullPriceMutation({
            billing,
            mpSubscriptionId,
            targetTransactionAmountMajor: data.targetTransactionAmountMajor,
            subscriptionId: localSubscriptionId
        });

        if (!restoreResult.success) {
            // Already logged + Sentry-captured inside restoreFullPriceMutation.
            apiLogger.warn(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    mpSubscriptionId,
                    error: restoreResult.error.message
                },
                'MercadoPago webhook: full-price restore failed (best-effort) — preapproval may stay discounted one extra cycle'
            );
        }
    } catch (renewalErr) {
        // Defensive: resolveRenewalPromoEffect already returns typed errors, but
        // a thrown error must never bubble up and block the webhook ack.
        apiLogger.error(
            {
                eventId,
                requestId,
                localSubscriptionId,
                error: renewalErr instanceof Error ? renewalErr.message : String(renewalErr)
            },
            'MercadoPago webhook: unexpected error during renewal promo effect handling — webhook still acknowledged'
        );
    }
}

/**
 * Handler for `subscription_authorized_payment.{created,updated}` events.
 *
 * MP fires `.created` when a recurring charge enters the system (status
 * `scheduled` / `processed` / `recycling` / `cancelled`) and `.updated`
 * on state transitions. Both share the same payload shape, so one
 * handler covers both.
 *
 * Errors are intentionally swallowed (logged, not re-thrown) — a single
 * noisy event must not block the webhook bucket. The event is always
 * marked processed so MP stops retrying.
 */
export const handleSubscriptionAuthorizedPayment: QZPayWebhookHandler = async (c, event) => {
    const requestId = String(c.get('requestId') || event.id);
    const authorizedPaymentId = extractAuthorizedPaymentId(event);

    if (!authorizedPaymentId) {
        apiLogger.warn(
            { eventId: event.id, requestId },
            'MercadoPago webhook: subscription_authorized_payment event has no extractable authorized-payment ID'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        // SPEC-180: missing access token is a config error — actionable.
        apiLogger.error(
            { eventId: event.id, requestId, authorizedPaymentId },
            'MercadoPago webhook: HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN not configured — cannot fetch authorized-payment details',
            { capture: true }
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const billing = getQZPayBilling();
    if (!billing) {
        // SPEC-180: billing instance unavailable is a config error — actionable.
        apiLogger.error(
            { eventId: event.id, requestId, authorizedPaymentId },
            'MercadoPago webhook: QZPay billing instance unavailable — cannot record payment',
            { capture: true }
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const fetchResult = await fetchAuthorizedPaymentDetails({
        authorizedPaymentId,
        accessToken
    });

    if (fetchResult.kind !== 'ok') {
        apiLogger.warn(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                kind: fetchResult.kind,
                message: fetchResult.kind === 'error' ? fetchResult.message : undefined
            },
            'MercadoPago webhook: failed to fetch authorized-payment details — event acknowledged without recording'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const details = fetchResult.details;

    // No real payment.id yet (status='scheduled' or pre-settlement): nothing
    // to record. A later .updated event will carry the settled paymentId.
    if (!details.paymentId) {
        apiLogger.info(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                preapprovalId: details.preapprovalId,
                status: details.status
            },
            'MercadoPago webhook: authorized-payment has no settled payment yet; nothing to record'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    try {
        const sub = await findLocalSubscriptionByPreapprovalId(details.preapprovalId);
        if (!sub) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    preapprovalId: details.preapprovalId
                },
                'MercadoPago webhook: no local subscription found for preapproval ID — payment NOT recorded'
            );
            await safeMarkProcessed(event.id);
            cleanupRequestProviderEventId(requestId);
            return undefined;
        }

        if (await paymentAlreadyRecorded(details.paymentId)) {
            apiLogger.info(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    mpPaymentId: details.paymentId,
                    localSubscriptionId: sub.id
                },
                'MercadoPago webhook: payment already recorded for this MP payment ID; idempotent skip'
            );
            await safeMarkProcessed(event.id);
            cleanupRequestProviderEventId(requestId);
            return undefined;
        }

        // Convert major units (e.g. 999.50 ARS) to integer centavos for storage.
        const amountInCentavos = Math.round(details.transactionAmount * 100);
        const status = mapMpStatusToQZPayStatus(details);
        const currency: QZPayCurrency = (details.currencyId as QZPayCurrency) || FALLBACK_CURRENCY;

        if (details.currencyId !== currency) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    receivedCurrency: details.currencyId,
                    fallbackCurrency: currency
                },
                'MercadoPago webhook: authorized-payment currency mismatch; fell back to default'
            );
        }

        const recorded = await billing.payments.record({
            id: crypto.randomUUID(),
            customerId: sub.customerId,
            amount: amountInCentavos,
            currency,
            status,
            provider: MP_PROVIDER_KEY,
            providerPaymentId: details.paymentId,
            subscriptionId: sub.id,
            metadata: {
                mpAuthorizedPaymentId: details.authorizedPaymentId,
                mpDebitDate: details.debitDate ?? null
            }
        });

        apiLogger.info(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                mpPaymentId: details.paymentId,
                localSubscriptionId: sub.id,
                billingPaymentId: recorded.id,
                amountInCentavos,
                currency,
                status
            },
            'MercadoPago webhook: recurring payment recorded in billing_payments'
        );

        // Accounting defense (HOS-171 §7.5): the money that arrived is now on
        // record; check whether MercadoPago's own campaign engine is the reason
        // it is not the amount we asked for. Fire-and-forget so an accounting
        // alert never delays the webhook ACK, and never fail-closed — the charge
        // already settled.
        void reportExternalChargeInterference({
            details,
            localSubscriptionId: sub.id,
            planId: sub.planId,
            chargedAmountCentavos: amountInCentavos,
            eventId: event.id,
            requestId
        });

        // Accounting defense (HOS-176): the SILENT sibling of the campaign check
        // above — catch a charge that diverges from the current plan price for a
        // reason MP does NOT report (failed/lagging price propagation), suppressing
        // every expected divergence (MP campaign, in-flight change, active re-price
        // target). Fire-and-forget + never fail-closed, same as its sibling.
        void reportPlanPriceDivergence({
            details,
            localSubscriptionId: sub.id,
            planId: sub.planId,
            billingInterval: sub.billingInterval,
            chargedAmountCentavos: amountInCentavos,
            currency,
            eventId: event.id,
            requestId
        });

        // SPEC-262 T-007 (B2 fix): Only decrement the cycle counter when the
        // charge SUCCEEDED. A rejected/failed/pending charge must not consume a
        // discounted cycle — the next MP retry (different paymentId, passes the
        // per-paymentId dedup) would decrement again → discount ends early.
        // 'processing' (MP 'in_process'/'in_mediation') is NOT terminal: it can
        // still transition to 'rejected', so decrementing on it and again on the
        // eventual retry double-consumes a cycle. Gate strictly on 'succeeded'.
        if (status === 'succeeded') {
            // HOS-171: the charge landed, so this is no longer a trial. Awaited
            // rather than fire-and-forget — it is the PRIMARY conversion path,
            // and until it commits the trial middleware 402s this (paid-up)
            // customer on every write. The daily cron is only the backstop.
            await convertTrialOnSettledCharge({
                subscription: sub,
                eventId: event.id,
                requestId
            });

            // SPEC-262 T-007: multi-cycle promo discount renewal handling.
            // Anchor the discounted-cycle countdown on this post-charge event
            // (spike doc §5.2). service-core DECIDES + persists the decremented
            // counter; this handler EXECUTES the MP restore when the discount is
            // exhausted. Never blocks the webhook — the charge already happened.
            //
            // NIT: handleRenewalPromoEffect is fire-and-forget (void) so the
            // internal restore-retry loop (up to 3×500ms) does NOT add latency
            // to the webhook ACK path. The charge already settled; the restore
            // is best-effort and Sentry-reported on exhaustion.
            void handleRenewalPromoEffect({
                localSubscriptionId: sub.id,
                mpSubscriptionId: details.preapprovalId,
                // HOS-245: the amount actually settled for this cycle (integer
                // centavos) so the discount countdown only advances on a charge
                // that reflected the discount.
                chargedAmountCentavos: amountInCentavos,
                billing,
                eventId: event.id,
                requestId
            });
        }
    } catch (recordErr) {
        // Transient / unexpected error (DB hiccup, record() failure). Mark the
        // event failed so the dead-letter queue can retry it rather than
        // silently treating it as processed. MP will not retry acknowledged
        // events, so our own retry mechanism is the only recovery path.
        const errMessage = recordErr instanceof Error ? recordErr.message : String(recordErr);
        // SPEC-180: payment recording failure is actionable — it blocks revenue reconciliation.
        apiLogger.error(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                error: errMessage
            },
            'MercadoPago webhook: unexpected error while recording subscription_authorized_payment — marking event failed for retry',
            { capture: true }
        );
        try {
            await markEventFailedByProviderId({
                providerEventId: String(event.id),
                errorMessage: errMessage
            });
        } catch (markErr) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    error: markErr instanceof Error ? markErr.message : String(markErr)
                },
                'Failed to mark subscription_authorized_payment event as failed — event may be reprocessed'
            );
        }
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    await safeMarkProcessed(event.id);
    cleanupRequestProviderEventId(requestId);
    return undefined;
};

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    extractAuthorizedPaymentId,
    mapMpStatusToQZPayStatus,
    findLocalSubscriptionByPreapprovalId,
    paymentAlreadyRecorded,
    safeMarkProcessed,
    reportPlanPriceDivergence
};

// ---------------------------------------------------------------------------
// Shared helpers — exported for reuse by the dead-letter retry cron job.
// Naming convention: production-safe exports use a `sharedForRetry` namespace
// to distinguish them from the test-only `_internals` object.
// ---------------------------------------------------------------------------

/**
 * Resolve a local `billing_subscriptions` row from a MercadoPago preapproval
 * ID. Shared between the live webhook handler and the dead-letter retry job
 * so both use the same lookup logic.
 *
 * @param preapprovalId - The MercadoPago preapproval (subscription) ID.
 * @returns The local subscription's `id` and `customerId`, or `null` if not found.
 */
/**
 * Check whether a `billing_payments` row already exists for a given
 * MercadoPago payment ID. Used by both the live handler and the dead-letter
 * retry cron to prevent duplicate records.
 *
 * @param providerPaymentId - The MercadoPago payment ID to check.
 * @returns `true` if a record already exists.
 */
export { findLocalSubscriptionByPreapprovalId, paymentAlreadyRecorded };
