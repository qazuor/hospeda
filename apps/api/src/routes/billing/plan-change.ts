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

import { NotificationType } from '@repo/notifications';
import { BillingIntervalEnum } from '@repo/schemas';
import type { DowngradePreview } from '@repo/schemas';
import { PlanChangeRequestSchema, PlanChangeResponseSchema } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../../lib/billing-provider-error';
import { captureBillingError } from '../../lib/sentry';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../middlewares/idempotency-key';
import {
    SubscriptionCheckoutError,
    initiatePaidPlanUpgrade
} from '../../services/subscription-checkout.service';
import {
    computeDowngradeExcess,
    defaultExcessDeps
} from '../../services/subscription-downgrade-excess.service';
import {
    SubscriptionDowngradeError,
    scheduleSubscriptionDowngrade
} from '../../services/subscription-downgrade.service';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { sendNotification } from '../../utils/notification-helper';
import { type SimpleRouteInterface, createSimpleRoute } from '../../utils/route-factory';

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

        // 2. Get target plan details
        const targetPlan = await billing.plans.get(newPlanId);

        if (!targetPlan) {
            throw new HTTPException(404, {
                message: `Target plan '${newPlanId}' not found`
            });
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

        // SPEC-141 D7 — upgrade branch. The local subscription is NOT
        // mutated here: the user is redirected to MP to pay the prorated
        // delta, and `confirmPlanUpgrade` (payment-logic.ts) commits the
        // plan change once the payment.updated webhook lands. Returning
        // a `pending_payment` response keeps the legacy synchronous
        // downgrade flow below intact.
        if (isUpgrade) {
            if (qzpayInterval !== 'month' && qzpayInterval !== 'year') {
                // mapBillingIntervalToQZPay only emits 'month'|'year' for the
                // intervals SUPPORTED_INTERVALS allows; this guard exists to
                // narrow the type for `initiatePaidPlanUpgrade` and to
                // surface a clear error if a future caller widens the union.
                throw new HTTPException(422, {
                    message: `Upgrade flow does not support interval '${qzpayInterval}'`
                });
            }
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
                        notificationUrl: `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`
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
                const actorEmail = (actor as unknown as { email?: string }).email;
                const actorName = (actor as unknown as { name?: string }).name;
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
                                planName: targetPlan.name as string
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
