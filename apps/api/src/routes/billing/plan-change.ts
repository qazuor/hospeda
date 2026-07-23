/**
 * Plan Change Routes
 *
 * API endpoint for changing subscription plans (upgrades/downgrades).
 * Provides plan change functionality with proration handling.
 *
 * Routes:
 * - POST /api/v1/protected/billing/subscriptions/change-plan - Change subscription plan (authenticated)
 *
 * @remarks
 * **BILL-13 Decision (v1):** Plan changes are only supported for active subscriptions.
 * Canceled or expired subscriptions cannot be reactivated through a plan change.
 * Users in those states must contact support for manual reactivation before changing plans.
 *
 * @module routes/billing/plan-change
 */

import { compareCategoryRank, resolvePlanCategory } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import type { DowngradePreview } from '@repo/schemas';
import {
    BillingIntervalEnum,
    PlanChangeRequestSchema,
    PlanChangeResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../../lib/billing-provider-error';
import { captureBillingError } from '../../lib/sentry';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../middlewares/idempotency-key';
import { applyImmediatePaidPlanSwap } from '../../services/billing/immediate-plan-swap.service';
import { planDisplayNameFromPlan } from '../../services/billing/plan-change-reason';
import { applyTrialingPlanUpgrade } from '../../services/billing/trialing-plan-upgrade.service';
import {
    initiatePaidPlanUpgrade,
    SubscriptionCheckoutError
} from '../../services/subscription-checkout.service';
import {
    SubscriptionDowngradeError,
    scheduleSubscriptionDowngrade
} from '../../services/subscription-downgrade.service';
import {
    computeDowngradeExcess,
    defaultExcessDeps
} from '../../services/subscription-downgrade-excess.service';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { sendNotification } from '../../utils/notification-helper';
import { createSimpleRoute, type SimpleRouteInterface } from '../../utils/route-factory';
import { buildNotificationUrl } from './checkout-return-urls';

/**
 * Map a `SubscriptionCheckoutError` from the upgrade service to an
 * `HTTPException`. Kept colocated with the plan-change handler because
 * it shares the error union with `start-paid.ts`'s mapper — see that
 * file for the full mapping rationale.
 */
function mapUpgradeErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MATCHING_PRICE':
        case 'CUSTOMER_NOT_FOUND':
        case 'SUBSCRIPTION_NOT_FOUND':
            return new HTTPException(404, { message: err.message });
        case 'SAME_PLAN':
        case 'NOT_AN_UPGRADE':
            return new HTTPException(422, { message: err.message });
        case 'MISSING_INIT_POINT':
            return new HTTPException(500, { message: err.message });
        // HOS-151 Bug C: MP returned a 2xx preapproval with no provider id; the
        // just-created row was cancelled fail-closed. Upstream-provider failure,
        // retryable — 502, aligned with start-paid's mapper.
        case 'MISSING_PROVIDER_SUBSCRIPTION_ID':
            return new HTTPException(502, { message: err.message });
        // HOS-211: the trial-time upgrade's fail-closed preapproval-amount
        // mutation was rejected by MP — the local plan change was never
        // applied. Upstream-provider failure, retryable — 502, consistent
        // with MISSING_PROVIDER_SUBSCRIPTION_ID above.
        case 'MP_PREAPPROVAL_MUTATION_FAILED':
            return new HTTPException(502, { message: err.message });
        // HOS-211: MP was ALREADY mutated to the new price, but the local
        // changePlan commit failed afterward — a local/MP drift state, not a
        // clean upstream rejection. 500 (server-side inconsistency), distinct
        // from MP_PREAPPROVAL_MUTATION_FAILED above (which means nothing was
        // mutated and is safe/retryable).
        case 'TRIALING_UPGRADE_LOCAL_APPLY_FAILED':
            return new HTTPException(500, { message: err.message });
        // HOS-222: the immediate cross-category plan swap mutated MP but the
        // local changePlan commit failed afterward — same local/MP drift
        // semantics as TRIALING_UPGRADE_LOCAL_APPLY_FAILED above. 500.
        case 'IMMEDIATE_SWAP_LOCAL_APPLY_FAILED':
            return new HTTPException(500, { message: err.message });
        default:
            return new HTTPException(500, { message: err.message });
    }
}

/**
 * Map a `SubscriptionDowngradeError` from the schedule service to an
 * `HTTPException`. Mirrors the upgrade mapper above — the two flows
 * have distinct error unions so they cannot share a mapper.
 */
function mapDowngradeErrorToHttp(err: SubscriptionDowngradeError): HTTPException {
    switch (err.code) {
        case 'SUBSCRIPTION_NOT_FOUND':
        case 'PLAN_NOT_FOUND':
        case 'NO_MATCHING_PRICE':
            return new HTTPException(404, { message: err.message });
        case 'SAME_PLAN':
        case 'NOT_A_DOWNGRADE':
            return new HTTPException(422, { message: err.message });
        default:
            return new HTTPException(500, { message: err.message });
    }
}

/**
 * Mapped QZPay interval with count for multi-month periods.
 */
interface QZPayIntervalMapping {
    /** QZPay interval unit */
    readonly interval: 'month' | 'year' | 'week' | 'day';
    /** Number of interval units per billing period (e.g., 3 for quarterly) */
    readonly intervalCount: number;
}

/**
 * Map BillingIntervalEnum to QZPay interval format with count.
 *
 * QZPay uses 'month' | 'year' with an optional count, while our enum
 * uses 'monthly' | 'annual' | 'quarterly' | 'semi_annual'.
 *
 * @param interval - Hospeda billing interval enum value
 * @returns QZPay interval unit and count
 */
/**
 * Supported billing interval values for plan changes.
 * Used to validate interval before mapping to QZPay format.
 */
const SUPPORTED_INTERVALS = new Set(['monthly', 'annual', 'quarterly', 'semi_annual', 'one_time']);

function mapBillingIntervalToQZPay(interval: BillingIntervalEnum): QZPayIntervalMapping {
    const intervalStr = interval as string;

    if (!SUPPORTED_INTERVALS.has(intervalStr)) {
        throw new HTTPException(422, {
            message: `Unsupported billing interval '${intervalStr}'. Supported intervals: ${[...SUPPORTED_INTERVALS].join(', ')}`
        });
    }

    switch (intervalStr) {
        case 'monthly':
            return { interval: 'month', intervalCount: 1 };
        case 'annual':
            return { interval: 'year', intervalCount: 1 };
        case 'quarterly':
            return { interval: 'month', intervalCount: 3 };
        case 'semi_annual':
            return { interval: 'month', intervalCount: 6 };
        case 'one_time':
            return { interval: 'month', intervalCount: 1 };
        default:
            throw new HTTPException(422, {
                message: `Unsupported billing interval '${intervalStr}'. Supported intervals: ${[...SUPPORTED_INTERVALS].join(', ')}`
            });
    }
}

/**
 * Handler for changing subscription plans
 * Extracted for testability
 *
 * @param c - Hono context
 * @returns Plan change response with status and proration details
 * @throws HTTPException 503 if billing not configured
 * @throws HTTPException 400 if no billing account found or validation fails
 * @throws HTTPException 404 if subscription or target plan not found
 * @throws HTTPException 500 if service fails
 */
export const handlePlanChange = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        throw new HTTPException(503, {
            message: 'Billing service is not configured'
        });
    }

    const billingCustomerId = c.get('billingCustomerId');

    if (!billingCustomerId) {
        throw new HTTPException(400, {
            message: 'No billing account found'
        });
    }

    const actor = getActorFromContext(c);

    // Parse and validate request body
    const body = await c.req.json();
    const parseResult = PlanChangeRequestSchema.safeParse(body);

    if (!parseResult.success) {
        throw new HTTPException(400, {
            message: 'Invalid request body',
            cause: parseResult.error.flatten()
        });
    }

    // keepSelections is intentionally extracted here but is ONLY forwarded to
    // the downgrade path below. For upgrades it is silently ignored per spec
    // §4 decision 3 (see PlanChangeRequestSchema JSDoc).
    const { newPlanId, billingInterval, keepSelections } = parseResult.data;

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
        });
    }

    try {
        // 1. Get user's active subscription
        const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
        const activeSubscription = subscriptions.find(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            throw new HTTPException(404, {
                message: 'No active subscription found'
            });
        }

        // SPEC-147 T-008 / Q7 guard: the cancel wins.
        // If the subscription is already scheduled to cancel at period end,
        // block plan changes until the cancellation finalises. The user must
        // wait for the finalization cron to flip status to 'cancelled' before
        // they can change to a new plan. This prevents a race where a
        // soft-cancel and a plan-change collide, leaving an ambiguous state.
        if (activeSubscription.cancelAtPeriodEnd) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Subscription is scheduled to cancel at period end. Cannot change plan while a cancellation is pending. Please wait for the current period to end.',
                undefined,
                'SUBSCRIPTION_CANCEL_PENDING'
            );
        }

        // 2. Get target plan details
        const targetPlan = await billing.plans.get(newPlanId);

        if (!targetPlan) {
            throw new HTTPException(404, {
                message: `Target plan '${newPlanId}' not found`
            });
        }

        // SPEC-148 T-006 guard: reject plan-change onto a disabled plan.
        // A user must not move onto a retiring or retired plan. QZPayPlan.active
        // is the canonical active flag — reject with 410 PLAN_DISABLED so the
        // client can surface a clear "plan no longer available" message.
        if (targetPlan.active === false) {
            throw new ServiceError(
                ServiceErrorCode.PLAN_DISABLED,
                'This plan is no longer available. Please choose an active plan.',
                undefined,
                'PLAN_DISABLED'
            );
        }

        // 3. Reject one_time billing interval (uses a separate payment flow)
        if (billingInterval === BillingIntervalEnum.ONE_TIME) {
            throw new HTTPException(422, {
                message:
                    'One-time plans cannot be used for subscription plan changes. Use the purchase flow instead.'
            });
        }

        // 4. Map the requested billing interval to QZPay's format so we
        // can compare it against the user's current subscription interval.
        // The "same plan AND same interval" check at step 4b below is the
        // only true no-op — a same-plan + different-interval request is a
        // legitimate cycle change flow (SPEC-143 T-143-61).
        const { interval: qzpayInterval, intervalCount: qzpayIntervalCount } =
            mapBillingIntervalToQZPay(billingInterval);

        // 4b. Reject ONLY when both the plan AND the interval+count
        // match. Same-plan-same-interval would result in no observable
        // change, so we surface it as a 400 with a clear message.
        const currentIntervalAtSub = activeSubscription.interval;
        const currentIntervalCountAtSub = activeSubscription.intervalCount ?? 1;
        if (
            activeSubscription.planId === newPlanId &&
            currentIntervalAtSub === qzpayInterval &&
            currentIntervalCountAtSub === qzpayIntervalCount
        ) {
            throw new HTTPException(400, {
                message: 'Cannot change to the same plan with the same billing interval'
            });
        }

        // 5. Get current plan to compare prices
        const currentPlan = await billing.plans.get(activeSubscription.planId);

        if (!currentPlan) {
            throw new HTTPException(404, {
                message: 'Current plan not found'
            });
        }

        // 6. Find the price matching the requested billing interval
        const targetPrice = targetPlan.prices.find(
            (p) =>
                p.billingInterval === qzpayInterval && (p.intervalCount ?? 1) === qzpayIntervalCount
        );

        if (!targetPrice) {
            throw new HTTPException(400, {
                message: `No price found for billing interval '${billingInterval}'`
            });
        }

        // 7. Get current subscription interval and find matching price from current plan
        const currentInterval = activeSubscription.interval;

        const currentPrice = currentPlan.prices.find((p) => p.billingInterval === currentInterval);

        if (!currentPrice) {
            throw new HTTPException(400, {
                message: 'Current plan price not found'
            });
        }

        // 8. Determine if this is an upgrade or downgrade
        // Normalize prices by intervalCount so multi-month plans are comparable
        // e.g., "6 months at $600" -> $100/month vs "1 month at $120" -> $120/month
        const currentIntervalCount = currentPrice.intervalCount ?? 1;
        const targetIntervalCount = targetPrice.intervalCount ?? 1;
        const normalizedCurrentPrice = currentPrice.unitAmount / currentIntervalCount;
        const normalizedTargetPrice = targetPrice.unitAmount / targetIntervalCount;
        const isUpgrade = normalizedTargetPrice > normalizedCurrentPrice;

        // HOS-222 — cross-category rank classification. Price alone is
        // category-blind: an equal-priced `tourist-vip` → `owner-basico` move is
        // a genuine cross-tier UPGRADE, but the price comparison above sees it as
        // a downgrade and the downgrade guard rejects it (HTTP 422). Read each
        // plan's category defensively off metadata (missing/unknown → undefined,
        // which falls back to the price-based classification, so plans without a
        // category behave exactly as before) and detect a move to a HIGHER tier.
        const currentCategory = resolvePlanCategory(currentPlan.metadata);
        const targetCategory = resolvePlanCategory(targetPlan.metadata);
        const isCrossCategoryRankUp =
            currentCategory !== undefined &&
            targetCategory !== undefined &&
            compareCategoryRank(currentCategory, targetCategory) < 0;

        // The change applies IMMEDIATELY when it is either a same-category price
        // upgrade (dearer) OR a cross-category rank-UP (dearer, equal, OR
        // cheaper). Everything else — a same-category cheaper change, or a
        // cross-category rank-DOWN — keeps the existing price logic and falls
        // through to the scheduled-downgrade branch. A rank-DOWN is deliberately
        // NOT forced immediate (owner decision HOS-222 §2).
        const applyImmediately = isUpgrade || isCrossCategoryRankUp;

        // HOS-211 — trialing-upgrade branch. Owner decision (Stripe-style):
        // an upgrade requested WHILE the subscription is still `trialing`
        // must NOT charge the prorated Checkout Pro delta — there is no
        // paid period yet, so nothing to prorate. Instead, apply the new
        // plan now (no charge) and let the trial's first charge (at trial
        // end) bill at the new price. This branch MUST be checked before
        // `isUpgrade` below so a trialing subscription never reaches
        // `initiatePaidPlanUpgrade` / the Checkout Pro. Downgrades during a
        // trial are unaffected — they already fall through to the
        // scheduled-downgrade branch further down, which never charges.
        //
        // HOS-222: `applyImmediately` (not `isUpgrade`) gates this branch so a
        // cross-category rank-UP that is equal-priced or cheaper ALSO applies
        // now during a trial. `applyTrialingPlanUpgrade` only mutates the
        // preapproval's plan/amount (no charge), so it works for a dearer,
        // equal, or cheaper target alike — preserving the current trial with no
        // new trial granted.
        if (applyImmediately && activeSubscription.status === 'trialing') {
            try {
                const trialingUpgradeResult = await applyTrialingPlanUpgrade({
                    billing,
                    subscriptionId: activeSubscription.id,
                    oldPlanId: activeSubscription.planId,
                    newPlanId,
                    newPriceId: targetPrice.id,
                    // Current price id — lets the service tell a genuine
                    // no-op (same plan AND same interval) apart from a
                    // same-plan cycle change (e.g. monthly → annual on the
                    // same tier), which must still apply (WARNING 3).
                    currentPriceId: currentPrice.id,
                    // qzpay stores prices in centavos; MP `auto_recurring.transaction_amount`
                    // expects major units — same conversion `initiatePaidPlanUpgrade`
                    // uses for `targetTransactionAmountMajor`.
                    targetTransactionAmountMajor: targetPrice.unitAmount / 100,
                    mpSubscriptionId: activeSubscription.providerSubscriptionIds?.mercadopago
                });

                apiLogger.info(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: trialingUpgradeResult.subscriptionId,
                        previousPlanId: trialingUpgradeResult.previousPlanId,
                        newPlanId: trialingUpgradeResult.newPlanId,
                        alreadyOnTargetPlan: trialingUpgradeResult.alreadyOnTargetPlan
                    },
                    'Trialing plan upgrade applied — no charge, trial preserved'
                );

                auditLog({
                    auditEvent: AuditEventType.BILLING_MUTATION,
                    actorId: actor.id,
                    action: 'update',
                    resourceType: 'subscription_plan',
                    resourceId: trialingUpgradeResult.subscriptionId
                });

                return {
                    status: 'active' as const,
                    subscriptionId: trialingUpgradeResult.subscriptionId,
                    previousPlanId: trialingUpgradeResult.previousPlanId,
                    newPlanId: trialingUpgradeResult.newPlanId,
                    effectiveAt: new Date().toISOString()
                };
            } catch (trialingUpgradeError) {
                if (trialingUpgradeError instanceof SubscriptionCheckoutError) {
                    throw mapUpgradeErrorToHttp(trialingUpgradeError);
                }
                throw trialingUpgradeError;
            }
        }

        // SPEC-141 D7 / HOS-222 — immediate paid-change branch (ACTIVE sub).
        // Reached when the change applies now rather than being scheduled:
        // either a strictly-dearer upgrade (charge the prorated delta via
        // Checkout Pro) OR an equal-or-cheaper cross-category rank-UP (swap the
        // plan immediately with no charge). Trialing subs never reach here —
        // they returned from the `applyImmediately && trialing` branch above.
        if (applyImmediately) {
            if (qzpayInterval !== 'month' && qzpayInterval !== 'year') {
                // mapBillingIntervalToQZPay only emits 'month'|'year' for the
                // intervals SUPPORTED_INTERVALS allows; this guard exists to
                // narrow the type for the immediate-change services and to
                // surface a clear error if a future caller widens the union.
                throw new HTTPException(422, {
                    message: `Upgrade flow does not support interval '${qzpayInterval}'`
                });
            }

            // Strictly-dearer target: the local subscription is NOT mutated
            // here — the user is redirected to MP to pay the prorated delta,
            // and `confirmPlanUpgrade` (payment-logic.ts) commits the plan
            // change once the payment.updated webhook lands.
            if (isUpgrade) {
                try {
                    const upgradeResult = await initiatePaidPlanUpgrade({
                        customerId: billingCustomerId,
                        currentSubscriptionId: activeSubscription.id,
                        newPlanId,
                        billingInterval: qzpayInterval,
                        intervalCount: qzpayIntervalCount,
                        billing,
                        urls: {
                            // Point at existing locale-prefixed checkout pages so
                            // Astro's locale middleware does not rewrite `/billing/return`
                            // into a 404 surface (Finding #8 from staging smoke
                            // 2026-05-21). Hardcoded `es` matches the default
                            // locale used by `buildPaymentMethodReturnUrl` in
                            // `start-paid.ts`; both should pull the user's
                            // preferred locale when that propagation lands.
                            successUrl: `${env.HOSPEDA_SITE_URL}/es/suscriptores/checkout/success/`,
                            cancelUrl: `${env.HOSPEDA_SITE_URL}/es/suscriptores/checkout/failure/`,
                            // HOS-159: use the shared builder so the ?source_news=webhooks
                            // marker is always present — otherwise the webhook router
                            // drops the delivery as a legacy IPN duplicate.
                            notificationUrl: buildNotificationUrl()
                        },
                        statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
                    });

                    apiLogger.info(
                        {
                            customerId: billingCustomerId,
                            subscriptionId: activeSubscription.id,
                            oldPlanId: activeSubscription.planId,
                            newPlanId,
                            deltaCentavos: upgradeResult.deltaCentavos
                        },
                        'Plan upgrade initiated, awaiting prorated delta payment'
                    );

                    return {
                        status: 'pending_payment' as const,
                        checkoutUrl: upgradeResult.checkoutUrl,
                        localSubscriptionId: upgradeResult.localSubscriptionId,
                        expiresAt: upgradeResult.expiresAt,
                        newPlanId: upgradeResult.newPlanId,
                        deltaCentavos: upgradeResult.deltaCentavos
                    };
                } catch (upgradeError) {
                    if (upgradeError instanceof SubscriptionCheckoutError) {
                        throw mapUpgradeErrorToHttp(upgradeError);
                    }
                    throw upgradeError;
                }
            }

            // HOS-222 — equal-or-cheaper cross-category rank-UP on an ACTIVE
            // (non-trial) subscription. There is no positive prorated delta to
            // charge, so `initiatePaidPlanUpgrade` (which throws NOT_AN_UPGRADE
            // for delta ≤ 0) does not apply. Swap the plan immediately with no
            // charge and no proration credit — the MP preapproval is mutated to
            // the new plan/amount and the local plan is committed at once.
            try {
                const swapResult = await applyImmediatePaidPlanSwap({
                    billing,
                    subscriptionId: activeSubscription.id,
                    oldPlanId: activeSubscription.planId,
                    newPlanId,
                    newPriceId: targetPrice.id,
                    // qzpay stores prices in centavos; MP `transaction_amount`
                    // expects major units — same conversion the other MP update
                    // sites use.
                    targetTransactionAmountMajor: targetPrice.unitAmount / 100,
                    mpSubscriptionId: activeSubscription.providerSubscriptionIds?.mercadopago
                });

                apiLogger.info(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: swapResult.subscriptionId,
                        previousPlanId: swapResult.previousPlanId,
                        newPlanId: swapResult.newPlanId
                    },
                    'Immediate cross-category plan swap applied — no charge (equal or cheaper rank-up)'
                );

                auditLog({
                    auditEvent: AuditEventType.BILLING_MUTATION,
                    actorId: actor.id,
                    action: 'update',
                    resourceType: 'subscription_plan',
                    resourceId: swapResult.subscriptionId
                });

                return {
                    status: 'active' as const,
                    subscriptionId: swapResult.subscriptionId,
                    previousPlanId: swapResult.previousPlanId,
                    newPlanId: swapResult.newPlanId,
                    effectiveAt: new Date().toISOString()
                };
            } catch (swapError) {
                if (swapError instanceof SubscriptionCheckoutError) {
                    throw mapUpgradeErrorToHttp(swapError);
                }
                throw swapError;
            }
        }

        // SPEC-141 D7 — downgrade branch.
        //
        // The legacy synchronous flow (billing.subscriptions.changePlan
        // immediately + addon recalc + MP preapproval propagation) is
        // replaced by writing a `scheduledPlanChange` on the local sub.
        // When `applyAt` (= currentPeriodEnd) is reached, the
        // `apply-scheduled-plan-changes` cron commits the actual
        // changePlan + MP propagate + addon recalc. The user keeps the
        // current plan's entitlements for the rest of the billing cycle
        // — which is the correct behaviour because they already paid
        // for it.
        try {
            const scheduleResult = await scheduleSubscriptionDowngrade({
                currentSubscriptionId: activeSubscription.id,
                newPlanId,
                billingInterval: qzpayInterval as 'month' | 'year',
                intervalCount: qzpayIntervalCount,
                billing,
                requestedBy: actor.id,
                // keepSelections: forwarded as-is from the request body;
                // validated inside scheduleSubscriptionDowngrade and stored
                // in scheduledPlanChange.metadata. For upgrades this code
                // path is never reached (the isUpgrade branch returns early).
                keepSelections
            });

            apiLogger.info(
                {
                    customerId: billingCustomerId,
                    subscriptionId: scheduleResult.subscriptionId,
                    previousPlanId: scheduleResult.previousPlanId,
                    newPlanId: scheduleResult.newPlanId,
                    applyAt: scheduleResult.applyAt,
                    replacedPriorSchedule: scheduleResult.replacedPriorSchedule
                },
                'Plan downgrade scheduled, awaiting apply-scheduled-plan-changes cron'
            );

            // SPEC-064 T-051: Audit log for billing plan change.
            // Logs at request-time (when the user expressed intent) — the
            // cron logs its own audit event when the change actually
            // applies.
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription_plan',
                resourceId: scheduleResult.subscriptionId
            });

            // SPEC-167 T-016: compute the request-time restriction preview
            // (SPEC-203 UI contract). Runs AFTER scheduling (schedule-first
            // order: the preview reflects the scheduled state and scheduling
            // is more important than the informational preview).
            //
            // Soft-fail: preview failure must NOT fail the scheduling — the
            // downgrade is already committed at this point. Log a warn and
            // return the response without the preview field. SPEC-203 UI
            // treats absent `restrictionPreview` as "preview unavailable —
            // defaults will apply at period end".
            //
            // targetPlan.name == the billing catalog slug (mirrors how
            // apply-scheduled-plan-changes.ts resolves it: plan?.name).
            let restrictionPreview: DowngradePreview | undefined;
            try {
                restrictionPreview = await computeDowngradeExcess(
                    { userId: actor.id, targetPlanSlug: targetPlan.name as string },
                    defaultExcessDeps
                );
            } catch (previewErr) {
                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: scheduleResult.subscriptionId,
                        newPlanId: scheduleResult.newPlanId,
                        error: previewErr instanceof Error ? previewErr.message : String(previewErr)
                    },
                    'Downgrade restriction preview unavailable (soft-fail) — schedule succeeded'
                );
            }

            // SPEC-167 T-017: send PLAN_DOWNGRADE_LIMIT_WARNING notifications when
            // the preview shows excess resources. One notification per excess dimension.
            //
            // Rules:
            //   - Only sent when restrictionPreview exists AND hasExcess === true.
            //   - NOT sent when preview soft-failed (restrictionPreview is undefined):
            //     cannot summarise what we don't know — document the absence.
            //   - Sends are SOFT (fire-and-forget): failure → warn log, never blocks
            //     the 200 response the host is waiting for.
            if (restrictionPreview?.hasExcess) {
                // ActorSchema carries optional email/name since SPEC-113 — no cast needed.
                const actorEmail = actor.email;
                const actorName = actor.name;
                if (actorEmail) {
                    const dimensions: Array<{
                        limitKey: string;
                        cap: number;
                        activeCount: number;
                    }> = [];
                    if (restrictionPreview.accommodations.excessCount > 0) {
                        dimensions.push({
                            limitKey: 'accommodations',
                            cap: restrictionPreview.accommodations.cap,
                            activeCount: restrictionPreview.accommodations.activeCount
                        });
                    }
                    if (restrictionPreview.promotions.excessCount > 0) {
                        dimensions.push({
                            limitKey: 'promotions',
                            cap: restrictionPreview.promotions.cap,
                            activeCount: restrictionPreview.promotions.activeCount
                        });
                    }
                    for (const dim of dimensions) {
                        void Promise.resolve(
                            sendNotification({
                                type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                                recipientEmail: actorEmail,
                                recipientName: actorName ?? actorEmail,
                                userId: actor.id,
                                customerId: billingCustomerId,
                                limitKey: dim.limitKey,
                                // oldLimit: exact current-plan cap is not in the preview shape.
                                // Use activeCount as "old plan allowed at least this many" —
                                // template shows it as "Límite anterior"; this is the safest
                                // approximation without an extra billing.plans.get call here.
                                oldLimit: dim.activeCount,
                                newLimit: dim.cap,
                                currentUsage: dim.activeCount,
                                // HOS-231: display name, not the raw slug.
                                planName: planDisplayNameFromPlan(targetPlan)
                            })
                        ).catch((notifErr: unknown) => {
                            // SOFT: notification failure must never block the schedule response.
                            apiLogger.warn(
                                {
                                    customerId: billingCustomerId,
                                    subscriptionId: scheduleResult.subscriptionId,
                                    limitKey: dim.limitKey,
                                    error:
                                        notifErr instanceof Error
                                            ? notifErr.message
                                            : String(notifErr)
                                },
                                'PLAN_DOWNGRADE_LIMIT_WARNING send failed (soft-fail) — schedule succeeded'
                            );
                        });
                    }
                } else {
                    apiLogger.debug(
                        {
                            customerId: billingCustomerId,
                            subscriptionId: scheduleResult.subscriptionId
                        },
                        'PLAN_DOWNGRADE_LIMIT_WARNING skipped — actor has no email in context'
                    );
                }
            }

            return {
                status: 'scheduled' as const,
                subscriptionId: scheduleResult.subscriptionId,
                previousPlanId: scheduleResult.previousPlanId,
                newPlanId: scheduleResult.newPlanId,
                effectiveAt: scheduleResult.applyAt,
                ...(restrictionPreview !== undefined && { restrictionPreview })
            };
        } catch (downgradeError) {
            if (downgradeError instanceof SubscriptionDowngradeError) {
                throw mapDowngradeErrorToHttp(downgradeError);
            }
            throw downgradeError;
        }
    } catch (error) {
        // Re-throw HTTP exceptions as-is
        if (error instanceof HTTPException) {
            throw error;
        }

        // Re-throw ServiceErrors as-is so the global error handler maps them
        // to their correct HTTP status codes (e.g. ALREADY_EXISTS → 409).
        // This must come BEFORE the isBillingProviderError check so that
        // domain-level ServiceErrors (e.g. SPEC-147 cancel-pending gate)
        // are not misidentified as provider errors.
        if (error instanceof ServiceError) {
            throw error;
        }

        // SPEC-149 T-006: detect QZPayProviderSyncError, map to typed ServiceError
        // (so the global handler returns 502/503/504/400 instead of generic 500),
        // and capture to Sentry with billing operation tags (no PII).
        if (isBillingProviderError(error)) {
            const serviceError = mapProviderErrorToServiceError({
                error,
                operation: 'plan_change'
            });

            const details = serviceError.details as
                | { providerStatus?: number; operation?: string }
                | undefined;

            captureBillingError(serviceError, {
                operation: 'plan_change',
                planId: newPlanId,
                providerStatus: details?.providerStatus
            });

            throw serviceError;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                customerId: billingCustomerId,
                newPlanId,
                billingInterval,
                error: errorMessage
            },
            'Failed to change subscription plan'
        );

        throw new HTTPException(500, {
            message: 'Failed to change plan. Please try again or contact support.'
        });
    }
};

/**
 * POST /api/v1/protected/billing/subscriptions/change-plan
 * Change subscription plan (authenticated)
 *
 * This endpoint changes the user's subscription plan with automatic
 * proration handling:
 * - Upgrades: Applied immediately with proration
 * - Downgrades: Scheduled for end of billing period
 */
export const changePlanRoute = createSimpleRoute({
    method: 'post',
    path: '/change-plan',
    summary: 'Change subscription plan',
    description:
        'Change subscription plan with automatic proration. Upgrades apply immediately, downgrades at period end.',
    tags: ['Billing', 'Subscriptions'],
    responseSchema: PlanChangeResponseSchema,
    handler: handlePlanChange
});

/**
 * Plan change routes router
 */
const planChangeRouter = createRouter();

// Enforce X-Idempotency-Key on the mutating POST /change-plan endpoint
// (SPEC-143 T-143-60 / SPEC-194 T-018). Mount BEFORE the route handler so
// the middleware short-circuits missing-key requests with a 400 before the
// handler touches QZPay or MP. Mirrors the wiring in start-paid.ts and
// addons.ts.
planChangeRouter.use(
    '/change-plan',
    idempotencyKeyMiddleware({ operation: 'hospeda.change_plan' })
);

planChangeRouter.route('/', changePlanRoute);

export { planChangeRouter };
