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
 * ## Upgrades only, and that is a decision rather than an omission
 *
 * A commerce owner may move to a DEARER tier. A move to an equal or cheaper one
 * answers 422.
 *
 * The accommodation downgrade path writes a `scheduledPlanChange` that the
 * `apply-scheduled-plan-changes` cron later commits — and that cron, on any row
 * whose metadata says `plan-change-downgrade`, calls `applyDowngradeRestrictions`
 * with the target plan's slug. That function restricts ACCOMMODATIONS and
 * PROMOTIONS against the caps of the named plan. Handed a commerce plan slug,
 * which declares neither cap, it would be reasoning about an owner's
 * accommodations from a gastronomy tier. Wiring commerce into that path to
 * support a downgrade nobody has yet asked for would be trading a real hazard
 * for a hypothetical convenience.
 *
 * It costs little today and the measurement says so: both gastronomy tiers cap
 * listings at ONE, so the only thing a pro → básico move gives back is the
 * carta — and production held zero commerce subscriptions of any status when
 * this was written. An owner who genuinely wants to step down cancels and
 * re-subscribes, which is the same number of steps and leaves no scheduled
 * state behind.
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
import type { CommerceVertical } from '@repo/billing';
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
import { applyTrialingPlanUpgrade } from '../../../services/billing/trialing-plan-upgrade.service';
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
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
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
 *   - 409 — a cancellation is already pending on the subscription.
 *   - 410 — the target plan has been retired.
 *   - 422 — same tier, or a tier that is not dearer (see the module docblock).
 *   - 503 — billing unavailable, or the vertical mapping is unusable.
 *
 * @param ctx - The Hono request context.
 * @param input.entityType - The vertical whose subscription is being changed.
 * @returns A `PlanChangeResponse`: `pending_payment` for the ordinary paid
 *   upgrade (redirect the owner to `checkoutUrl` to pay the prorated delta), or
 *   `active` when the subscription was still `trialing` and the new tier
 *   applied at once with no charge.
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

    if (targetPrice.unitAmount <= currentPrice.unitAmount) {
        // See the module docblock: a commerce downgrade is refused rather than
        // scheduled, because the cron that would commit it runs accommodation
        // restriction logic against the target plan's slug.
        throw new HTTPException(422, {
            message:
                'Moving to an equal or cheaper commerce plan is not supported. Cancel the current subscription and subscribe to the other plan instead.'
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
        "Moves the caller's own subscription for the given commerce vertical to a dearer tier. Requires COMMERCE_EDIT_OWN. Upgrades only: an equal or cheaper target answers 422. An `active` subscription answers `pending_payment` with a MercadoPago URL for the prorated delta; a `trialing` one applies at once with no charge.",
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
