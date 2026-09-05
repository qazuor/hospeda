/**
 * Owner-scoped commerce TIER CHANGE endpoint (HOS-1119).
 *
 * ```
 * POST /api/v1/protected/commerce/subscriptions/{entityType}/change-plan
 * ```
 *
 * The `subscriptions/` prefix keeps this off the `listings/` namespace the
 * other two protected commerce routes live in, and says in the path itself
 * what the subject is: the owner's subscription for a vertical, not a listing.
 *
 * The second half of HOS-1119. The plan selector on the checkout answers "which
 * tier does a NEW commerce owner land on"; this answers "how does an owner who
 * is already paying reach a dearer one". Without it, `gastronomy-pro` — and the
 * structured carta that lives on it — is sellable to new customers only, and
 * every existing básico owner is stranded on the tier they signed up with.
 *
 * ## Why a commerce route rather than reusing `billing/plan-change.ts`
 *
 * Not for lack of trying to. The accommodation handler selects the
 * subscription to act on like this:
 *
 * ```ts
 * subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing')
 * ```
 *
 * — the FIRST live subscription the customer has, with no domain predicate at
 * all. For an accommodation-only customer that is right by construction. For a
 * commerce owner it is a coin flip: an owner who hosts an accommodation AND
 * runs a restaurant has two live subscriptions, and "change my gastronomy tier"
 * would land on whichever qzpay returned first. So the subscription is selected
 * here through `findOwnerVerticalSubscription`, the same domain-scoped finder
 * the commerce checkout uses (SPEC-239 isolation, `subscriptionMatchesDomain`).
 *
 * Everything AFTER that selection is shared: `applyTrialingPlanUpgrade` and
 * `initiatePaidPlanUpgrade` both take a subscription id and are genuinely
 * domain-agnostic. This route deliberately adds no third mechanism.
 *
 * ## Both directions, since HOS-1122
 *
 * A dearer tier is charged and applied now (or at once, if the subscription is
 * still trialing). A cheaper one is SCHEDULED for period end — the owner has
 * paid for the month, and cutting their tier the moment they ask takes back
 * something they already bought. An equal-priced target is still 422: there is
 * no delta to charge and nothing to give back, so it is neither move.
 *
 * This route shipped upgrades-only, and that was a decision rather than an
 * oversight — but the reason has since expired twice over. It was: the
 * `apply-scheduled-plan-changes` cron calls `applyDowngradeRestrictions` on any
 * row whose metadata says `plan-change-downgrade`, and that function restricts
 * ACCOMMODATIONS and PROMOTIONS against the named plan's caps, which a commerce
 * tier does not declare. And it cost little, because both gastronomy tiers
 * capped listings at ONE.
 *
 * HOS-975 ended the second half: the caps are 1/3/5 in gastronomy and 1/5/10 in
 * experiences, so premium → pro on experiences is a real cut from ten listings
 * to five. HOS-1122 ended the first: the cron now dispatches on the target
 * plan's own domain, `applyDowngradeRestrictions` refuses a slug from any other
 * one, and the commerce side has its own remediation — same five steps
 * (compute the excess, let the owner choose, mail the warning, wait for period
 * end, restrict what is left over), one mechanism per platform rather than per
 * vertical.
 *
 * ## Keyed by VERTICAL, not by listing
 *
 * Since HOS-688 a commerce subscription belongs to an OWNER and a VERTICAL, not
 * to a listing — several listings attach to one subscription. A per-listing path
 * would imply a per-listing tier, which is not a thing that exists, and would
 * make the same request mean different things depending on which of the owner's
 * listings they happened to be looking at.
 *
 * @module routes/commerce/protected/change-plan
 */
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { type CommerceVertical, LIMIT_KEY_BY_COMMERCE_VERTICAL } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import type { CommerceDowngradePreview, CommerceKeepSelections } from '@repo/schemas';
import {
    CommercePlanChangeRequestSchema,
    PermissionEnum,
    PlanChangeResponseSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { getQZPayBilling } from '../../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../../middlewares/idempotency-key';
import { planDisplayNameFromPlan } from '../../../services/billing/plan-change-reason';
import { applyTrialingPlanUpgrade } from '../../../services/billing/trialing-plan-upgrade.service';
import { computeCommerceDowngradeExcess } from '../../../services/commerce-downgrade-remediation.service';
import {
    CommercePlanNotConfiguredError,
    CommercePlanNotForVerticalError,
    resolveCommercePlanSlug
} from '../../../services/commerce-plan-resolver';
import { findOwnerVerticalSubscription } from '../../../services/commerce-subscription-attach.service';
import {
    findMonthlyPrice,
    initiatePaidPlanUpgrade,
    resolvePlanBySlug,
    SubscriptionCheckoutError
} from '../../../services/subscription-checkout.service';
import {
    SubscriptionDowngradeError,
    scheduleSubscriptionDowngrade
} from '../../../services/subscription-downgrade.service';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { createCRUDRoute } from '../../../utils/route-factory';
import { buildNotificationUrl } from '../../billing/checkout-return-urls';

/**
 * Supported commerce verticals. Mirrors the checkout route's enum so an unknown
 * vertical is rejected at the schema boundary (400) rather than reaching the
 * handler.
 */
const CommerceVerticalSchema = z.enum(['gastronomy', 'experience']);

/** Path params for the tier-change endpoint. */
const ChangePlanParamsSchema = {
    entityType: CommerceVerticalSchema
};

/**
 * Maps a `SubscriptionCheckoutError` from the upgrade services onto an
 * `HTTPException`.
 *
 * A near-copy of `billing/plan-change.ts`'s `mapUpgradeErrorToHttp` rather than
 * an import of it: that one is module-private there, and the two flows do not
 * share every code (commerce never reaches the annual or promo branches). The
 * statuses that DO overlap are kept identical on purpose — a 502 for a
 * MercadoPago rejection that changed nothing, a 500 for one that left local and
 * MP disagreeing — so the same failure does not read differently depending on
 * which product the caller bought.
 *
 * @param err - The domain error thrown by the upgrade service.
 * @returns The HTTP exception to throw.
 */
function mapCommerceUpgradeErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MATCHING_PRICE':
        case 'CUSTOMER_NOT_FOUND':
        case 'SUBSCRIPTION_NOT_FOUND':
            return new HTTPException(404, { message: err.message });
        case 'SAME_PLAN':
        case 'NOT_AN_UPGRADE':
            return new HTTPException(422, { message: err.message });
        case 'MISSING_PROVIDER_SUBSCRIPTION_ID':
        case 'MP_PREAPPROVAL_MUTATION_FAILED':
            // The provider refused and nothing was mutated — retryable.
            return new HTTPException(502, { message: err.message });
        case 'MISSING_INIT_POINT':
        case 'TRIALING_UPGRADE_LOCAL_APPLY_FAILED':
            return new HTTPException(500, { message: err.message });
        default:
            return new HTTPException(500, { message: err.message });
    }
}

/**
 * Maps a `SubscriptionDowngradeError` onto an `HTTPException`.
 *
 * The three codes reachable from here are guard failures on state the handler
 * has already checked (same plan, no price, not cheaper), so they mean the
 * subscription or the catalogue moved between the handler's read and the
 * service's — a 409 rather than a 422, because retrying is the right response.
 * `SUBSCRIPTION_NOT_FOUND` keeps its 404.
 *
 * @param err - The domain error thrown by the schedule service.
 * @returns The HTTP exception to throw.
 */
function mapCommerceDowngradeErrorToHttp(err: SubscriptionDowngradeError): HTTPException {
    if (err.code === 'SUBSCRIPTION_NOT_FOUND') {
        return new HTTPException(404, { message: err.message });
    }
    return new HTTPException(409, { message: err.message });
}

/**
 * Schedules a commerce tier DOWNGRADE for the end of the current period, and
 * tells the owner what it will cost them (HOS-1122).
 *
 * Three steps, in this order and for these reasons:
 *
 * 1. **Schedule.** `scheduleSubscriptionDowngrade` is genuinely
 *    domain-agnostic — it compares prices, writes qzpay's `scheduledPlanChange`
 *    and persists the keep selections — so commerce uses it unchanged. This
 *    happens FIRST: the schedule is what the owner asked for, and neither of
 *    the two steps below may prevent it.
 * 2. **Preview, soft-fail.** Which listings the new cap stops covering. Absent
 *    from the response when it could not be computed, never zeroed — a
 *    `excessCount: 0` that means "we did not look" is the exact shape this
 *    whole flow exists to avoid.
 * 3. **Warn by email, soft-fail.** Only when there IS an excess and only when
 *    the actor carries an email. Fire-and-forget: a mail failure must not turn
 *    a completed schedule into an error the owner sees.
 *
 * The apply-time cron recomputes the excess fresh, so the preview is advice
 * rather than a contract — the owner may add or delete listings before period
 * end.
 *
 * @returns The `scheduled` variant of the plan-change response.
 */
async function scheduleCommerceDowngrade(input: {
    readonly billing: QZPayBilling;
    readonly actorId: string;
    readonly actorEmail?: string | undefined;
    readonly actorName?: string | undefined;
    readonly vertical: CommerceVertical;
    readonly subscriptionId: string;
    readonly previousPlanId: string;
    readonly targetPlanId: string;
    readonly targetPlanSlug: string;
    readonly targetPlanDisplayName: string;
    readonly keepSelections?: CommerceKeepSelections | undefined;
}): Promise<unknown> {
    const {
        billing,
        actorId,
        actorEmail,
        actorName,
        vertical,
        subscriptionId,
        targetPlanId,
        targetPlanSlug,
        targetPlanDisplayName,
        keepSelections
    } = input;

    let scheduleResult: Awaited<ReturnType<typeof scheduleSubscriptionDowngrade>>;
    try {
        scheduleResult = await scheduleSubscriptionDowngrade({
            currentSubscriptionId: subscriptionId,
            newPlanId: targetPlanId,
            // Every commerce tier is monthly and only monthly — see the request
            // schema's note on why there is no interval field to forward.
            billingInterval: 'month',
            intervalCount: 1,
            billing,
            requestedBy: actorId,
            ...(keepSelections === undefined ? {} : { keepSelections })
        });
    } catch (error) {
        if (error instanceof SubscriptionDowngradeError) {
            throw mapCommerceDowngradeErrorToHttp(error);
        }
        throw error;
    }

    apiLogger.info(
        {
            vertical,
            subscriptionId: scheduleResult.subscriptionId,
            previousPlanId: scheduleResult.previousPlanId,
            newPlanId: scheduleResult.newPlanId,
            applyAt: scheduleResult.applyAt,
            replacedPriorSchedule: scheduleResult.replacedPriorSchedule
        },
        'Commerce tier downgrade scheduled, awaiting apply-scheduled-plan-changes cron'
    );

    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'update',
        resourceType: 'subscription_plan',
        resourceId: scheduleResult.subscriptionId
    });

    let restrictionPreview: CommerceDowngradePreview | undefined;
    try {
        restrictionPreview = await computeCommerceDowngradeExcess({
            subscriptionId,
            vertical,
            targetPlanSlug
        });
    } catch (previewErr) {
        apiLogger.warn(
            {
                vertical,
                subscriptionId,
                targetPlanSlug,
                error: previewErr instanceof Error ? previewErr.message : String(previewErr)
            },
            'Commerce downgrade preview unavailable (soft-fail) — schedule succeeded'
        );
    }

    if (restrictionPreview?.hasExcess) {
        if (actorEmail) {
            void Promise.resolve(
                sendNotification({
                    type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                    recipientEmail: actorEmail,
                    recipientName: actorName ?? actorEmail,
                    userId: actorId,
                    limitKey: LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical],
                    // `oldLimit` is reported as the owner's CURRENT usage, the
                    // same approximation the accommodation route makes: the
                    // template renders it as "límite anterior", and the count
                    // they are actually losing listings from is the honest
                    // number to show without a second plan lookup here.
                    oldLimit: restrictionPreview.activeCount,
                    newLimit: restrictionPreview.cap,
                    currentUsage: restrictionPreview.activeCount,
                    planName: targetPlanDisplayName
                })
            ).catch((notifErr: unknown) => {
                apiLogger.warn(
                    {
                        vertical,
                        subscriptionId,
                        error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                    },
                    'PLAN_DOWNGRADE_LIMIT_WARNING send failed (soft-fail) — schedule succeeded'
                );
            });
        } else {
            apiLogger.debug(
                { vertical, subscriptionId },
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
        ...(restrictionPreview !== undefined && {
            commerceRestrictionPreview: restrictionPreview
        })
    };
}

/**
 * Handler for the commerce tier change. Exported standalone (mirrors
 * `handleCommerceStartSubscription`) so it is unit-testable against a mocked
 * `Context` without booting the full Hono app.
 *
 * Status contract, in the error contract's mandated order:
 *   - 401/403 — auth + `COMMERCE_EDIT_OWN`, by the router's middleware.
 *   - 400 — malformed body, or a slug that is not a tier of this vertical.
 *   - 404 — the caller holds no live subscription for this vertical, or the
 *     target plan does not exist. Note this is also the answer for a caller
 *     with no billing customer at all: they cannot own a subscription, and
 *     saying "no billing account" instead would describe their account rather
 *     than the resource they asked about.
 *   - 409 — a cancellation is already pending on the subscription, or the
 *     subscription moved between this handler's read and the schedule service's.
 *   - 410 — the target plan has been retired.
 *   - 422 — the tier the subscription is already on, or one priced identically
 *     to it (see the module docblock).
 *   - 503 — billing unavailable, or the vertical mapping is unusable.
 *
 * @param ctx - The Hono request context.
 * @param input.entityType - The vertical whose subscription is being changed.
 * @returns A `PlanChangeResponse`: `pending_payment` for the ordinary paid
 *   upgrade (redirect the owner to `checkoutUrl` to pay the prorated delta),
 *   `active` when the subscription was still `trialing` and the new tier
 *   applied at once with no charge, or `scheduled` for a downgrade, which takes
 *   effect at period end and carries a `commerceRestrictionPreview` of the
 *   listings the smaller cap will stop covering.
 */
export async function handleCommerceChangePlan(
    ctx: Context,
    input: { entityType: CommerceVertical }
): Promise<unknown> {
    const { entityType } = input;
    const actor = getActorFromContext(ctx);

    // ── Body (400) ─────────────────────────────────────────────────────────
    const raw: unknown = await ctx.req.json().catch(() => undefined);
    const parsed = CommercePlanChangeRequestSchema.safeParse(raw);
    if (!parsed.success) {
        throw new HTTPException(400, { message: 'Invalid planSlug in request body.' });
    }

    // ── Target tier — resolved through the ONE site that may turn a vertical
    // into a plan slug (AC-35). This is what stops a gastronomy owner naming
    // an experience plan and landing on the other vertical's MercadoPago
    // preapproval plan. ────────────────────────────────────────────────────
    let targetSlug: string;
    try {
        targetSlug = resolveCommercePlanSlug({
            entityType,
            requestedPlanSlug: parsed.data.planSlug
        });
    } catch (error) {
        if (error instanceof CommercePlanNotForVerticalError) {
            throw new HTTPException(400, { message: error.message });
        }
        if (error instanceof CommercePlanNotConfiguredError) {
            throw new HTTPException(503, { message: error.message });
        }
        throw error;
    }

    const billing = getQZPayBilling();
    if (!billing) {
        throw new HTTPException(503, { message: 'Billing service is not available' });
    }

    const billingCustomerId = ctx.get('billingCustomerId');
    if (!billingCustomerId) {
        // No customer means no subscription. Answered as the same 404 a
        // customer with no subscription for this vertical gets, rather than a
        // 400 describing the caller's billing account.
        throw new HTTPException(404, {
            message: 'No subscription found for this vertical.'
        });
    }

    // ── The owner's subscription FOR THIS VERTICAL (404) ───────────────────
    //
    // Through the canonical domain-scoped finder, never a bare "first live
    // subscription" scan — see the module docblock on why that distinction is
    // the reason this route exists at all.
    const ownerSubscription = await findOwnerVerticalSubscription({
        billing,
        customerId: billingCustomerId,
        vertical: entityType
    });
    if (!ownerSubscription) {
        throw new HTTPException(404, {
            message: 'No subscription found for this vertical.'
        });
    }

    const subscription = await billing.subscriptions.get(ownerSubscription.id);
    if (!subscription) {
        throw new HTTPException(404, {
            message: 'No subscription found for this vertical.'
        });
    }

    // ── The cancel wins (409) ──────────────────────────────────────────────
    // Same guard the accommodation route carries (SPEC-147 Q7): a soft-cancel
    // and a tier change colliding leaves an ambiguous state, so the pending
    // cancellation has to finalise first.
    if (subscription.cancelAtPeriodEnd) {
        throw new HTTPException(409, {
            message:
                'This subscription is scheduled to cancel at period end. Cannot change plan while a cancellation is pending.'
        });
    }

    // ── Target plan row (404 / 410) ────────────────────────────────────────
    const targetPlan = await resolvePlanBySlug(billing, targetSlug);
    if (!targetPlan) {
        throw new HTTPException(404, { message: `Target plan '${targetSlug}' not found` });
    }
    // The catalogue decides which slugs BELONG to a vertical; the database
    // decides which of them are currently sellable. A retired tier is a 410,
    // matching the accommodation route's PLAN_DISABLED answer.
    if (targetPlan.active === false) {
        throw new HTTPException(410, {
            message: 'This plan is no longer available. Please choose an active plan.'
        });
    }

    if (subscription.planId === targetPlan.id) {
        throw new HTTPException(422, {
            message: 'This subscription is already on that plan.'
        });
    }

    const currentPlan = await billing.plans.get(subscription.planId);
    if (!currentPlan) {
        throw new HTTPException(404, { message: 'Current plan not found' });
    }

    // ── Dearer-only (422) ──────────────────────────────────────────────────
    //
    // Compared on the MONTHLY price because every commerce tier is monthly and
    // only monthly (`commerceVerticalTier` hardcodes `annualPriceArs: null` for
    // all six), so there is no interval to normalise across and no cross-
    // category rank to consult — commerce plans all carry `category: 'owner'`,
    // which is a type-satisfying placeholder rather than a tier signal.
    const currentPrice = findMonthlyPrice(currentPlan.prices);
    const targetPrice = findMonthlyPrice(targetPlan.prices);
    if (!currentPrice) {
        throw new HTTPException(404, { message: 'Current plan has no active monthly price' });
    }
    if (!targetPrice) {
        throw new HTTPException(404, { message: 'Target plan has no active monthly price' });
    }

    if (targetPrice.unitAmount === currentPrice.unitAmount) {
        // Neither direction. There is no delta to charge and no cap to give
        // back, so both branches below would be a no-op dressed as a change.
        throw new HTTPException(422, {
            message: 'The target plan costs the same as the current one. Choose a different tier.'
        });
    }

    // ── Cheaper: schedule for period end (HOS-1122) ────────────────────────
    if (targetPrice.unitAmount < currentPrice.unitAmount) {
        return await scheduleCommerceDowngrade({
            billing,
            actorId: actor.id,
            actorEmail: actor.email,
            actorName: actor.name,
            vertical: entityType,
            subscriptionId: subscription.id,
            previousPlanId: subscription.planId,
            targetPlanId: targetPlan.id,
            targetPlanSlug: targetSlug,
            targetPlanDisplayName: planDisplayNameFromPlan(targetPlan),
            keepSelections: parsed.data.keepSelections
        });
    }

    // ── Trialing: apply now, charge nothing (HOS-211's rule, unchanged) ────
    //
    // There is no paid period yet, so there is nothing to prorate. The
    // preapproval's amount is mutated to the new tier's price and the trial is
    // preserved; the first charge, when it lands, lands at the new price.
    if (subscription.status === 'trialing') {
        try {
            const result = await applyTrialingPlanUpgrade({
                billing,
                subscriptionId: subscription.id,
                oldPlanId: subscription.planId,
                newPlanId: targetPlan.id,
                newPriceId: targetPrice.id,
                currentPriceId: currentPrice.id,
                // qzpay stores centavos; MP's `transaction_amount` is major units.
                targetTransactionAmountMajor: targetPrice.unitAmount / 100,
                mpSubscriptionId: subscription.providerSubscriptionIds?.mercadopago
            });

            apiLogger.info(
                {
                    vertical: entityType,
                    subscriptionId: result.subscriptionId,
                    previousPlanId: result.previousPlanId,
                    newPlanId: result.newPlanId
                },
                'Commerce tier upgrade applied during trial — no charge, trial preserved'
            );

            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription_plan',
                resourceId: result.subscriptionId
            });

            return {
                status: 'active' as const,
                subscriptionId: result.subscriptionId,
                previousPlanId: result.previousPlanId,
                newPlanId: result.newPlanId,
                effectiveAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof SubscriptionCheckoutError) {
                throw mapCommerceUpgradeErrorToHttp(error);
            }
            throw error;
        }
    }

    // ── Active: pay the prorated delta first ───────────────────────────────
    //
    // The local subscription is NOT mutated here. The owner is redirected to
    // MercadoPago to pay the delta, and `confirmPlanUpgrade` (the webhook
    // layer) commits the tier change when `payment.updated` lands.
    try {
        const upgrade = await initiatePaidPlanUpgrade({
            customerId: billingCustomerId,
            currentSubscriptionId: subscription.id,
            newPlanId: targetPlan.id,
            billingInterval: 'month',
            intervalCount: 1,
            billing,
            urls: {
                successUrl: `${env.HOSPEDA_SITE_URL}/es/suscriptores/checkout/success/`,
                cancelUrl: `${env.HOSPEDA_SITE_URL}/es/suscriptores/checkout/failure/`,
                // The shared builder, so the `?source_news=webhooks` marker is
                // present — without it the webhook router drops the delivery as
                // a legacy IPN duplicate (HOS-159).
                notificationUrl: buildNotificationUrl()
            },
            statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
        });

        apiLogger.info(
            {
                vertical: entityType,
                customerId: billingCustomerId,
                subscriptionId: subscription.id,
                oldPlanId: subscription.planId,
                newPlanId: targetPlan.id,
                deltaCentavos: upgrade.deltaCentavos
            },
            'Commerce tier upgrade initiated, awaiting prorated delta payment'
        );

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'subscription_plan',
            resourceId: subscription.id
        });

        return {
            status: 'pending_payment' as const,
            checkoutUrl: upgrade.checkoutUrl,
            localSubscriptionId: upgrade.localSubscriptionId,
            expiresAt: upgrade.expiresAt,
            newPlanId: upgrade.newPlanId,
            deltaCentavos: upgrade.deltaCentavos
        };
    } catch (error) {
        if (error instanceof SubscriptionCheckoutError) {
            throw mapCommerceUpgradeErrorToHttp(error);
        }
        throw error;
    }
}

/**
 * POST /api/v1/protected/commerce/{entityType}/change-plan
 *
 * Built with the bare `createCRUDRoute` and wrapped by the router below, which
 * applies auth + `COMMERCE_EDIT_OWN` BEFORE the idempotency middleware — the
 * same ordering, and for the same reason, as the checkout route next door.
 */
export const protectedCommerceChangePlanRoute = createCRUDRoute({
    method: 'post',
    path: '/subscriptions/{entityType}/change-plan',
    summary: "Change the tier of the caller's commerce subscription for one vertical",
    description:
        "Moves the caller's own subscription for the given commerce vertical to another tier. Requires COMMERCE_EDIT_OWN. A dearer target on an `active` subscription answers `pending_payment` with a MercadoPago URL for the prorated delta; on a `trialing` one it applies at once with no charge. A cheaper target answers `scheduled`: it takes effect at period end and the response carries a `commerceRestrictionPreview` of the listings the smaller cap will stop covering, with an optional `keepSelections.listingIds` in the request choosing which to keep. An equally priced target answers 422.",
    tags: ['Protected - Commerce', 'Billing'],
    requestParams: ChangePlanParamsSchema,
    // Same reasoning as the checkout route: the body is read and validated by
    // hand so a malformed one produces this route's own 400 rather than the
    // factory's, and so the two commerce POSTs stay shaped alike.
    responseSchema: PlanChangeResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleCommerceChangePlan(ctx, {
            entityType: params.entityType as CommerceVertical
        })
});

/**
 * Router exposing the commerce tier-change endpoint.
 *
 * Middleware order is load-bearing and mirrors `start-subscription.ts`:
 * `auth + COMMERCE_EDIT_OWN` first, `X-Idempotency-Key` second. Reversing them
 * would let an unauthorized caller trigger an idempotency-table write before
 * ever being rejected.
 */
const commerceChangePlanRouter = createRouter();

const CHANGE_PLAN_PATH = '/subscriptions/:entityType/change-plan';

commerceChangePlanRouter.use(
    CHANGE_PLAN_PATH,
    protectedAuthMiddleware([PermissionEnum.COMMERCE_EDIT_OWN])
);

commerceChangePlanRouter.use(
    CHANGE_PLAN_PATH,
    idempotencyKeyMiddleware({ operation: 'hospeda.commerce_change_plan' })
);

commerceChangePlanRouter.route('/', protectedCommerceChangePlanRoute);

export { commerceChangePlanRouter };
