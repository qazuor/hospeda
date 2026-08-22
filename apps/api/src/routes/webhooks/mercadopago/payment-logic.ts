/**
 * Shared payment processing logic.
 *
 * Extracted from payment-handler.ts and webhook-retry.job.ts to eliminate
 * ~120 lines of duplicated business logic. This module handles:
 * - Payment status notification dispatch (success/failure)
 * - Add-on purchase confirmation and notification
 *
 * @module routes/webhooks/mercadopago/payment-logic
 */

import type { QZPayBilling, QZPayCurrency, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import { AnalyticsEvents } from '@repo/analytics';
import { asMajor, createMercadoPagoAdapter, type Major, toCentavos } from '@repo/billing';
import {
    and,
    billingAddonPurchases,
    billingNotificationLog,
    billingPayments,
    billingSubscriptions,
    eq,
    getDb,
    isNull,
    sql
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    calculatePromoCodeEffect,
    checkSubscriptionStatusTransition,
    getPromoCodeById,
    loadSubscriptionDiscountState,
    resolveFullPlanPriceCentavos,
    resolveOwnerPlanGrantsFeatured,
    syncFeaturedByEntitlementForOwner
} from '@repo/service-core';
import { captureServerAnalyticsEvent } from '../../../lib/posthog';
import { qzpayLogger } from '../../../lib/qzpay-logger';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { AddonService } from '../../../services/addon.service';
import { normalizeAddonCheckoutMetadata } from '../../../services/addon-checkout-metadata';
import { handlePlanChangeAddonRecalculation } from '../../../services/addon-plan-change.service';
import { recordOrphanPayment } from '../../../services/billing/orphan-payment-queue.service';
import { resolvePlanChangeReason } from '../../../services/billing/plan-change-reason';
import { applyUpgradeRestorationsOrWarn } from '../../../services/plan-upgrade-restoration.service';
import { applyRefundLifecycle } from '../../../services/refund-lifecycle.service';
import { clearPendingScheduledPlanChange } from '../../../services/subscription-downgrade.service';
import { resolveOwnerUserId } from '../../../services/subscription-pause.service';
import { apiLogger } from '../../../utils/logger';
import { sendPaymentFailureNotifications, sendPaymentSuccessNotification } from './notifications';
import { completeReactivationSupersession } from './subscription-logic';
import type { PaymentInfo } from './types';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPaymentInfo,
    extractPlanChangeUpgradeMetadata,
    type PlanChangeUpgradeMetadata
} from './utils';

/** Input for processing a payment.updated event */
interface ProcessPaymentUpdatedInput {
    /** Parsed event data object */
    readonly data: Record<string, unknown>;
    /** QZPay billing instance */
    readonly billing: QZPayBilling;
    /** Caller context label for log messages */
    readonly source?: string;
}

/** Result of processing a payment.updated event */
interface ProcessPaymentUpdatedResult {
    readonly success: boolean;
    readonly addonConfirmed: boolean;
    /** True when this event activated an annual subscription (SPEC-141 D1). */
    readonly annualSubscriptionConfirmed?: boolean;
    /** True when this event committed a plan-change upgrade (SPEC-141 D7). */
    readonly planUpgradeConfirmed?: boolean;
    /**
     * True when the addon purchase already existed (ADDON_ALREADY_ACTIVE).
     * The purchase is present in the DB so this is a semantic success — the
     * polling job must treat this as terminal 'succeeded' instead of
     * error-backoff spinning (SPEC-194 T-013).
     */
    readonly addonAlreadyActive?: boolean;
}

/**
 * Every status value that means "this charge cleared", across BOTH vocabularies
 * a `data.status` reaching this module can be spelled in.
 *
 * `processPaymentUpdated` is handed payment payloads by three producers, and
 * they do NOT agree on the spelling of `status`:
 *
 * - `payment-handler.ts` — the LIVE webhook, and the PRIMARY path. It forwards
 *   `providerPayment.status` from `paymentAdapter.payments.retrieve()`, and the
 *   MercadoPago adapter NORMALIZES that value through its own table before
 *   returning it (`approved → succeeded`, `rejected → failed`,
 *   `cancelled → canceled`, `in_process → processing`; `refunded` and
 *   `pending` happen to map to themselves). So on the live webhook path an
 *   approved charge arrives here spelled `'succeeded'`, and the raw string
 *   `'approved'` NEVER appears. The same mapping is written a second time,
 *   independently, in `subscription-payment-handler.ts::mapMpStatusToQZPayStatus`.
 * - `subscription-poll.job.ts` — the polling FALLBACK. It forwards
 *   `succeeded.status` off a `payments.search` hit, which is the same
 *   adapter-normalized field. Until HOS-757 it hand-translated back to
 *   MercadoPago's raw vocabulary, and it was the only producer that did.
 * - `webhook-retry.job.ts` — the dead-letter replay. It replays the stored raw
 *   IPN body, which carries no `status` at all.
 *
 * ## Why there is exactly one of these (HOS-756)
 *
 * The predicate this file used to gate on — `MP_APPROVED_STATUSES`, holding
 * `{'approved', 'accredited'}` — knew only the raw vocabulary. It therefore did
 * not mean "the charge cleared". It meant **"this event arrived by the polling
 * job"**, and on the live webhook it was FALSE for every approved payment ever
 * received. Three dispatches were gated on it and were dormant on the primary
 * path for their whole lifetime:
 *
 * 1. the annual activation (SPEC-141 D1),
 * 2. the plan-change upgrade commit (SPEC-141 D7) — and unlike the other two,
 *    this one had NO second dispatcher covering it: `confirmPlanUpgrade` has a
 *    single call site, and `subscription-poll.job.ts` deliberately keeps
 *    `planChangeUpgradeId` out of its synthetic payload, so a paid plan upgrade
 *    was never committed anywhere,
 * 3. HOS-595's `billing_payments` ledger entry for an add-on charge — an add-on
 *    payment confirmed by webhook left no ledger row at all, which is the very
 *    defect HOS-595 believed it had closed.
 *
 * HOS-742 hit the same wall from the other side and had to add a SECOND, wider
 * set scoped to its own branch so that fixing the add-on gate would not switch
 * the other three on by accident. Two predicates answering one question in one
 * file is the shape of the bug, not a fix for it, so this is now the only one.
 *
 * Corroboration that the split is real rather than theoretical:
 * `applyWebhookRefundLifecycle` gates on `'refunded'`, the ONE status whose two
 * spellings coincide, and it demonstrably fires in production (HOS-704 was a
 * live partial-refund incident). The only gate in this file that COULD work on
 * the webhook path is the only one known to have worked.
 *
 * ## Why the translation lives here and not at the entry border
 *
 * HOS-743 established the sibling convention one layer over: metadata keys are
 * snake_cased once, at the border, by `normalizeMercadoPagoMetadata`, and no
 * consumer downstream ever knows the wire spelling. This is deliberately NOT
 * that shape, because a status is not addressing — it is payload.
 * `data.status` flows on from here into `billing_payments.status`, the payment
 * notification copy, the PostHog `failure_category`, and every log line in this
 * module; rewriting it at the border would change what gets stored and what the
 * customer is emailed. So the vocabulary is reconciled at the point of the
 * QUESTION rather than at the point of the DATA, which is the same "translate
 * exactly once" guarantee with none of the blast radius.
 *
 * ## On `'accredited'`
 *
 * Removed, and it must not come back. `'accredited'` is not a payment status at
 * all: MercadoPago publishes it under `status_detail`, and `extractPaymentInfo`
 * reads `status_detail` into a separate `statusDetail` field. It could not have
 * reached a `status` comparison from any of the three producers — dead weight
 * in the set since the day it was written.
 *
 * ## Why the raw spelling is gone (HOS-757)
 *
 * This set held `'approved'` as well, because one producer really did emit it:
 * `subscription-poll.job.ts` hand-translated the adapter's `'succeeded'` back to
 * MercadoPago's raw word when building its synthetic payload. HOS-757 removed
 * that translation — the cron now forwards `succeeded.status` verbatim — which
 * leaves `'approved'` with no producer at all. All three were checked before
 * dropping it:
 *
 * 1. `payment-handler.ts` forwards `QZPayProviderPayment.status`, which the
 *    adapter has already rewritten. It never carried the raw spelling.
 * 2. `subscription-poll.job.ts` no longer translates (HOS-757).
 * 3. `webhook-retry.job.ts` replays `billing_webhook_events.payload.data`, and a
 *    MercadoPago payment notification carries only `{ id }` there — no status
 *    and no amount. That is precisely why `payment-handler.ts` has to call
 *    `payments.retrieve` before it can dispatch anything, so the replay cannot
 *    introduce a status of any spelling.
 *
 * Keeping a value nothing can send is how `'accredited'` survived for years
 * looking like a working gate, so it goes.
 */
const CLEARED_PAYMENT_STATUSES = ['succeeded'] as const;

/**
 * Whether a payment status reaching this module means the money actually moved.
 *
 * The single canonical answer to "did this charge clear?" for every dispatch
 * gate in this file, and producer-agnostic by construction — see
 * {@link CLEARED_PAYMENT_STATUSES} for why asking it any other way silently
 * answers "arrived by polling" instead.
 *
 * @param status - The payment status as `extractPaymentInfo` read it off the
 *   payload's `status` field, in either provider vocabulary.
 * @returns `true` only for `'succeeded'`; `false` for every other status,
 *   MercadoPago's raw `'approved'` included — no producer emits it any more.
 *
 * @example
 * ```ts
 * const settled = paymentInfo !== null && isClearedPaymentStatus(paymentInfo.status)
 *     ? paymentInfo
 *     : null;
 * ```
 */
export function isClearedPaymentStatus(status: string): boolean {
    // Derive from the const set so the two can never drift out of sync.
    return (CLEARED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses that mean the charge did NOT go through, in both vocabularies.
 *
 * The mirror image of {@link CLEARED_PAYMENT_STATUSES} and written in the same
 * shape on purpose, so the pair reads as one decision rather than two unrelated
 * lists. MercadoPago's raw spellings are `'rejected'` and `'cancelled'`; the
 * qzpay adapter normalizes them inside `payments.retrieve()` to `'failed'` and
 * `'canceled'` (one `l`). The live webhook therefore delivers the normalized
 * pair and the polling fallback delivers the raw pair, exactly as with the
 * cleared side — so a gate that knows only one of the two vocabularies is
 * false for a whole producer (HOS-763).
 *
 * ## Why `'refunded'` is NOT in here
 *
 * It is the one status whose two spellings coincide, so it never suffered the
 * blindness this set exists to cure, and it is the only member of this family
 * known to actually fire in production (HOS-704 was a live partial-refund
 * incident). The failure-notification gate below keeps it as its own explicit
 * disjunct: including it here would fold live, working behaviour into a
 * predicate whose whole point is to repair dead behaviour, and would also make
 * `isFailedPaymentStatus` lie about what a refund is — a refund is a reversal
 * of a charge that DID clear, not a charge that failed.
 *
 * ## Why the raw spellings are gone (HOS-757)
 *
 * `'rejected'` and `'cancelled'` are dropped for exactly the reason
 * {@link CLEARED_PAYMENT_STATUSES} drops `'approved'`: with the polling cron no
 * longer translating back, no producer can emit MercadoPago's raw vocabulary
 * into this module. HOS-763 included them because the cron still could when it
 * shipped; that stopped being true one commit later.
 *
 * The DISPOSITION is unchanged — a failed charge still notifies the customer,
 * and `'refunded'` still reaches that gate through its own explicit disjunct
 * below, exactly as HOS-763 left it.
 */
const FAILED_PAYMENT_STATUSES = ['failed', 'canceled'] as const;

/**
 * Whether a payment status reaching this module means the charge did not go
 * through.
 *
 * The canonical, producer-agnostic answer to "did this charge fail?", the
 * sibling of {@link isClearedPaymentStatus}. Deliberately silent about
 * `'refunded'` — see {@link FAILED_PAYMENT_STATUSES}.
 *
 * @param status - The payment status as `extractPaymentInfo` read it off the
 *   payload's `status` field, in either provider vocabulary.
 * @returns `true` for `'failed'` / `'canceled'` (qzpay-normalized); `false` for
 *   every other status, `'refunded'` included. MercadoPago's raw `'rejected'` /
 *   `'cancelled'` are no longer accepted — nothing emits them (HOS-757).
 */
export function isFailedPaymentStatus(status: string): boolean {
    // Derive from the const set so the two can never drift out of sync.
    return (FAILED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Activate an annual local subscription after the linked MP one-time
 * payment cleared (SPEC-141 D1).
 *
 * Idempotent: a subsequent webhook for the same payment finds the
 * subscription already in `active` status and returns without
 * re-recording anything. Errors are swallowed (logged) so a single
 * noisy event cannot block the webhook bucket — MP will retry.
 *
 * Exported so the SPEC-143 polling-fallback cron can call the same
 * activation path when it resolves a payment via search. Both call
 * sites rely on the function's idempotency: webhook and polling can
 * race for the same payment and only one wins, the other no-ops.
 */
export async function confirmAnnualSubscription(input: {
    readonly annualSubscriptionId: string;
    readonly providerPaymentId: string;
    /**
     * The charged amount in MAJOR units (ARS pesos), as MP reports it.
     *
     * HOS-720 — `Major` rather than `number` because this function converts it
     * back to centavos internally for `billing_payments.amount`. Both of its
     * callers start from a qzpay adapter response in CENTAVOS, and one of them
     * (the live webhook handler) shipped that value undivided in HOS-713.
     */
    readonly amount: Major;
    readonly currency: string;
    readonly billing: QZPayBilling;
    readonly source: string;
    /**
     * Checkout-session id this payment settles — the value stored as the
     * polling job's `providerResourceId` (and as MP's `external_reference`).
     *
     * HOS-710: required so the polling cleanup below closes the job for THIS
     * checkout rather than "whichever job this subscription happens to have".
     * A subscription can now hold several active jobs at once, one per
     * in-flight one-time checkout, so a subscription-scoped lookup could
     * retire an add-on purchase's job while its payment was still pending —
     * and MP Preferences have no Webhooks v2 channel, so that job is the only
     * activation path the purchase has.
     *
     * `null` only when the caller genuinely has no session id; the cleanup is
     * then skipped rather than guessing.
     */
    readonly checkoutSessionId: string | null;
}): Promise<{ confirmed: boolean }> {
    const {
        annualSubscriptionId,
        providerPaymentId,
        amount,
        currency,
        billing,
        source,
        checkoutSessionId
    } = input;

    const db = getDb();
    // Full-row select (not a column projection): HOS-123 T-013 needs
    // `sub.metadata` below to drive `completeReactivationSupersession`, and a
    // full row is exactly the shape `subscription-logic.ts::processSubscriptionUpdated`
    // already passes as `localSubscription` on the monthly path — reusing the
    // same select shape keeps both paths structurally aligned.
    const rows = await db
        .select()
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.id, annualSubscriptionId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);

    const sub = rows[0];
    if (!sub) {
        // HOS-714: the charge cleared and there is nothing to apply it to. Do
        // NOT drop it — queue it for manual resolution and raise an incident.
        // `recordOrphanPayment` owns the `error` + `capture: true` alert; it
        // never throws, so the webhook disposition below is unchanged.
        await recordOrphanPayment({
            providerPaymentId,
            flow: 'annual-upfront',
            reason: 'subscription-not-found',
            amountMajor: amount,
            currency,
            subscriptionId: annualSubscriptionId,
            source,
            metadata: { annualSubscriptionId, checkoutSessionId }
        });
        return { confirmed: false };
    }

    if (sub.status === SubscriptionStatusEnum.ACTIVE) {
        apiLogger.info(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: subscription already active — idempotent skip'
        );
        return { confirmed: false };
    }

    if (sub.status !== SubscriptionStatusEnum.PENDING_PROVIDER) {
        // HOS-714: money moved, the activation cannot run. Queue + alert
        // instead of the old `warn` + silent drop.
        await recordOrphanPayment({
            providerPaymentId,
            flow: 'annual-upfront',
            reason: 'subscription-status-not-applicable',
            amountMajor: amount,
            currency,
            subscriptionId: sub.id,
            customerId: sub.customerId,
            observedStatus: sub.status,
            source,
            metadata: {
                annualSubscriptionId,
                checkoutSessionId,
                expectedStatus: SubscriptionStatusEnum.PENDING_PROVIDER
            }
        });
        return { confirmed: false };
    }

    // Dedupe at the payment level too: if a row with this MP payment id
    // already exists, skip the record() to avoid double-inserts when MP
    // resends `payment.updated` for the same charge.
    const existingPayment = await db
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(sql`${billingPayments.providerPaymentIds}->>'mercadopago' = ${providerPaymentId}`)
        .limit(1);

    if (existingPayment.length === 0) {
        // HOS-720: `billing_payments.amount` is CENTAVOS, `amount` is MAJOR.
        // `toCentavos` is the only crossing; a hand-written `* 100` would yield a
        // plain `number` that no longer satisfies the branded parameter above.
        const amountInCentavos = toCentavos(amount);
        try {
            await billing.payments.record({
                id: crypto.randomUUID(),
                customerId: sub.customerId,
                amount: amountInCentavos,
                currency: currency as QZPayCurrency,
                status: 'succeeded' as QZPayPaymentStatus,
                provider: 'mercadopago',
                providerPaymentId,
                subscriptionId: sub.id,
                metadata: {
                    flow: 'annual-upfront',
                    annualSubscriptionId
                }
            });
        } catch (recordErr) {
            apiLogger.error(
                {
                    annualSubscriptionId,
                    providerPaymentId,
                    source,
                    error: recordErr instanceof Error ? recordErr.message : String(recordErr)
                },
                'Annual subscription confirmation: failed to record billing_payments row — continuing with status flip'
            );
        }
    } else {
        apiLogger.debug(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: payment already recorded — skipping record'
        );
    }

    // Guard: verify pending_provider → active is a permitted transition before
    // writing. Skip is safe here: the subscription already exists in the DB in
    // a non-pending_provider state, which means a concurrent process already
    // activated (or cancelled) it; either way, re-writing active would be
    // incorrect. The `sub.status !== PENDING_PROVIDER` early-exit above
    // (lines 121-132) already handles the expected idempotency case (active →
    // skip); this guard catches any *other* unexpected status that slipped
    // through (e.g. a race that wrote cancelled between our SELECT and here).
    const transitionCheck = checkSubscriptionStatusTransition({
        from: sub.status as `${(typeof SubscriptionStatusEnum)[keyof typeof SubscriptionStatusEnum]}`,
        to: SubscriptionStatusEnum.ACTIVE,
        subscriptionId: sub.id
    });
    if (!transitionCheck.valid) {
        apiLogger.error(
            {
                annualSubscriptionId,
                providerPaymentId,
                source,
                from: sub.status,
                to: SubscriptionStatusEnum.ACTIVE,
                subscriptionId: sub.id,
                reason: transitionCheck.reason
            },
            'Annual subscription confirmation: invalid status transition — skipping status write'
        );
        return { confirmed: false };
    }

    // Flip the local subscription status from pending_provider to active.
    // billing.subscriptions.update() does not accept 'pending_provider' as
    // an input status (qzpay enum is narrower than Hospeda's), so we
    // update the row directly via Drizzle — matches the pattern used
    // by subscription-logic.ts for the monthly preapproval lifecycle.
    await db
        .update(billingSubscriptions)
        .set({ status: SubscriptionStatusEnum.ACTIVE, updatedAt: new Date() })
        .where(eq(billingSubscriptions.id, sub.id));

    // Invalidate the entitlement middleware cache for this customer. Without
    // this, the entitlement middleware would keep serving the pre-activation
    // (empty) entitlement set for up to 5 minutes — the user pays for an
    // annual plan and sees their features blocked until the TTL expires.
    // Synchronous, in-process, no I/O — safe to call unconditionally.
    clearEntitlementCache(sub.customerId);

    // HOS-123 T-013: complete the deferred reactivation supersession for the
    // annual one-time-payment path — mirrors the identical trigger already
    // wired into the monthly preapproval webhook
    // (`subscription-logic.ts::processSubscriptionUpdated`, HOS-114 T-007).
    // `completeReactivationSupersession` reads `sub.metadata.supersedesSubscriptionId`
    // and no-ops immediately when absent — the case for every normal
    // (non-reactivation) annual /start-paid confirmation, exactly the same
    // no-op the monthly path already relies on for a normal monthly
    // /start-paid confirm. No new guard is needed here.
    //
    // `completeReactivationSupersession` itself never throws (see its JSDoc:
    // it delegates per-pairing to `completeSupersessionPairing`, which
    // swallows and reports its own outcome), so a supersession failure on
    // one pairing can never undo the activation already committed above.
    // The one extra failure mode specific to THIS call site — constructing
    // the MP adapter, which the monthly path already receives from its
    // caller and this one-time-payment path does not — is wrapped in its
    // own try/catch so a transient adapter-construction error is equally
    // non-blocking.
    try {
        const paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
        await completeReactivationSupersession({
            billing,
            paymentAdapter,
            db,
            localSubscription: sub,
            providerEventId: providerPaymentId,
            source
        });
    } catch (supersessionErr) {
        apiLogger.error(
            {
                annualSubscriptionId,
                providerPaymentId,
                source,
                error:
                    supersessionErr instanceof Error
                        ? supersessionErr.message
                        : String(supersessionErr)
            },
            'Annual subscription activation: reactivation supersession trigger failed — activation already committed, superseded subscription may need manual cancellation'
        );
    }

    // SPEC-309 T-010: sync featuredByEntitlement via the shared resolver
    // (T-004) — the subscription's status was flipped to ACTIVE just above,
    // so resolveOwnerPlanGrantsFeatured observes the post-commit state
    // directly. Soft-fail: a sync error must not block the activation path
    // (the status change already committed above).
    try {
        const ownerId = await resolveOwnerUserId({ customerId: sub.customerId });
        if (ownerId) {
            const annualPlanHasFeatured = await resolveOwnerPlanGrantsFeatured({ ownerId });
            if (annualPlanHasFeatured) {
                await syncFeaturedByEntitlementForOwner({ ownerId, active: true });
                apiLogger.info(
                    { annualSubscriptionId, customerId: sub.customerId },
                    'Annual subscription activation: featuredByEntitlement granted'
                );
            }
        }
    } catch (featuredSyncErr) {
        apiLogger.warn(
            {
                annualSubscriptionId,
                customerId: sub.customerId,
                source,
                error:
                    featuredSyncErr instanceof Error
                        ? featuredSyncErr.message
                        : String(featuredSyncErr)
            },
            'Annual subscription activation: syncFeaturedByEntitlementForOwner failed (non-blocking)'
        );
    }

    // SPEC-143 Finding #21 fallback cleanup. Mark the polling job for THIS
    // CHECKOUT as `succeeded` so the cron stops searching MP for a sub whose
    // status the webhook just resolved. Idempotent — even if this fails, the
    // next poll attempt would see the sub already `active` and would no-op via
    // the confirmAnnualSubscription idempotency guard. Skipped when
    // source='polling' because in that case the cron itself is updating the job.
    //
    // HOS-710: looked up by checkout-session id, NOT by subscription id, and
    // skipped entirely when the caller has no session id. One subscription can
    // now hold several active jobs at once — one per in-flight one-time
    // checkout — so a subscription-scoped lookup could close an add-on
    // purchase's job while its payment was still pending, leaving that
    // purchase with no activation path at all.
    if (source !== 'polling' && checkoutSessionId) {
        try {
            const pollingStorage = billing.getStorage().subscriptionPollingJobs;
            if (pollingStorage) {
                const activeJob = await pollingStorage.findActiveByProviderResourceId(
                    'mercadopago',
                    checkoutSessionId
                );
                if (activeJob) {
                    await pollingStorage.update({
                        id: activeJob.id,
                        expectedVersion: activeJob.version,
                        status: 'succeeded',
                        completedAt: new Date(),
                        lastError: 'webhook_arrived_first'
                    });
                    apiLogger.debug(
                        { jobId: activeJob.id, subscriptionId: sub.id, source },
                        'Marked annual polling job as succeeded after webhook transition'
                    );
                }
            }
        } catch (cleanupError) {
            apiLogger.warn(
                {
                    error:
                        cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                    subscriptionId: sub.id,
                    source
                },
                'Failed to mark annual polling job as succeeded after webhook — cron will complete it on next tick'
            );
        }
    }

    apiLogger.info(
        {
            annualSubscriptionId,
            providerPaymentId,
            customerId: sub.customerId,
            amount,
            currency,
            source
        },
        'Annual subscription activated by MP payment confirmation'
    );

    return { confirmed: true };
}

/**
 * SPEC-262 S3 — Compute the discount-aware MP amount for a plan-change upgrade.
 *
 * Mirrors the same helper in `apply-scheduled-plan-changes.ts`. When a subscription
 * with an active multi-cycle discount is upgraded, the remaining discounted cycles
 * must be PRESERVED and recalculated on the NEW plan's price.
 *
 * @internal
 */
async function resolveDiscountAwareUpgradeAmount(
    subscriptionId: string,
    newPlanId: string,
    nominalAmountMajor: number
): Promise<number> {
    const db = getDb();
    try {
        const discountState = await loadSubscriptionDiscountState({ subscriptionId });
        if (!discountState?.promoCodeId) return nominalAmountMajor;

        const remaining = discountState.promoEffectRemainingCycles;
        if (remaining !== null && remaining <= 0) return nominalAmountMajor;

        const fullPriceCentavos = await resolveFullPlanPriceCentavos(db, newPlanId);
        if (fullPriceCentavos === null) return nominalAmountMajor;

        const promoResult = await getPromoCodeById(discountState.promoCodeId);
        if (!promoResult.success || !promoResult.data?.effect) return nominalAmountMajor;

        const mutation = calculatePromoCodeEffect(promoResult.data.effect, fullPriceCentavos);
        if (mutation.type !== 'apply-discount') return nominalAmountMajor;

        return mutation.finalAmount / 100;
    } catch {
        return nominalAmountMajor; // Fail-open: use nominal amount on error.
    }
}

/**
 * Commit a plan-change upgrade after the user paid the prorated
 * delta upfront (SPEC-141 D7).
 *
 * Idempotent: a subsequent webhook for the same payment finds the
 * subscription already on `newPlanId` and returns without re-running
 * the change. Sub-step failures (MP propagation, addon recalc, payment
 * record) are logged but do not block the webhook bucket — MP will
 * retry the event, and the idempotency guards short-circuit the second
 * pass.
 *
 * Operations are ordered so the most-critical step happens first:
 *   1. `billing.subscriptions.changePlan(...)` — flips local planId.
 *   2. `paymentAdapter.subscriptions.update(...)` — propagates the
 *      new recurring amount to MP (best-effort; webhook reconciliation
 *      eventually fixes drift in either direction).
 *   3. `handlePlanChangeAddonRecalculation(...)` — refreshes addon
 *      limits for the new plan (best-effort).
 *   4. `billing.payments.record(...)` — records the delta in
 *      billing_payments (skipped if a row with this MP payment id
 *      already exists).
 */
async function confirmPlanUpgrade(input: {
    readonly metadata: PlanChangeUpgradeMetadata;
    readonly providerPaymentId: string;
    /**
     * The charged prorated delta in MAJOR units (ARS pesos), as MP reports it.
     * Converted to centavos internally for the `billing_payments` row — see the
     * note on {@link confirmAnnualSubscription}'s `amount` (HOS-720).
     */
    readonly amount: Major;
    readonly currency: string;
    readonly billing: QZPayBilling;
    readonly source: string;
}): Promise<{ confirmed: boolean }> {
    const { metadata, providerPaymentId, amount, currency, billing, source } = input;
    const { planChangeUpgradeId, oldPlanId, newPlanId, newPriceId, targetTransactionAmountMajor } =
        metadata;

    const db = getDb();

    const sub = await billing.subscriptions.get(planChangeUpgradeId);
    if (!sub) {
        // HOS-714: the customer paid the prorated delta and the subscription
        // it names does not exist. Queue + alert; never drop.
        await recordOrphanPayment({
            providerPaymentId,
            flow: 'plan-change-upgrade',
            reason: 'subscription-not-found',
            amountMajor: amount,
            currency,
            subscriptionId: planChangeUpgradeId,
            source,
            metadata: { planChangeUpgradeId, oldPlanId, newPlanId, newPriceId }
        });
        return { confirmed: false };
    }

    if (sub.planId === newPlanId) {
        apiLogger.info(
            { planChangeUpgradeId, providerPaymentId, newPlanId, source },
            'Plan upgrade confirmation: subscription already on target plan — idempotent skip'
        );
        return { confirmed: false };
    }

    // NOTE FOR THE NEXT STATUS-PREDICATE SWEEP (HOS-702 → HOS-714): do NOT
    // migrate this comparison to the canonical `isEntitlementGrantingStatus`
    // helper. Excluding `comp` here is CORRECT, not an oversight: twelve lines
    // below this guard we call `billing.subscriptions.changePlan()`, which
    // mutates a MercadoPago preapproval — and a `comp` subscription has no
    // preapproval at all (`mp_subscription_id = NULL` by design). Adding `comp`
    // would be the opposite bug, the same one already fixed in pause, cancel
    // and re-pricing. The verified reasoning is on HOS-714.
    if (sub.status !== 'active' && sub.status !== 'trialing') {
        // HOS-714: the prorated delta was already charged. The plan change
        // cannot be committed from this status, but the money is real —
        // queue it for manual resolution and raise an incident instead of
        // the old `warn` + silent drop.
        await recordOrphanPayment({
            providerPaymentId,
            flow: 'plan-change-upgrade',
            reason: 'subscription-status-not-applicable',
            amountMajor: amount,
            currency,
            subscriptionId: planChangeUpgradeId,
            customerId: sub.customerId,
            observedStatus: sub.status,
            source,
            metadata: {
                planChangeUpgradeId,
                oldPlanId,
                newPlanId,
                newPriceId,
                targetTransactionAmountMajor,
                acceptedStatuses: ['active', 'trialing']
            }
        });
        return { confirmed: false };
    }

    // Step 1: commit the local plan change via qzpay-core. If this step
    // throws, we surface the error and let MP retry — without the plan
    // flip nothing else makes sense.
    const changeResult = await billing.subscriptions.changePlan(planChangeUpgradeId, {
        newPlanId,
        newPriceId,
        prorationBehavior: 'create_prorations',
        applyAt: 'immediately'
    });

    // Invalidate the entitlement middleware cache for this customer.
    // Without this, the entitlement middleware would keep serving the
    // pre-upgrade (cheaper-plan) entitlement set for up to 5 minutes —
    // the user pays the prorated delta and sees the expensive-plan
    // features blocked until the TTL expires. Synchronous, in-process,
    // no I/O — safe to call unconditionally. Mirrors the same call in
    // confirmAnnualSubscription and processSubscriptionUpdated.
    clearEntitlementCache(changeResult.subscription.customerId);

    // Step 1b: restore plan-restricted resources for the host (SPEC-167 T-012).
    // Runs after the plan change commits — resources that were restricted when
    // the host downgraded are now eligible for restoration under the new plan's
    // higher caps. Uses the soft-fail wrapper: restoration failure must NOT
    // block the upgrade response (the plan change already committed in QZPay).
    // Errors are logged and reported to Sentry via the logger integration.
    // The entire block is wrapped in try/catch so a transient DB error in
    // resolveOwnerUserId (or any sub-call) cannot fail the webhook after the
    // plan change already committed — same OrWarn philosophy as the MP
    // propagation block below.
    try {
        const userId = await resolveOwnerUserId({
            customerId: changeResult.subscription.customerId
        });
        if (userId) {
            await applyUpgradeRestorationsOrWarn({
                userId,
                customerId: changeResult.subscription.customerId,
                newPlanId
            });
            // SPEC-309 T-010: sync featuredByEntitlement to reflect the
            // post-upgrade plan via the shared resolver (T-004), which
            // already excludes non-accommodation (commerce/partner)
            // subscriptions via SPEC-239 domain isolation — no separate
            // ALL_PLANS guard needed here.
            try {
                const upgradedPlanHasFeatured = await resolveOwnerPlanGrantsFeatured({
                    ownerId: userId
                });
                await syncFeaturedByEntitlementForOwner({
                    ownerId: userId,
                    active: upgradedPlanHasFeatured
                });
                apiLogger.info(
                    {
                        planChangeUpgradeId,
                        newPlanId,
                        active: upgradedPlanHasFeatured,
                        customerId: changeResult.subscription.customerId
                    },
                    'Plan upgrade: featuredByEntitlement synced'
                );
            } catch (featuredSyncErr) {
                apiLogger.warn(
                    {
                        planChangeUpgradeId,
                        newPlanId,
                        customerId: changeResult.subscription.customerId,
                        error:
                            featuredSyncErr instanceof Error
                                ? featuredSyncErr.message
                                : String(featuredSyncErr)
                    },
                    'Plan upgrade: syncFeaturedByEntitlementForOwner failed (non-blocking)'
                );
            }
        } else {
            apiLogger.warn(
                {
                    planChangeUpgradeId,
                    newPlanId,
                    customerId: changeResult.subscription.customerId,
                    source
                },
                'Plan upgrade: could not resolve owner userId for upgrade restoration — skipped'
            );
        }
    } catch (restorationErr) {
        apiLogger.warn(
            {
                planChangeUpgradeId,
                newPlanId,
                customerId: changeResult.subscription.customerId,
                source,
                error:
                    restorationErr instanceof Error
                        ? restorationErr.message
                        : String(restorationErr)
            },
            'Plan upgrade: upgrade restoration step threw unexpectedly — plan change committed, manual restoration may be needed'
        );
    }

    // Step 2: propagate to MP preapproval — best-effort.
    // SPEC-262 S3: if the sub has an active multi-cycle discount, pass the
    // discounted amount on the NEW plan's price (not the full nominal amount).
    // The counter and promo_code_id are preserved; the discount window continues.
    const mpSubscriptionId = sub.providerSubscriptionIds?.mercadopago;
    if (mpSubscriptionId) {
        const paymentAdapter = billing.getPaymentAdapter();
        if (paymentAdapter) {
            try {
                const effectiveTransactionAmountMajor = await resolveDiscountAwareUpgradeAmount(
                    planChangeUpgradeId,
                    newPlanId,
                    targetTransactionAmountMajor
                );
                // HOS-220: pass the plan display name as the MP preapproval
                // `reason` so the buyer sees e.g. "VIP" instead of the raw plan
                // UUID; `undefined` keeps the adapter's synthetic fallback.
                const reason = await resolvePlanChangeReason({ planId: newPlanId });
                await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                    planId: newPlanId,
                    transactionAmount: effectiveTransactionAmountMajor,
                    reason
                });
                if (effectiveTransactionAmountMajor !== targetTransactionAmountMajor) {
                    apiLogger.info(
                        {
                            planChangeUpgradeId,
                            newPlanId,
                            nominalAmountMajor: targetTransactionAmountMajor,
                            discountedAmountMajor: effectiveTransactionAmountMajor
                        },
                        'Plan upgrade confirmation: discount preserved on new plan price (S3)'
                    );
                }
            } catch (mpErr) {
                apiLogger.error(
                    {
                        planChangeUpgradeId,
                        providerPaymentId,
                        mpSubscriptionId,
                        oldPlanId,
                        newPlanId,
                        source,
                        error: mpErr instanceof Error ? mpErr.message : String(mpErr)
                    },
                    'Plan upgrade confirmation: failed to propagate to MP preapproval — local change persisted, will reconcile via webhook'
                );
            }
        }
    }

    // Step 3: refresh addon limits — best-effort.
    try {
        await handlePlanChangeAddonRecalculation({
            customerId: changeResult.subscription.customerId,
            oldPlanId,
            newPlanId,
            billing,
            db
        });
    } catch (recalcErr) {
        apiLogger.error(
            {
                planChangeUpgradeId,
                providerPaymentId,
                source,
                error: recalcErr instanceof Error ? recalcErr.message : String(recalcErr)
            },
            'Plan upgrade confirmation: addon recalculation failed — non-blocking'
        );
    }

    // Step 4: record the delta payment in billing_payments.
    const existingPayment = await db
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(sql`${billingPayments.providerPaymentIds}->>'mercadopago' = ${providerPaymentId}`)
        .limit(1);

    if (existingPayment.length === 0) {
        // HOS-720: `billing_payments.amount` is CENTAVOS, `amount` is MAJOR.
        // `toCentavos` is the only crossing; a hand-written `* 100` would yield a
        // plain `number` that no longer satisfies the branded parameter above.
        const amountInCentavos = toCentavos(amount);
        try {
            await billing.payments.record({
                id: crypto.randomUUID(),
                customerId: changeResult.subscription.customerId,
                amount: amountInCentavos,
                currency: currency as QZPayCurrency,
                status: 'succeeded' as QZPayPaymentStatus,
                provider: 'mercadopago',
                providerPaymentId,
                subscriptionId: planChangeUpgradeId,
                metadata: {
                    flow: 'plan-upgrade-delta',
                    oldPlanId,
                    newPlanId
                }
            });
        } catch (recordErr) {
            apiLogger.error(
                {
                    planChangeUpgradeId,
                    providerPaymentId,
                    source,
                    error: recordErr instanceof Error ? recordErr.message : String(recordErr)
                },
                'Plan upgrade confirmation: failed to record billing_payments row — non-blocking, plan change already persisted'
            );
        }
    } else {
        apiLogger.debug(
            { planChangeUpgradeId, providerPaymentId, source },
            'Plan upgrade confirmation: delta payment already recorded — skipping record'
        );
    }

    // Race-condition cleanup (SPEC-141 Fase 4 C4): if the user had a
    // downgrade queued before the upgrade landed, clear it — the upgrade
    // obsoletes the queued change. Best-effort: a clear failure does not
    // invalidate the upgrade that already applied.
    try {
        await clearPendingScheduledPlanChange(billing, planChangeUpgradeId);
    } catch (clearErr) {
        apiLogger.warn(
            {
                planChangeUpgradeId,
                providerPaymentId,
                source,
                error: clearErr instanceof Error ? clearErr.message : String(clearErr)
            },
            'Plan upgrade confirmation: failed to clear pending scheduled downgrade — non-blocking'
        );
    }

    apiLogger.info(
        {
            planChangeUpgradeId,
            providerPaymentId,
            oldPlanId,
            newPlanId,
            customerId: changeResult.subscription.customerId,
            amount,
            currency,
            source
        },
        'Plan upgrade committed by MP payment confirmation'
    );

    return { confirmed: true };
}

// ─── Webhook refund lifecycle helpers (SPEC-194 T-008) ───────────────────────

/**
 * Resolved local payment record fields needed by {@link applyRefundLifecycle}.
 */
interface LocalPaymentRecord {
    readonly id: string;
    readonly customerId: string;
    readonly subscriptionId: string | null;
    readonly amount: number;
    /**
     * The payment's persisted JSONB metadata. Read only for `refundId`, the
     * provider refund identifier qzpay writes when a refund settles — it is
     * what lets this path derive the SAME HOS-597 idempotency key the admin
     * hook derived for the same refund.
     */
    readonly metadata: unknown;
}

/**
 * Apply the refund lifecycle policy for a webhook-sourced MP payment refund.
 *
 * Flow:
 *  1. Resolve the local `billing_payments` row via a JSONB lookup on
 *     `providerPaymentIds->>'mercadopago'`. A single `getDb()` scope is used
 *     for both this select and the optional addon-purchase check so tests can
 *     drive each select's result via the standard per-`getDb()` counter.
 *     If no row found → log warn + skip (refund for unknown/unrecorded payment).
 *  2. If `payment.subscriptionId` is null AND the addon-purchase check finds a
 *     matching `billing_addon_purchases.paymentId` → log structured warn + skip.
 *     (Addon refund revocation is deferred to TODO(SPEC-194 T-012).)
 *     If no addon purchase found → fall through to `applyRefundLifecycle` (its
 *     own no-subscription guard will log and return gracefully).
 *  3. Call `applyRefundLifecycle`. When `data.transaction_amount_refunded` is
 *     present and numeric in the MP payload, it is converted from major units
 *     (ARS pesos, the unit MP uses) to centavos (integer, the unit Hospeda DB
 *     uses) via `Math.round(majorAmount * 100)` and passed as `refundAmount`.
 *     If absent, `refundAmount` is `undefined` → treated as full refund.
 *
 *     Unit conversion chain (SPEC-194 T-019):
 *       MP payload: `transaction_amount_refunded` in major units (e.g. 150.00 ARS)
 *       → `Math.round(150.00 * 100)` = 15000 centavos
 *       → passed as `refundAmount: 15000`
 *       → `billing_payments.refunded_amount` written as 15000 (centavos)
 *
 * The entire function is fail-safe: step failures are caught and logged so a
 * transient DB error does not propagate as a webhook 500 — MP would then retry
 * the event indefinitely.
 *
 * @param mpPaymentId  - The MP payment ID extracted from `data.id`.
 * @param data         - The full webhook payload (to read transaction_amount_refunded).
 * @param source       - Caller label for log messages (webhook | polling).
 */
async function applyWebhookRefundLifecycle({
    mpPaymentId,
    data,
    source
}: {
    readonly mpPaymentId: string;
    readonly data: Record<string, unknown>;
    readonly source: string;
}): Promise<void> {
    const db = getDb();

    // Step 1: resolve the local payment record (select index 0 in this db scope).
    let payment: LocalPaymentRecord | null;
    try {
        const rows = await db
            .select({
                id: billingPayments.id,
                customerId: billingPayments.customerId,
                subscriptionId: billingPayments.subscriptionId,
                amount: billingPayments.amount,
                metadata: billingPayments.metadata
            })
            .from(billingPayments)
            .where(sql`${billingPayments.providerPaymentIds}->>'mercadopago' = ${mpPaymentId}`)
            .limit(1);
        payment = rows[0] ?? null;
    } catch (err) {
        apiLogger.error(
            { mpPaymentId, source, err },
            'Webhook refund lifecycle: DB error resolving local payment — lifecycle skipped'
        );
        return;
    }

    if (!payment) {
        apiLogger.warn(
            { mpPaymentId, source },
            'Webhook refund lifecycle: local payment not found for MP payment id — lifecycle skipped'
        );
        return;
    }

    // Step 2: guard against cancelling a subscription because an addon payment
    // was refunded (select index 1 in this db scope, only when subscriptionId
    // is null).
    if (payment.subscriptionId === null) {
        let addonRefund = false;
        try {
            const addonRows = await db
                .select({ id: billingAddonPurchases.id })
                .from(billingAddonPurchases)
                .where(eq(billingAddonPurchases.paymentId, mpPaymentId))
                .limit(1);
            addonRefund = addonRows.length > 0;
        } catch (err) {
            apiLogger.error(
                { mpPaymentId, source, paymentId: payment.id, err },
                'Webhook refund lifecycle: DB error checking addon purchase — treating as non-addon, continuing'
            );
        }

        if (addonRefund) {
            // TODO(SPEC-194 T-012/T-019): implement addon revocation on refund.
            apiLogger.warn(
                { mpPaymentId, source, paymentId: payment.id, customerId: payment.customerId },
                'Webhook refund lifecycle: addon payment refunded — subscription cancellation skipped (T-019 follow-up)'
            );
            return;
        }
    }

    // Step 3: apply the refund lifecycle (subscription cancellation, cache clear).
    //
    // Parse transaction_amount_refunded from the MP payload (SPEC-194 T-019).
    // MP sends this field in major units (ARS pesos). Convert to centavos so
    // the service can compare with payment.amount (also centavos).
    // If absent or non-numeric → undefined → applyRefundLifecycle treats as full refund.
    const mpRefundedAmountMajor =
        typeof data.transaction_amount_refunded === 'number'
            ? asMajor(data.transaction_amount_refunded)
            : null;
    const refundAmountCentavos =
        mpRefundedAmountMajor === null ? undefined : toCentavos(mpRefundedAmountMajor);

    // HOS-597: resolve the provider refund id off the local payment's metadata
    // — the same field the admin hook read when it applied the refund — so a
    // webhook delivery for an admin-initiated refund derives an identical
    // idempotency key and skips instead of re-applying. Absent for a refund
    // issued straight in the MP dashboard; a full refund is keyed on the
    // payment's terminal state and needs no id, and a partial one falls back to
    // the unguarded path (see buildRefundIdempotencyKey).
    const paymentMetadata =
        payment.metadata !== null && typeof payment.metadata === 'object'
            ? (payment.metadata as Record<string, unknown>)
            : {};
    const providerRefundId =
        typeof paymentMetadata.refundId === 'string' ? paymentMetadata.refundId : undefined;

    try {
        await applyRefundLifecycle({
            payment: {
                id: payment.id,
                customerId: payment.customerId,
                subscriptionId: payment.subscriptionId,
                amount: payment.amount,
                // Fields required by QZPayPayment but not needed by applyRefundLifecycle's
                // logic — set to safe defaults so the type is satisfied without a DB join.
                invoiceId: null,
                currency: 'ARS',
                status: 'refunded',
                paymentMethodId: null,
                providerPaymentIds: { mercadopago: mpPaymentId },
                failureCode: null,
                failureMessage: null,
                metadata: {},
                livemode: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            refundAmount: refundAmountCentavos,
            adminUserId: 'webhook',
            source: 'webhook',
            providerRefundId
        });
    } catch (err) {
        apiLogger.error(
            { mpPaymentId, source, paymentId: payment.id, customerId: payment.customerId, err },
            'Webhook refund lifecycle: applyRefundLifecycle threw unexpectedly — lifecycle effects may be incomplete'
        );
    }
}

/**
 * Resolve the PostHog distinct id for a payment analytics event: the owner's
 * Better Auth user id (so the event lands on the SAME identified person the web
 * app creates via identify() and on checkout_started), falling back to the
 * billing customer id when the customer has no linked user or the lookup fails.
 *
 * Read-only and analytics-only — it never changes billing behavior and never
 * throws (a failed lookup returns the customerId). Called only inside the
 * capture branches so no lookup happens for payment statuses that never capture.
 *
 * @param customerId - The billing customer id from the payment metadata.
 * @returns The user id if resolvable, otherwise the customerId.
 */
async function resolveAnalyticsDistinctId(customerId: string): Promise<string> {
    try {
        return (await resolveOwnerUserId({ customerId })) ?? customerId;
    } catch {
        return customerId;
    }
}

/**
 * Resolve the billing customer id from a raw payment/webhook metadata bag,
 * accepting either the canonical camelCase spelling or the MercadoPago
 * snake_case wire spelling.
 *
 * ## Why this exists (HOS-744)
 *
 * This is the gate for payment status notification dispatch (success AND
 * failure, below): if it does not resolve, no notification is sent. It
 * used to read `metadata.customerId` only, which never resolves for a real
 * webhook, because MercadoPago snake-cases preference metadata keys when it
 * copies them onto the payment object it echoes back on `payment.updated` —
 * a preference written with `customerId` round-trips as `customer_id`. The
 * gate was permanently closed: no payment success or failure notification
 * was ever dispatched.
 *
 * ## Why this is a local helper, not `normalizeAddonCheckoutMetadata`
 *
 * HOS-721 established the convention this follows — camelCase is canonical,
 * snake_case is a wire format, translate once at the border instead of
 * having every reader defend both spellings — via `normalizeAddonCheckoutMetadata`
 * (`services/addon-checkout-metadata.ts`). That module's `AddonCheckoutMetadata`
 * payload deliberately EXCLUDES `customerId`: its own docs call it (together
 * with `addonSlug`) the add-on *dispatch discriminator*, resolved separately
 * by `extractAddonMetadata` before the add-on payload is ever read. This gate
 * is not add-on-specific — it fires for every payment, add-on or not — so
 * widening that module would blur a boundary it was written to keep. This is
 * its own, narrower border: one key, one call site.
 *
 * @param metadata - The raw metadata bag from the payment payload, before
 *   any spelling normalization.
 * @returns The customer id, or `null` when absent under either spelling.
 */
function resolvePaymentCustomerId(metadata: Record<string, unknown> | undefined): string | null {
    if (!metadata) {
        return null;
    }
    const camel = metadata.customerId;
    if (typeof camel === 'string' && camel.length > 0) {
        return camel;
    }
    const snake = metadata.customer_id;
    return typeof snake === 'string' && snake.length > 0 ? snake : null;
}

/**
 * The idempotency key identifying "the payment-success receipt for THIS
 * MercadoPago payment".
 *
 * Keyed on the PAYMENT, deliberately — not on the notification. See
 * {@link wasPaymentSuccessAlreadyDispatched} for why that distinction is the
 * whole point.
 *
 * @param providerPaymentId - MercadoPago `payment.id`.
 * @returns The key written into `billing_notification_log.metadata`.
 */
function paymentSuccessIdempotencyKey(providerPaymentId: string): string {
    return `payment-success:mercadopago:${providerPaymentId}`;
}

/**
 * Has the payment-success receipt for this MercadoPago payment already been
 * delivered?
 *
 * ## Why a payment-scoped check exists at all (HOS-757)
 *
 * HOS-763 turned the success notification on. One settled charge can reach that
 * dispatch more than once, from two independent producers, and NEITHER is
 * covered by the webhook-event idempotency upstream:
 *
 * - **Two provider notifications for the same payment.** The
 *   `billing_webhook_events` guard in `event-handler.ts` dedupes on
 *   `providerEventId`, and in `@qazuor/qzpay-mercadopago` `mapToQZPayEvent` sets
 *   `id: String(mpEvent.id)` — the id of the NOTIFICATION, not of the payment.
 *   Two `payment.updated` notifications about one charge therefore carry two
 *   distinct `providerEventId`s, both pass that guard, and both reach the
 *   dispatch. That guard stops a REDELIVERY of one notification; it cannot stop
 *   two notifications about one payment.
 * - **The polling cron.** `subscription-poll.job.ts` re-enters
 *   `processPaymentUpdated` with a synthetic payload for a charge the webhook
 *   may already have processed, and it writes no `billing_webhook_events` row at
 *   all, so the upstream guard never even looks at it.
 *
 * The add-on flow has a second, narrower defence (the
 * `billing_addon_purchases.paymentId` lookup further down), but a SUBSCRIPTION
 * charge — annual, plan upgrade, or a plain renewal — has none: it carries no
 * add-on metadata, so nothing downstream of the dispatch would have suppressed
 * a repeat. That path is the hole this closes, and it is live and unguarded
 * between HOS-763 landing and this change.
 *
 * ## Why `billing_notification_log`
 *
 * It is the repo's existing durable answer to "was this notification already
 * sent?", and the pattern is already load-bearing in `addon-expiry.job.ts`:
 * write an `idempotencyKey` into `metadata`, query it back before sending. It
 * survives a process restart and is shared across instances, unlike the
 * Redis-with-in-memory-fallback scheme in `notification-schedule.job.ts`, whose
 * fallback is per-process and would not hold for a multi-instance webhook.
 *
 * Note the division of labour, which `propagate-plan-price-changes.job.ts`
 * states explicitly for the same mechanism: passing `idempotencyKey` to the
 * sender only RECORDS the key — it does not prevent a second delivery. This
 * pre-send lookup is the gate.
 *
 * The query filters `status = 'sent'`, a deliberate deviation from
 * `addon-expiry.job.ts`, which matches any logged row. A row logged `failed`
 * means the customer did NOT receive the email, so treating it as "already sent"
 * would convert a delivery failure into a permanently missing payment receipt.
 * Excluding it still prevents every real duplicate, because only a delivered
 * notification can be duplicated.
 *
 * FAIL-OPEN on error, matching that precedent verbatim ("allowing send to avoid
 * missing notifications"): a lookup that cannot run must not silence a receipt
 * the customer is owed. The worst case in this direction is the duplicate it is
 * trying to prevent; the worst case in the other is a paying customer told
 * nothing.
 *
 * @param params.customerId - Billing customer id, which narrows the query onto
 *   the existing `(customer_id, type)` index.
 * @param params.providerPaymentId - MercadoPago `payment.id`.
 * @param params.source - Caller label, for the diagnostic log only.
 * @returns `true` only when a DELIVERED payment-success notification is already
 *   on record for this payment; `false` when none is, and `false` when the
 *   lookup itself failed.
 */
async function wasPaymentSuccessAlreadyDispatched(params: {
    readonly customerId: string;
    readonly providerPaymentId: string;
    readonly source: string;
}): Promise<boolean> {
    const { customerId, providerPaymentId, source } = params;
    const idempotencyKey = paymentSuccessIdempotencyKey(providerPaymentId);

    try {
        const [existing] = await getDb()
            .select({ id: billingNotificationLog.id })
            .from(billingNotificationLog)
            .where(
                and(
                    eq(billingNotificationLog.type, NotificationType.PAYMENT_SUCCESS),
                    eq(billingNotificationLog.customerId, customerId),
                    eq(billingNotificationLog.status, 'sent'),
                    eq(sql`${billingNotificationLog.metadata}->>'idempotencyKey'`, idempotencyKey)
                )
            )
            .limit(1);

        if (existing) {
            apiLogger.info(
                { customerId, providerPaymentId, source },
                'Payment-success notification already delivered for this payment — skipping (idempotent)'
            );
            return true;
        }
        return false;
    } catch (lookupError) {
        apiLogger.warn(
            {
                customerId,
                providerPaymentId,
                source,
                error: lookupError instanceof Error ? lookupError.message : String(lookupError)
            },
            'Payment-success idempotency check failed — proceeding as not-yet-sent'
        );
        return false;
    }
}

/**
 * Process a payment.updated event's business logic.
 *
 * Dispatches payment success/failure notifications and confirms add-on
 * purchases when applicable. This function is context-free and can be
 * called from both the live webhook handler and the dead letter retry job.
 *
 * @param input - Payment event data and billing instance
 * @returns Result indicating success and whether an addon was confirmed
 */
export async function processPaymentUpdated({
    data,
    billing,
    source = 'webhook'
}: ProcessPaymentUpdatedInput): Promise<ProcessPaymentUpdatedResult> {
    const paymentInfo = extractPaymentInfo(data);
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const customerId = resolvePaymentCustomerId(metadata);

    const providerPaymentId =
        typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

    /**
     * The payment, but ONLY when it actually cleared — `null` otherwise.
     *
     * HOS-757: the single call site of {@link isClearedPaymentStatus}. Every
     * branch below that spends, books or reports money reads its amount and
     * currency from HERE and nowhere else, so a new branch cannot collect
     * without having come through the gate. HOS-756 could only offer "every gate
     * calls the predicate"; this offers "an ungated amount is not reachable",
     * which is the property `cleared-payment-predicate.guard.test.ts` asserts.
     */
    const settled: PaymentInfo | null =
        paymentInfo !== null && isClearedPaymentStatus(paymentInfo.status) ? paymentInfo : null;

    /**
     * The key identifying this payment's receipt, read back by the dedupe below
     * and written into `billing_notification_log.metadata` by the send.
     *
     * `undefined` when the payload carries no id: there is then nothing to key
     * on, so the send proceeds ungated rather than being suppressed on a guess.
     */
    const successIdempotencyKey =
        providerPaymentId === null ? undefined : paymentSuccessIdempotencyKey(providerPaymentId);

    // HOS-757: has the payment-success receipt for THIS PAYMENT already gone
    // out? Resolved once, before the dispatch, because two independent producers
    // can reach that branch for one charge — see
    // `wasPaymentSuccessAlreadyDispatched`.
    const successAlreadyDispatched =
        settled !== null && customerId !== null && providerPaymentId !== null
            ? await wasPaymentSuccessAlreadyDispatched({ customerId, providerPaymentId, source })
            : false;

    // Dispatch payment status notifications
    if (paymentInfo && customerId) {
        // HOS-757: named `attempted*`, not `amount`/`currency`. These describe a
        // charge that MAY NOT have cleared — `paymentInfo` is ungated by
        // construction — and only the FAILURE branch may read them. A bare
        // `amount` in the same scope as `settled` is an ungated figure that looks
        // exactly like a gated one, so a new line inside a money branch would
        // compile and be wrong; the static guard asserts this naming for that
        // reason.
        const {
            amount: attemptedAmount,
            currency: attemptedCurrency,
            status,
            statusDetail
        } = paymentInfo;

        // HOS-763 — this gate and its failure sibling below were BOTH mute for
        // their entire lifetime, and turning them on is this change.
        //
        // HOS-756 left them deliberately unrepaired while it fixed the three
        // dispatch gates further down: an approved charge arrives from the live
        // webhook spelled `'succeeded'`, so `status === 'approved'` was false
        // for every payment the webhook ever confirmed, and
        // `sendPaymentSuccessNotification` has exactly one call site — this one.
        // Its sibling was blind the same way (`rejected → failed`,
        // `cancelled → canceled`). Neither email was ever sent, to anyone.
        //
        // The scope note HOS-756 left here said the repair "starts sending
        // customer-facing emails for every payment the webhook confirms, which
        // is a different blast radius and needs its own issue and its own
        // smoke". That issue is HOS-763; the owner decided to switch them on,
        // both templates were render-verified against the BUILT
        // `@repo/notifications` artifact (the resolution production uses) first,
        // and the change carries a staging smoke.
        // HOS-757 collapses HOS-763's `isClearedPaymentStatus(status)` into
        // `settled`, with the predicate author's agreement: same disposition,
        // same semantics, one call site instead of several. The failure gate
        // below keeps its own predicate — the two dispositions stay separately
        // covered, and `'refunded'` keeps its explicit disjunct untouched.
        //
        // The `!successAlreadyDispatched` conjunct is the new part. HOS-763 turned
        // this email on and does not carry a duplicate guard; the moment the gate
        // opens, one settled charge can dispatch twice — see
        // `wasPaymentSuccessAlreadyDispatched` for the two producers that make
        // that happen. Without this the repair ships the HOS-676 duplicate along
        // with it.
        if (settled !== null && !successAlreadyDispatched) {
            apiLogger.debug(
                {
                    customerId,
                    amount: settled.amount,
                    currency: settled.currency,
                    status: settled.status,
                    source
                },
                'Payment succeeded - sending success notification'
            );

            await sendPaymentSuccessNotification(
                customerId,
                settled.amount,
                settled.currency,
                settled.paymentMethod,
                billing,
                successIdempotencyKey
            );

            // Fire-and-forget product analytics (no DB, no await). Wrapped in
            // try/catch so a misbehaving PostHog client can NEVER break webhook
            // processing — this handler must always resolve normally regardless
            // of analytics outcome. `kind` distinguishes which downstream flow
            // this approved charge will dispatch to below (annual activation,
            // plan-change upgrade, addon purchase, or a plain recurring renewal);
            // computed from metadata already parsed further down in this
            // function — no additional DB queries.
            try {
                const analyticsDistinctId = await resolveAnalyticsDistinctId(customerId);
                const kind = extractAnnualSubscriptionMetadata(data.metadata)
                    ? 'annual'
                    : extractPlanChangeUpgradeMetadata(data.metadata)
                      ? 'plan_upgrade'
                      : extractAddonMetadata(data.metadata)
                        ? 'addon'
                        : 'subscription_renewal';

                captureServerAnalyticsEvent({
                    distinctId: analyticsDistinctId,
                    name: AnalyticsEvents.subscriptionPaymentSucceeded,
                    properties: {
                        amount: settled.amount,
                        currency: settled.currency,
                        payment_provider: 'mercadopago',
                        payment_method: settled.paymentMethod,
                        payment_kind: kind,
                        source,
                        $set: { plan_status: 'active' }
                    }
                });
            } catch (phErr) {
                apiLogger.warn(
                    {
                        customerId,
                        source,
                        error: phErr instanceof Error ? phErr.message : String(phErr)
                    },
                    'PostHog capture failed for subscription_payment_succeeded (non-blocking)'
                );
            }
        }

        // HOS-763 — `'refunded'` stays an explicit disjunct rather than a member
        // of `FAILED_PAYMENT_STATUSES`. Its two spellings coincide, so it was
        // never blind, and it is the only branch of this family known to fire in
        // production (HOS-704). The predicate repairs the two dead spellings
        // WITHOUT touching the one live behaviour standing next to them.
        if (isFailedPaymentStatus(status) || status === 'refunded') {
            const failureReason = statusDetail || status;

            apiLogger.debug(
                {
                    customerId,
                    amount: attemptedAmount,
                    currency: attemptedCurrency,
                    status,
                    statusDetail,
                    source
                },
                'Payment failed - sending failure notifications'
            );

            // HOS-757: the attempted figures, not `settled.*` — this is the one
            // branch that legitimately reports a charge that did NOT clear, so
            // it is the reason the ungated bindings exist at all.
            //
            // It needs no duplicate guard of its own: `successAlreadyDispatched`
            // is computed only for a SETTLED payment, and a settled payment never
            // reaches here. Both duplicate sources this module defends against —
            // a second provider notification for one charge, and the polling cron
            // re-entering — carry a cleared status, so neither can produce a
            // second failure dispatch.
            await sendPaymentFailureNotifications(
                customerId,
                attemptedAmount,
                attemptedCurrency,
                failureReason,
                billing
            );

            // Fire-and-forget product analytics (no DB, no await). Mirrors the
            // approved-branch capture above and is wrapped in try/catch so a
            // misbehaving PostHog client can NEVER break webhook processing.
            try {
                const analyticsDistinctId = await resolveAnalyticsDistinctId(customerId);
                captureServerAnalyticsEvent({
                    distinctId: analyticsDistinctId,
                    name: AnalyticsEvents.subscriptionPaymentFailed,
                    properties: {
                        amount: attemptedAmount,
                        currency: attemptedCurrency,
                        payment_provider: 'mercadopago',
                        failure_reason: failureReason,
                        failure_category: status,
                        source
                    }
                });
            } catch (phErr) {
                apiLogger.warn(
                    {
                        customerId,
                        source,
                        error: phErr instanceof Error ? phErr.message : String(phErr)
                    },
                    'PostHog capture failed for payment_failed (non-blocking)'
                );
            }
        }
    }

    // SPEC-194 T-008: webhook refund lifecycle.
    //
    // When MP reports a refunded payment, apply the Hospeda-side subscription
    // cancellation policy. This block fires after the failure notification so
    // the customer is always notified regardless of lifecycle outcome.
    //
    // Guard: only fires for `refunded` status (not `rejected` / `cancelled`).
    // Control then falls through to the annual/plan-upgrade/addon dispatch —
    // refunded events are mutually exclusive with those activation paths in
    // practice, but `applyWebhookRefundLifecycle` is self-contained and safe
    // to run even if other metadata is present (the activation guards below
    // short-circuit on non-approved statuses anyway).
    if (paymentInfo?.status === 'refunded' && providerPaymentId) {
        await applyWebhookRefundLifecycle({ mpPaymentId: providerPaymentId, data, source });
    }

    // SPEC-141 D1: annual subscription confirmation. The metadata
    // carries `annualSubscriptionId` set by initiatePaidAnnualSubscription;
    // we look it up here BEFORE the addon dispatch since both flows go
    // through the same payment.updated event but are mutually exclusive
    // (annual checkout never carries addonSlug metadata and vice versa).
    const annualSubscriptionId = extractAnnualSubscriptionMetadata(data.metadata);

    // HOS-756: this gate used to ask `MP_APPROVED_STATUSES`, which knew only
    // MercadoPago's raw spellings and was therefore false for every live
    // webhook. The annual activation ran exclusively because
    // `subscription-poll.job.ts` calls `confirmAnnualSubscription` DIRECTLY,
    // bypassing this dispatch entirely — so the fallback silently carried the
    // primary path's job. `confirmAnnualSubscription` is idempotent by design
    // for exactly this reason (see its JSDoc: webhook and polling race, one
    // wins, the other no-ops), so restoring the webhook path re-enables the
    // race the function was always written to survive.
    if (annualSubscriptionId && settled !== null) {
        if (providerPaymentId) {
            try {
                const result = await confirmAnnualSubscription({
                    annualSubscriptionId,
                    providerPaymentId,
                    amount: settled.amount,
                    currency: settled.currency,
                    billing,
                    source,
                    // MP echoes back the checkout-session id qzpay set as the
                    // preference's external_reference, which is the same value
                    // the polling job stored as its providerResourceId.
                    checkoutSessionId:
                        typeof data.external_reference === 'string' ? data.external_reference : null
                });
                return {
                    success: true,
                    addonConfirmed: false,
                    annualSubscriptionConfirmed: result.confirmed
                };
            } catch (annualErr) {
                apiLogger.error(
                    {
                        annualSubscriptionId,
                        source,
                        error: annualErr instanceof Error ? annualErr.message : String(annualErr)
                    },
                    'Annual subscription confirmation: unexpected error — event acknowledged'
                );
                return { success: false, addonConfirmed: false };
            }
        }
    }

    // SPEC-141 D7: plan-change upgrade confirmation. Runs after the
    // annual dispatch so an event carrying both metadata keys (would be
    // a bug) still picks annual first; in practice the two metadata
    // shapes are mutually exclusive.
    const upgradeMetadata = extractPlanChangeUpgradeMetadata(data.metadata);
    // HOS-756: the gravest of the three. `confirmPlanUpgrade` has exactly ONE
    // call site — this one — and `subscription-poll.job.ts` deliberately keeps
    // `planChangeUpgradeId` out of its synthetic payload, so unlike the annual
    // dispatch above there was no fallback quietly covering for it. With the
    // raw-vocabulary predicate this branch could not be reached from any
    // producer: a customer paid the prorated delta and the plan was never
    // changed. Idempotency is unaffected by re-enabling it — `confirmPlanUpgrade`
    // short-circuits on `sub.planId === newPlanId` and dedupes its
    // `billing_payments` row on the provider payment id.
    if (upgradeMetadata && settled !== null) {
        if (providerPaymentId) {
            try {
                const result = await confirmPlanUpgrade({
                    metadata: upgradeMetadata,
                    providerPaymentId,
                    amount: settled.amount,
                    currency: settled.currency,
                    billing,
                    source
                });
                return {
                    success: true,
                    addonConfirmed: false,
                    planUpgradeConfirmed: result.confirmed
                };
            } catch (upgradeErr) {
                apiLogger.error(
                    {
                        planChangeUpgradeId: upgradeMetadata.planChangeUpgradeId,
                        source,
                        error: upgradeErr instanceof Error ? upgradeErr.message : String(upgradeErr)
                    },
                    'Plan upgrade confirmation: unexpected error — event acknowledged'
                );
                return { success: false, addonConfirmed: false };
            }
        }
    }

    // Resolve add-on information from metadata or external_reference
    const addonInfo = extractAddonMetadata(data.metadata);

    if (!addonInfo) {
        // ── Legacy warn: pre-qzpay-migration payments carry addon_SLUG_TIMESTAMP ──
        const legacyAddonSlug = extractAddonFromReference(data.external_reference);

        if (legacyAddonSlug) {
            apiLogger.warn(
                {
                    addonSlug: legacyAddonSlug,
                    externalReference: data.external_reference,
                    hasMetadata: !!data.metadata,
                    metadataKeys: data.metadata ? Object.keys(data.metadata as object) : [],
                    paymentId: data.id,
                    paymentStatus: data.status,
                    source
                },
                'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly'
            );
        } else {
            // ── qzpay-era second-chance diagnostic ────────────────────────────────
            // After SPEC-127 migration, new addon MP payments have a bare qzpay
            // session UUID as external_reference (set by qzpay-core internally).
            // If metadata is absent or malformed this payment cannot be correlated
            // to an addon — emit a diagnostic so operators can match the qzpay
            // checkout session via externalReference.
            const extRef = data.external_reference;
            const isBareuuid =
                typeof extRef === 'string' &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(extRef);

            if (isBareuuid) {
                apiLogger.warn(
                    {
                        externalReference: extRef,
                        paymentId: data.id,
                        paymentStatus: data.status,
                        metadataKeys: data.metadata ? Object.keys(data.metadata as object) : [],
                        source
                    },
                    'Payment has bare UUID external_reference (qzpay session id) but no addon metadata - possible qzpay-era addon payment missing metadata; correlate via qzpay checkout session'
                );
            }
        }

        return { success: true, addonConfirmed: false };
    }

    // `extractAddonMetadata` is the dispatch discriminator: its job is to decide
    // that this payment IS an add-on purchase and to name which one. The payload
    // that travels with the purchase (accommodation, promo code, discount) is
    // read separately, from the raw metadata, by `normalizeAddonCheckoutMetadata`
    // below — one reader, one spelling convention (HOS-721).
    const { addonSlug, customerId: addonCustomerId } = addonInfo;

    // HOS-757: resolved once at the top of the function, alongside the dispatch
    // that needs the same value.
    const paymentId = providerPaymentId;

    // ── HOS-742: confirm the purchase only when the charge actually cleared ──
    //
    // The two sibling dispatches above (annual, SPEC-141 D1; plan-change, D7)
    // both refuse to commit anything unless the payment is approved. This one
    // never did: `extractAddonMetadata` decided the event was an add-on
    // purchase and control walked straight into `confirmPurchase`, whatever
    // MercadoPago said about the money. A `rejected` or `cancelled` payment
    // carrying add-on metadata therefore activated the add-on and granted its
    // entitlements with nothing collected.
    //
    // HOS-595 closed the LEDGER half of this hole — the `amountInCents` forward
    // below is conditional on the payment having cleared, so a rejected charge
    // is never booked in `billing_payments`. But withholding the amount only
    // keeps the books honest; it does not stop the purchase from being
    // confirmed. This is the confirmation half.
    //
    // The predicate is {@link isClearedPaymentStatus}, the single canonical
    // answer to "did this charge clear?" in this file. The two producers spell
    // an approved charge differently, and a gate that only knew the raw spelling
    // would refuse every webhook — turning a fix for unpaid confirmations into an
    // outage of paid ones. HOS-742 had to introduce a second, wider set to say
    // this; HOS-756 collapsed both into the predicate; HOS-757 removed the
    // disagreement at its source and collapsed the predicate to the single
    // `settled` binding this branch and the ledger forward below both read.
    //
    // On `paymentInfo === null`: both real producers always populate the two
    // fields `extractPaymentInfo` requires — the live webhook handler maps a
    // fetched `payments.retrieve` response (`status` + `transaction_amount`),
    // and `subscription-poll` builds its synthetic payload from a
    // `payments.search` hit. The dead-letter retry replays the stored payload,
    // which carries neither — but it carries no `metadata` either, so it exits
    // at the `!addonInfo` branch above and never reaches here.
    if (settled === null) {
        apiLogger.warn(
            {
                addonSlug,
                customerId: addonCustomerId,
                paymentId,
                paymentStatus: paymentInfo?.status ?? null,
                source
            },
            'Add-on payment has not cleared — skipping purchase confirmation'
        );

        return { success: true, addonConfirmed: false };
    }

    // ── Idempotency check: skip if this paymentId was already processed ───────
    if (paymentId) {
        try {
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            const db = getDb();

            const [existing] = await db
                .select({ id: billingAddonPurchases.id })
                .from(billingAddonPurchases)
                .where(eq(billingAddonPurchases.paymentId, paymentId))
                .limit(1);

            if (existing) {
                apiLogger.info(
                    { addonSlug, customerId: addonCustomerId, paymentId, source },
                    'Add-on purchase already processed for this paymentId — skipping (idempotent)'
                );
                return { success: true, addonConfirmed: false };
            }
        } catch (idempotencyCheckError) {
            apiLogger.warn(
                {
                    addonSlug,
                    customerId: addonCustomerId,
                    paymentId,
                    source,
                    error:
                        idempotencyCheckError instanceof Error
                            ? idempotencyCheckError.message
                            : String(idempotencyCheckError)
                },
                'Idempotency check failed — proceeding with addon confirmation'
            );
        }
    }

    apiLogger.info(
        { addonSlug, customerId: addonCustomerId, source },
        'Processing add-on purchase'
    );

    const addonService = new AddonService(billing);
    // HOS-675: forward the target accommodation captured at checkout. This call
    // omitted `metadata` entirely, so `confirmAddonPurchase` always read
    // `input.metadata?.accommodationId` as undefined and took its "should not
    // happen" branch on EVERY visibility-boost purchase — the
    // `featured_listing_addon_grants` table stayed empty in production.
    //
    // HOS-595: forward the provider payment id and the amount actually charged.
    // Neither was passed before, with two consequences: `confirmAddonPurchase`
    // wrote `payment_id: null` on every purchase row (which also made the
    // idempotency SELECT above dead code, since it matches on that column), and
    // it had nothing to book in `billing_payments` — so an add-on charge left no
    // ledger entry at all, unlike every subscription flow in this same file.
    //
    // HOS-721: the same call now forwards the promo/discount keys too. HOS-675
    // deliberately left them out because the checkout writes them under the
    // snake_case names MercadoPago requires while `confirmAddonPurchase` looks
    // up camelCase ones — forwarding the raw bag would have changed nothing.
    // `normalizeAddonCheckoutMetadata` is that translation, done exactly once,
    // here at the border: everything downstream reads canonical camelCase only.
    // It supersedes the accommodation-only forward, which is now one key of the
    // canonical payload rather than the only one that survives.
    const addonMetadata = normalizeAddonCheckoutMetadata({ metadata: data.metadata });
    const result = await addonService.confirmPurchase({
        customerId: addonCustomerId,
        addonSlug,
        ...(paymentId === null ? {} : { paymentId }),
        // The charged amount is forwarded ONLY for an approved payment, which is
        // what makes the ledger row conditional on the money having actually
        // moved: `confirmAddonPurchase` books a `succeeded` row when — and only
        // when — it receives an amount.
        //
        // HOS-756: this used to be NARROWER than the branch gate above — it asked
        // `MP_APPROVED_STATUSES`, which knew only MercadoPago's RAW spellings, so
        // on the live webhook path (where an approved charge arrives normalized
        // as `'succeeded'`) the amount was withheld and no `billing_payments` row
        // was ever written. An add-on payment reaches this function by webhook in
        // the overwhelming majority of cases, so HOS-595 — "an add-on charge
        // leaves no ledger row" — was fixed in code and dormant in production.
        //
        // HOS-757: UNCONDITIONAL. HOS-756 kept a second, redundant clearance
        // check here so the forward would state its own precondition rather than
        // inherit it silently from a guard forty lines up. With `settled` that
        // precondition is carried by the TYPE instead of by a repeated
        // comparison: the `settled === null` gate above returns, so `settled` is
        // non-null from here on and the compiler knows it. Restating the check
        // would now be provably dead code — and a repeated question is a question
        // that can be answered two different ways, which is the whole defect
        // class HOS-742/756/757 walked through.
        //
        // `settled.amount` is typed `Major` (extractPaymentInfo reads MP's
        // `transaction_amount`); billing_payments stores integer centavos, the
        // same crossing the sibling `billing.payments.record()` calls above
        // perform — and since HOS-720 the same named function performs it
        // everywhere. A duplicate delivery cannot double-book the ledger:
        // `recordAddonPayment` dedupes on `providerPaymentIds->>'mercadopago'`
        // before inserting.
        amountInCents: toCentavos(settled.amount),
        currency: settled.currency,
        ...(Object.keys(addonMetadata).length === 0 ? {} : { metadata: addonMetadata })
    });

    if (!result.success) {
        // SPEC-194 T-013: ADDON_ALREADY_ACTIVE is a semantic success — the purchase
        // already exists in the DB. Signal this explicitly so the polling job can
        // mark the job terminal instead of error-backoff spinning. The async
        // grant-reconciliation cron (Phase 7) handles any missing entitlement grants.
        const errorCode =
            result.error !== null && typeof result.error === 'object' && 'code' in result.error
                ? (result.error as { code: string }).code
                : null;

        if (errorCode === 'ADDON_ALREADY_ACTIVE') {
            apiLogger.info(
                { addonSlug, customerId: addonCustomerId, source },
                'Add-on purchase already active — idempotent success (SPEC-194 T-013)'
            );
            return { success: true, addonConfirmed: false, addonAlreadyActive: true };
        }

        apiLogger.error(
            { addonSlug, customerId: addonCustomerId, error: result.error, source },
            'Failed to confirm add-on purchase'
        );
        return { success: false, addonConfirmed: false };
    }

    // HOS-676: the ADDON_PURCHASE notification is NOT sent from here. It is
    // already sent, exactly once, inside `confirmAddonPurchase()`
    // (`apps/api/src/services/addon.checkout.ts`) right after the purchase row
    // commits — the call above (`addonService.confirmPurchase`) reaches that
    // same function. Sending it a second time from this caller, with a second
    // independently-fetched `customer`/`addon` lookup, was a pure duplicate:
    // one successful confirmation produced two ADDON_PURCHASE emails, every
    // time, with no failure or retry involved (verified against production's
    // `billing_notification_log`: a single addon purchase logged exactly two
    // `addon_purchase` rows a few hundred ms apart, alongside a single
    // `payment_success` row — one trigger, doubled only on this one
    // notification type; `billing_webhook_events` and `billing_addon_purchases`
    // both confirm there was only ever one confirmation, not two invocations
    // racing). Do not re-add a send here; if the confirmation needs to notify
    // with the actual charged amount (this call had `data.transaction_amount`,
    // `confirmAddonPurchase` uses the catalog's list price), that belongs
    // inside `confirmAddonPurchase` itself, not as a second independent send
    // from the caller.
    apiLogger.info(
        { addonSlug, customerId: addonCustomerId, source },
        'Add-on purchase confirmed successfully'
    );

    return { success: true, addonConfirmed: true };
}
