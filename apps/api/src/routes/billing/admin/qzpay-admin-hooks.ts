/**
 * Hospeda-side hooks for `@qazuor/qzpay-hono`'s admin tier.
 *
 * `createAdminRoutes` ships in qzpay-hono v1.3 with an optional `hooks`
 * object on the config. When provided, the package invokes each callback
 * at a documented point of the relevant write operation:
 *
 *  - `onBeforeSubscriptionCancel` runs BEFORE the cancel commits in QZPay.
 *    Returning `{ ok: false, reason }` aborts the cancel with HTTP 422.
 *  - `onAfter*` callbacks run AFTER QZPay has committed the operation.
 *    They run inside a `try/catch` in qzpay-hono — if they throw, the
 *    error is logged but the response stays 200 (the core operation has
 *    already committed, we cannot roll it back).
 *
 * The hooks below replace the lifecycle that used to live in the now-deleted
 * `apps/api/src/routes/billing/admin/subscription-cancel.ts` route handler
 * and consolidate the side effects for cancel, change-plan, extend-trial,
 * payment refund and invoice pay/void operations.
 *
 * Authentication is enforced upstream by `adminBillingAuthMiddleware`
 * (see `./index.ts`); hooks assume the actor in `ctx` is already authorized.
 *
 * @module routes/billing/admin/qzpay-admin-hooks
 */

import type { QZPayAdminLifecycleHooks } from '@qazuor/qzpay-hono';
import {
    billingAddonPurchases,
    billingSubscriptionEvents,
    billingSubscriptions,
    getDb
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { AddonCatalogService, BILLING_EVENT_TYPES } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, isNull } from 'drizzle-orm';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { revokeAddonForSubscriptionCancellation } from '../../../services/addon-lifecycle.service';
import { applyRefundLifecycle } from '../../../services/refund-lifecycle.service';
import {
    resolveOwnerUserId,
    setOwnerServiceSuspension
} from '../../../services/subscription-pause.service';
import { apiLogger } from '../../../utils/logger';

// ─── Catalog service (DB-backed addon reads — SPEC-192 T-017) ─────────────────
// Replaces the dynamic `import('@repo/billing').getAddonBySlug` in the
// onBeforeSubscriptionCancel hook. Instantiated once at module level.
// NOTE: addon.checkout.ts is intentionally NOT cut over here — deferred to T-037,
// pending SPEC-127 (checkout flow refactor). Only this hook's cancel path is updated.
const catalogService = new AddonCatalogService();

/**
 * Reads the `suspendService` flag from the admin pause request body.
 *
 * Admin pause supports two modes (SPEC-143 #29): `suspendService: true` hides
 * the owner's listings and locks edits (same as a host self-pause), while
 * `false` is a billing-only hold that leaves the listings live. Defaults to
 * `true` (the safer, more common case) when the body omits the flag.
 */
async function readSuspendServiceFlag(ctx: {
    req: { json: () => Promise<unknown> };
}): Promise<boolean> {
    try {
        const body = (await ctx.req.json()) as { suspendService?: unknown };
        return body?.suspendService !== false;
    } catch {
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ActiveAddonPurchase {
    readonly id: string;
    readonly addonSlug: string;
    readonly customerId: string;
}

interface AddonRevocationSummary {
    readonly purchaseId: string;
    readonly addonSlug: string;
    readonly outcome: 'success' | 'failed';
    readonly error?: string;
}

// ---------------------------------------------------------------------------
// Hook implementations
// ---------------------------------------------------------------------------

/**
 * Context key for stashing the subscription's pre-cancel status between the
 * before- and after-cancel hooks (Gap 1: audit previousStatus) and the cancel
 * reason supplied by the admin (Gap 2: audit metadata.reason). The Hono
 * Context is the only channel shared across both hook invocations for the same
 * request. We use a loose cast to write/read an untyped key rather than
 * extending QZPayHonoEnv.Variables, keeping the footprint minimal.
 */
const CTX_CANCEL_PREVIOUS_STATUS = '__hospeda_cancel_previousStatus__';
const CTX_CANCEL_REASON = '__hospeda_cancel_reason__';

/**
 * Before-cancel hook: guard against double-cancel, capture the pre-cancel
 * subscription status + admin reason into ctx for the after-hook, revoke
 * linked Hospeda addon entitlements/limits, and record a compensating event
 * before qzpay-hono cancels the subscription in the DB + payment provider.
 *
 * Aborts with `{ ok: false, reason }` (HTTP 422) when:
 *   - The subscription is already cancelled (Gap 3: idempotency guard).
 *   - The billing service is unavailable.
 *   - Any addon revocation fails.
 */
const onBeforeSubscriptionCancel: NonNullable<
    QZPayAdminLifecycleHooks['onBeforeSubscriptionCancel']
> = async ({ subscriptionId, reason, ctx }) => {
    const actor = getActorFromContext(ctx);
    const adminUserId = actor.id;

    const billing = getQZPayBilling();
    if (!billing) {
        apiLogger.error({ subscriptionId }, 'Admin cancel hook: billing service unavailable');
        return { ok: false, reason: 'Billing service is not configured.' };
    }

    const db = getDb();

    // Gap 3: idempotency guard — reject double-cancel before any side effects.
    // qzpay-core's cancel is idempotent (returns 200 again), but we must reject
    // the second attempt ourselves so we don't write a second audit event or
    // re-run addon revocation on an already-cancelled subscription.
    // We query the live DB row rather than using billing.subscriptions.get() so
    // the check is authoritative and avoids any in-memory cache.
    // NOTE: qzpay-core final-writes status as 'canceled' (US spelling), not
    // 'cancelled' (UK) — match against both spellings defensively.
    const existingRows = await db
        .select({ status: billingSubscriptions.status })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId));
    const currentStatus = existingRows[0]?.status ?? null;

    if (currentStatus === 'canceled' || currentStatus === 'cancelled') {
        apiLogger.warn(
            { subscriptionId, currentStatus },
            'Admin cancel hook: subscription already cancelled — aborting'
        );
        return { ok: false, reason: 'Subscription is already cancelled.' };
    }

    // Gap 1: stash the pre-cancel status so the after-hook can record it as
    // previousStatus in the audit event. currentStatus may be null if the row
    // was not found (unlikely — qzpay will error next), but store it anyway.
    // TYPE-WORKAROUND: qzpay-hono's `ctx` is an opaque Hono context type with no
    // index signature; we use it as a cross-hook property bag to pass state from
    // onBefore to onAfter, which the library supports at runtime but not in types.
    (ctx as unknown as Record<string, unknown>)[CTX_CANCEL_PREVIOUS_STATUS] = currentStatus;

    // Gap 2: stash the admin-supplied reason so the after-hook can include it
    // in the audit metadata. The reason is passed by qzpay-hono from the
    // request body string, so it may be undefined when omitted.
    // TYPE-WORKAROUND: same opaque ctx property-bag pattern as Gap 1 above.
    (ctx as unknown as Record<string, unknown>)[CTX_CANCEL_REASON] =
        typeof reason === 'string' ? reason : undefined;

    // Resolve customer + active purchases for the subscription.
    const purchases: ActiveAddonPurchase[] = await db
        .select({
            id: billingAddonPurchases.id,
            addonSlug: billingAddonPurchases.addonSlug,
            customerId: billingAddonPurchases.customerId
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.subscriptionId, subscriptionId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    if (purchases.length === 0) {
        return { ok: true };
    }

    const customerId = purchases[0]?.customerId ?? '';

    apiLogger.info(
        { subscriptionId, customerId, count: purchases.length },
        'Admin cancel hook: revoking addon purchases in parallel'
    );

    const settled = await Promise.allSettled(
        purchases.map(async (purchase): Promise<AddonRevocationSummary> => {
            // SPEC-192 T-017: resolve addon definition from DB-backed catalog.
            // NOT_FOUND → undefined (triggers "unknown/retired" path in revoke helper,
            // identical to old getAddonBySlug returning undefined).
            const catalogResult = await catalogService.getBySlug(purchase.addonSlug);
            const addonDef = catalogResult.success ? catalogResult.data : undefined;
            try {
                await revokeAddonForSubscriptionCancellation({
                    customerId,
                    purchase: { id: purchase.id, addonSlug: purchase.addonSlug },
                    addonDef,
                    billing
                });
                return {
                    purchaseId: purchase.id,
                    addonSlug: purchase.addonSlug,
                    outcome: 'success'
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                apiLogger.error(
                    { subscriptionId, customerId, purchaseId: purchase.id, errorMessage },
                    'Admin cancel hook: addon revocation failed'
                );
                return {
                    purchaseId: purchase.id,
                    addonSlug: purchase.addonSlug,
                    outcome: 'failed',
                    error: errorMessage
                };
            }
        })
    );

    const results: AddonRevocationSummary[] = settled.map((r, i) =>
        r.status === 'fulfilled'
            ? r.value
            : {
                  purchaseId: purchases[i]?.id ?? 'unknown',
                  addonSlug: purchases[i]?.addonSlug ?? 'unknown',
                  outcome: 'failed' as const,
                  error: r.reason instanceof Error ? r.reason.message : String(r.reason)
              }
    );

    const failed = results.filter((r) => r.outcome === 'failed');
    const succeeded = results.filter((r) => r.outcome === 'success');

    // Compensating event records which addon QZPay entitlements were already
    // revoked so the DB and the provider can be reconciled if Phase 2 fails.
    await db.insert(billingSubscriptionEvents).values({
        subscriptionId,
        eventType: BILLING_EVENT_TYPES.ADDON_REVOCATIONS_PENDING,
        triggerSource: 'admin-cancel-compensating',
        metadata: {
            revokedAddonPurchaseIds: succeeded.map((r) => r.purchaseId),
            failedAddonPurchaseIds: failed.map((r) => r.purchaseId),
            timestamp: new Date().toISOString()
        }
    });

    if (failed.length > 0) {
        const failedSlugs = failed.map((r) => r.addonSlug).join(', ');
        Sentry.captureException(
            new Error(
                `Admin subscription cancel: addon revocation failed for ${failed.length} purchase(s). Failed slugs: ${failedSlugs}`
            ),
            {
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'admin_subscription_cancel'
                },
                extra: {
                    subscriptionId,
                    customerId,
                    adminUserId,
                    failedPurchases: failed,
                    succeededPurchases: succeeded
                }
            }
        );
        return {
            ok: false,
            reason: `Addon entitlement cleanup failed for: ${failedSlugs}. Cancel aborted.`
        };
    }

    return { ok: true };
};

/**
 * After-cancel hook: mark Hospeda addon purchases as canceled, insert the
 * audit log entry, and clear the entitlement cache so the user is dropped
 * from cached feature access immediately.
 */
const onAfterSubscriptionCancel: NonNullable<
    QZPayAdminLifecycleHooks['onAfterSubscriptionCancel']
> = async ({ subscription, immediate, ctx }) => {
    const actor = getActorFromContext(ctx);
    const adminUserId = actor.id;
    const db = getDb();

    // Mark the linked addon purchases as canceled (American spelling on the
    // purchases table, intentional asymmetry with the subscription's
    // CANCELLED status).
    await db
        .update(billingAddonPurchases)
        .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingAddonPurchases.subscriptionId, subscription.id),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    // Gap 1: recover the pre-cancel status stashed by onBeforeSubscriptionCancel.
    // TYPE-WORKAROUND: same opaque ctx property-bag pattern as the before-hook.
    const previousStatus = (ctx as unknown as Record<string, unknown>)[CTX_CANCEL_PREVIOUS_STATUS];

    // Gap 2: recover the admin-supplied reason stashed by onBeforeSubscriptionCancel.
    // TYPE-WORKAROUND: same opaque ctx property-bag pattern as the before-hook.
    const cancelReason = (ctx as unknown as Record<string, unknown>)[CTX_CANCEL_REASON];

    // Audit log entry — keeps the lifecycle event trail in sync with the
    // admin actor that triggered the cancellation.
    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: subscription.id,
        previousStatus: typeof previousStatus === 'string' ? previousStatus : null,
        newStatus: SubscriptionStatusEnum.CANCELLED,
        triggerSource: 'admin-cancel',
        metadata: {
            adminUserId,
            immediate,
            ...(typeof cancelReason === 'string' ? { reason: cancelReason } : {})
        }
    });

    clearEntitlementCache(subscription.customerId);

    apiLogger.info(
        { subscriptionId: subscription.id, customerId: subscription.customerId, adminUserId },
        'Admin cancel hook: post-cancel side effects applied'
    );
};

/**
 * After-change-plan hook: audit-log the plan transition.
 */
const onAfterSubscriptionChangePlan: NonNullable<
    QZPayAdminLifecycleHooks['onAfterSubscriptionChangePlan']
> = async ({ subscription, previousPlanId, newPlanId, ctx }) => {
    const actor = getActorFromContext(ctx);
    const db = getDb();

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: subscription.id,
        triggerSource: 'admin-change-plan',
        metadata: {
            adminUserId: actor.id,
            previousPlanId,
            newPlanId
        }
    });

    clearEntitlementCache(subscription.customerId);

    apiLogger.info(
        {
            subscriptionId: subscription.id,
            previousPlanId,
            newPlanId,
            adminUserId: actor.id
        },
        'Admin change-plan hook: audit logged'
    );
};

/**
 * After-trial-extended hook: audit-log the trial extension.
 */
const onAfterSubscriptionTrialExtended: NonNullable<
    QZPayAdminLifecycleHooks['onAfterSubscriptionTrialExtended']
> = async ({ subscription, additionalDays, ctx }) => {
    const actor = getActorFromContext(ctx);
    const db = getDb();

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: subscription.id,
        triggerSource: 'admin-extend-trial',
        metadata: {
            adminUserId: actor.id,
            additionalDays,
            newTrialEnd: subscription.trialEnd?.toISOString() ?? null
        }
    });

    apiLogger.info(
        { subscriptionId: subscription.id, additionalDays, adminUserId: actor.id },
        'Admin extend-trial hook: audit logged'
    );
};

/**
 * After-refund hook: emit a Sentry breadcrumb, then apply the refund lifecycle
 * policy via {@link applyRefundLifecycle}:
 *
 * - Full refund  → transition the linked subscription to `cancelled`, revoke
 *                  entitlements, and clear the entitlement cache (SPEC-194 T-003).
 * - Partial refund → audit-intent log only; subscription state unchanged.
 *                    (T-019 will model partial-refund events when ready.)
 *
 * The `applyRefundLifecycle` call is wrapped in a try/catch so a transient DB
 * error does not surface as a 500 — the core refund has already committed in
 * QZPay, so qzpay-hono has returned 200. The error is logged for Sentry
 * alerting via the logger integration.
 */
const onAfterPaymentRefund: NonNullable<QZPayAdminLifecycleHooks['onAfterPaymentRefund']> = async ({
    payment,
    amount,
    reason,
    ctx
}) => {
    const actor = getActorFromContext(ctx);

    Sentry.addBreadcrumb({
        category: 'billing.admin',
        type: 'info',
        message: 'admin_payment_refund',
        data: {
            paymentId: payment.id,
            amount,
            reason,
            adminUserId: actor.id
        }
    });

    apiLogger.info(
        {
            paymentId: payment.id,
            customerId: payment.customerId,
            refundAmount: amount,
            reason,
            adminUserId: actor.id
        },
        'Admin refund hook: refund committed'
    );

    // Apply subscription state change + entitlement revocation (SPEC-194 T-003).
    // Wrapped in try/catch: lifecycle errors must not fail the refund response
    // (the QZPay write already committed; qzpay-hono wraps after-hooks but we
    // guard defensively here too).
    try {
        await applyRefundLifecycle({
            payment,
            refundAmount: amount,
            adminUserId: actor.id
        });
    } catch (err) {
        apiLogger.error(
            {
                paymentId: payment.id,
                customerId: payment.customerId,
                adminUserId: actor.id,
                err
            },
            'Admin refund hook: applyRefundLifecycle threw unexpectedly — lifecycle effects may be incomplete'
        );
    }
};

/**
 * After-invoice-pay hook: structured log entry.
 */
const onAfterInvoicePay: NonNullable<QZPayAdminLifecycleHooks['onAfterInvoicePay']> = async ({
    invoice,
    ctx
}) => {
    const actor = getActorFromContext(ctx);
    apiLogger.info(
        { invoiceId: invoice.id, customerId: invoice.customerId, adminUserId: actor.id },
        'Admin invoice pay hook: payment recorded'
    );
};

/**
 * After-invoice-void hook: structured log entry.
 */
const onAfterInvoiceVoid: NonNullable<QZPayAdminLifecycleHooks['onAfterInvoiceVoid']> = async ({
    invoice,
    ctx
}) => {
    const actor = getActorFromContext(ctx);
    apiLogger.info(
        { invoiceId: invoice.id, customerId: invoice.customerId, adminUserId: actor.id },
        'Admin invoice void hook: invoice voided'
    );
};

/**
 * Before-pause hook: validate the subscription can be paused.
 *
 * MercadoPago only accepts pausing an active preapproval. We guard here so a
 * pause on a non-active subscription is rejected with 422 BEFORE qzpay flips
 * the local status (otherwise, under providerSyncErrorStrategy=log, the local
 * row could diverge from MP).
 */
const onBeforeSubscriptionPause: NonNullable<
    QZPayAdminLifecycleHooks['onBeforeSubscriptionPause']
> = async ({ subscriptionId }) => {
    const billing = getQZPayBilling();
    if (!billing) {
        return { ok: false, reason: 'Billing service is not configured.' };
    }

    const subscription = await billing.subscriptions.get(subscriptionId);
    if (!subscription) {
        return { ok: false, reason: 'Subscription not found.' };
    }
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return {
            ok: false,
            reason: `Only an active subscription can be paused (current status: ${subscription.status}).`
        };
    }
    return { ok: true };
};

/**
 * After-pause hook: apply the service-suspension side effect when the admin
 * requested it (`suspendService: true`, the default). Hides the owner's
 * accommodations from public reads and locks them from edits. Billing-only
 * pauses (`suspendService: false`) leave the listings untouched.
 */
const onAfterSubscriptionPause: NonNullable<
    QZPayAdminLifecycleHooks['onAfterSubscriptionPause']
> = async ({ subscription, ctx }) => {
    const actor = getActorFromContext(ctx);
    const suspendService = await readSuspendServiceFlag(ctx);
    const db = getDb();

    let accommodationsUpdated = 0;
    if (suspendService) {
        const userId = await resolveOwnerUserId({ customerId: subscription.customerId });
        if (userId) {
            const result = await setOwnerServiceSuspension({ userId, suspended: true, db });
            accommodationsUpdated = result.accommodationsUpdated;
        } else {
            apiLogger.warn(
                { subscriptionId: subscription.id, customerId: subscription.customerId },
                'Admin pause hook: could not resolve owner user id, service suspension skipped'
            );
        }
    }

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: subscription.id,
        newStatus: SubscriptionStatusEnum.PAUSED,
        triggerSource: 'admin-pause',
        metadata: {
            adminUserId: actor.id,
            suspendService,
            accommodationsUpdated
        }
    });

    clearEntitlementCache(subscription.customerId);

    apiLogger.info(
        {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            adminUserId: actor.id,
            suspendService,
            accommodationsUpdated
        },
        'Admin pause hook: post-pause side effects applied'
    );
};

/**
 * Before-resume hook: validate the subscription is currently paused.
 */
const onBeforeSubscriptionResume: NonNullable<
    QZPayAdminLifecycleHooks['onBeforeSubscriptionResume']
> = async ({ subscriptionId }) => {
    const billing = getQZPayBilling();
    if (!billing) {
        return { ok: false, reason: 'Billing service is not configured.' };
    }

    const subscription = await billing.subscriptions.get(subscriptionId);
    if (!subscription) {
        return { ok: false, reason: 'Subscription not found.' };
    }
    if (subscription.status !== 'paused') {
        return {
            ok: false,
            reason: `Only a paused subscription can be resumed (current status: ${subscription.status}).`
        };
    }
    return { ok: true };
};

/**
 * After-resume hook: always clear the service-suspension flags (no-op when the
 * pause was billing-only) so the owner's listings come back exactly as they
 * were, and audit-log the resume.
 */
const onAfterSubscriptionResume: NonNullable<
    QZPayAdminLifecycleHooks['onAfterSubscriptionResume']
> = async ({ subscription, ctx }) => {
    const actor = getActorFromContext(ctx);
    const db = getDb();

    let accommodationsUpdated = 0;
    const userId = await resolveOwnerUserId({ customerId: subscription.customerId });
    if (userId) {
        const result = await setOwnerServiceSuspension({ userId, suspended: false, db });
        accommodationsUpdated = result.accommodationsUpdated;
    }

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: subscription.id,
        newStatus: SubscriptionStatusEnum.ACTIVE,
        triggerSource: 'admin-resume',
        metadata: {
            adminUserId: actor.id,
            accommodationsUpdated
        }
    });

    clearEntitlementCache(subscription.customerId);

    apiLogger.info(
        {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            adminUserId: actor.id,
            accommodationsUpdated
        },
        'Admin resume hook: post-resume side effects applied'
    );
};

// ---------------------------------------------------------------------------
// Public hooks bundle
// ---------------------------------------------------------------------------

/**
 * All Hospeda lifecycle hooks for the qzpay-hono admin tier.
 *
 * Pass this bundle to `createAdminRoutes({ ..., hooks: adminBillingHooks })`.
 */
export const adminBillingHooks: QZPayAdminLifecycleHooks = {
    onBeforeSubscriptionCancel,
    onAfterSubscriptionCancel,
    onBeforeSubscriptionPause,
    onAfterSubscriptionPause,
    onBeforeSubscriptionResume,
    onAfterSubscriptionResume,
    onAfterSubscriptionChangePlan,
    onAfterSubscriptionTrialExtended,
    onAfterPaymentRefund,
    onAfterInvoicePay,
    onAfterInvoiceVoid
};
