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
import { and, billingPayments, billingSubscriptions, eq, getDb, isNull, sql } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { AddonCatalogService } from '@repo/service-core';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { handlePlanChangeAddonRecalculation } from '../../../services/addon-plan-change.service';
import { AddonService } from '../../../services/addon.service';
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
        const addonSlug = extractAddonFromReference(data.external_reference);

        if (addonSlug) {
            apiLogger.warn(
                {
                    addonSlug,
                    externalReference: data.external_reference,
                    hasMetadata: !!data.metadata,
                    metadataKeys: data.metadata ? Object.keys(data.metadata as object) : [],
                    paymentId: data.id,
                    paymentStatus: data.status,
                    source
                },
                'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly'
            );
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
