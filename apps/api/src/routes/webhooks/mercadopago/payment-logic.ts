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
import {
    and,
    billingAddonPurchases,
    billingPayments,
    billingSubscriptions,
    eq,
    getDb,
    isNull,
    sql
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { AddonCatalogService } from '@repo/service-core';
import { checkSubscriptionStatusTransition } from '@repo/service-core';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { handlePlanChangeAddonRecalculation } from '../../../services/addon-plan-change.service';
import { AddonService } from '../../../services/addon.service';
import { applyRefundLifecycle } from '../../../services/refund-lifecycle.service';
import { clearPendingScheduledPlanChange } from '../../../services/subscription-downgrade.service';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { sendPaymentFailureNotifications, sendPaymentSuccessNotification } from './notifications';
import {
    type PlanChangeUpgradeMetadata,
    extractAddonFromReference,
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPaymentInfo,
    extractPlanChangeUpgradeMetadata
} from './utils';

// ─── Catalog service (DB-backed addon reads — SPEC-192 T-016) ─────────────────
// Replaces static `getAddonBySlug` from `@repo/billing` for the addon
// purchase notification path. Instantiated once at module level.
const catalogService = new AddonCatalogService();

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
 * MP payment statuses that indicate the charge cleared successfully and
 * the linked annual subscription should be activated.
 */
const MP_APPROVED_STATUSES = new Set(['approved', 'accredited']);

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
    readonly amount: number;
    readonly currency: string;
    readonly billing: QZPayBilling;
    readonly source: string;
}): Promise<{ confirmed: boolean }> {
    const { annualSubscriptionId, providerPaymentId, amount, currency, billing, source } = input;

    const db = getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status
        })
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
        apiLogger.warn(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: local subscription not found — payment ignored'
        );
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
        apiLogger.warn(
            {
                annualSubscriptionId,
                providerPaymentId,
                source,
                currentStatus: sub.status
            },
            'Annual subscription confirmation: subscription is not pending_provider — payment ignored'
        );
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
        const amountInCentavos = Math.round(amount * 100);
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

    // SPEC-143 Finding #21 fallback cleanup. Mark any active polling job
    // for this annual subscription as `succeeded` so the cron stops
    // searching MP for a sub whose status the webhook just resolved.
    // Idempotent — even if this fails, the next poll attempt would see
    // the sub already `active` and would no-op via the confirmAnnualSubscription
    // idempotency guard. Skipped when source='polling' because in that
    // case the cron itself is updating the job.
    if (source !== 'polling') {
        try {
            const pollingStorage = billing.getStorage().subscriptionPollingJobs;
            if (pollingStorage) {
                const activeJob = await pollingStorage.findActiveBySubscriptionId(sub.id);
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
    readonly amount: number;
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
        apiLogger.warn(
            { planChangeUpgradeId, providerPaymentId, source },
            'Plan upgrade confirmation: local subscription not found — payment ignored'
        );
        return { confirmed: false };
    }

    if (sub.planId === newPlanId) {
        apiLogger.info(
            { planChangeUpgradeId, providerPaymentId, newPlanId, source },
            'Plan upgrade confirmation: subscription already on target plan — idempotent skip'
        );
        return { confirmed: false };
    }

    if (sub.status !== 'active' && sub.status !== 'trialing') {
        apiLogger.warn(
            {
                planChangeUpgradeId,
                providerPaymentId,
                source,
                currentStatus: sub.status
            },
            'Plan upgrade confirmation: subscription is not active/trialing — payment ignored'
        );
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

    // Step 2: propagate to MP preapproval — best-effort.
    const mpSubscriptionId = sub.providerSubscriptionIds?.mercadopago;
    if (mpSubscriptionId) {
        const paymentAdapter = billing.getPaymentAdapter();
        if (paymentAdapter) {
            try {
                await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                    planId: newPlanId,
                    transactionAmount: targetTransactionAmountMajor
                });
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
        const amountInCentavos = Math.round(amount * 100);
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
 *     (Addon refund revocation is deferred to TODO(SPEC-194 T-012/T-019).)
 *     If no addon purchase found → fall through to `applyRefundLifecycle` (its
 *     own no-subscription guard will log and return gracefully).
 *  3. Call `applyRefundLifecycle({ payment, refundAmount: undefined,
 *     adminUserId: 'webhook' })`. `refundAmount = undefined` is intentional:
 *     MP `payment.updated` events do not reliably carry a
 *     `transaction_amount_refunded` field, and Checkout Pro refunds via the
 *     MP admin are typically full refunds. `applyRefundLifecycle` treats
 *     `undefined` as a full refund.
 *     TODO(SPEC-194 T-019): parse `transaction_amount_refunded` from the MP
 *     payload and pass it as `refundAmount` once the partial-refund audit path
 *     is implemented.
 *
 * The entire function is fail-safe: step failures are caught and logged so a
 * transient DB error does not propagate as a webhook 500 — MP would then retry
 * the event indefinitely.
 *
 * @param mpPaymentId - The MP payment ID extracted from `data.id`.
 * @param source      - Caller label for log messages (webhook | polling).
 */
async function applyWebhookRefundLifecycle({
    mpPaymentId,
    source
}: {
    readonly mpPaymentId: string;
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
                amount: billingPayments.amount
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
    // refundAmount=undefined → treated as full refund (see function JSDoc above).
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
            refundAmount: undefined,
            adminUserId: 'webhook'
        });
    } catch (err) {
        apiLogger.error(
            { mpPaymentId, source, paymentId: payment.id, customerId: payment.customerId, err },
            'Webhook refund lifecycle: applyRefundLifecycle threw unexpectedly — lifecycle effects may be incomplete'
        );
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
    const customerId = typeof metadata?.customerId === 'string' ? metadata.customerId : null;

    // Dispatch payment status notifications
    if (paymentInfo && customerId) {
        const { amount, currency, status, statusDetail, paymentMethod } = paymentInfo;

        if (status === 'approved' || status === 'accredited') {
            apiLogger.debug(
                { customerId, amount, currency, status, source },
                'Payment succeeded - sending success notification'
            );

            await sendPaymentSuccessNotification(
                customerId,
                amount,
                currency,
                paymentMethod,
                billing
            );
        }

        if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
            const failureReason = statusDetail || status;

            apiLogger.debug(
                { customerId, amount, currency, status, statusDetail, source },
                'Payment failed - sending failure notifications'
            );

            await sendPaymentFailureNotifications(
                customerId,
                amount,
                currency,
                failureReason,
                billing
            );
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
    if (paymentInfo?.status === 'refunded') {
        const mpPaymentId =
            typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

        if (mpPaymentId) {
            await applyWebhookRefundLifecycle({ mpPaymentId, source });
        }
    }

    // SPEC-141 D1: annual subscription confirmation. The metadata
    // carries `annualSubscriptionId` set by initiatePaidAnnualSubscription;
    // we look it up here BEFORE the addon dispatch since both flows go
    // through the same payment.updated event but are mutually exclusive
    // (annual checkout never carries addonSlug metadata and vice versa).
    const annualSubscriptionId = extractAnnualSubscriptionMetadata(data.metadata);

    if (annualSubscriptionId && paymentInfo && MP_APPROVED_STATUSES.has(paymentInfo.status)) {
        const providerPaymentId =
            typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

        if (providerPaymentId) {
            try {
                const result = await confirmAnnualSubscription({
                    annualSubscriptionId,
                    providerPaymentId,
                    amount: paymentInfo.amount,
                    currency: paymentInfo.currency,
                    billing,
                    source
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
    if (upgradeMetadata && paymentInfo && MP_APPROVED_STATUSES.has(paymentInfo.status)) {
        const providerPaymentId =
            typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

        if (providerPaymentId) {
            try {
                const result = await confirmPlanUpgrade({
                    metadata: upgradeMetadata,
                    providerPaymentId,
                    amount: paymentInfo.amount,
                    currency: paymentInfo.currency,
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

    const { addonSlug, customerId: addonCustomerId } = addonInfo;

    // ── Idempotency check: skip if this paymentId was already processed ───────
    const paymentId =
        typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

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
    const result = await addonService.confirmPurchase({
        customerId: addonCustomerId,
        addonSlug
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

    apiLogger.info(
        { addonSlug, customerId: addonCustomerId, source },
        'Add-on purchase confirmed successfully'
    );

    // Send addon purchase notification
    try {
        const customer = await billing.customers.get(addonCustomerId);
        // SPEC-192 T-016: resolve addon definition from DB-backed catalog.
        // Identical fallback: if NOT_FOUND, `addon` is undefined → notification not sent.
        const addonCatalogResult = await catalogService.getBySlug(addonSlug);
        const addon = addonCatalogResult.success ? addonCatalogResult.data : undefined;

        if (customer && addon) {
            const customerName =
                typeof customer.metadata?.name === 'string'
                    ? customer.metadata.name
                    : customer.email;
            const userId =
                typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

            sendNotification({
                type: NotificationType.ADDON_PURCHASE,
                recipientEmail: customer.email,
                recipientName: customerName,
                userId,
                customerId: customer.id,
                planName: addon.name,
                amount: typeof data.transaction_amount === 'number' ? data.transaction_amount : 0,
                currency: typeof data.currency_id === 'string' ? data.currency_id : 'ARS',
                nextBillingDate: new Date().toISOString()
            }).catch((notifError) => {
                apiLogger.debug(
                    {
                        customerId: addonCustomerId,
                        addonSlug,
                        error:
                            notifError instanceof Error ? notifError.message : String(notifError),
                        source
                    },
                    'Addon purchase notification failed (will retry)'
                );
            });
        }
    } catch (notifError) {
        apiLogger.debug(
            {
                customerId: addonCustomerId,
                addonSlug,
                error: notifError instanceof Error ? notifError.message : String(notifError),
                source
            },
            'Failed to prepare addon purchase notification'
        );
    }

    return { success: true, addonConfirmed: true };
}
