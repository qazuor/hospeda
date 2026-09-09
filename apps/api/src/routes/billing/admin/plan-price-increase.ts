/**
 * Admin manual price-increase route (HOS-191 F6).
 *
 * POST /api/v1/admin/billing/plans/:planId/apply-price-increase
 *
 * Thin HTTP wrapper around
 * {@link applyPriceIncreaseToPlanSubscribers} — see that module's JSDoc for
 * the full mechanism, the empirical MP finding that motivates it, and the
 * per-subscription decision tree (discount/comp guard, idempotent skip,
 * dry-run, retry+backoff).
 *
 * This route is the ONLY invocation surface for the mechanism. There is
 * deliberately no cron: the owner triggers this by hand, first with
 * `dryRun: true` (the default) to review the report, then with
 * `dryRun: false` to apply.
 *
 * @module routes/billing/admin/plan-price-increase
 */

import { PermissionEnum, ProductDomainEnum } from '@repo/schemas';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor.js';
import { applyPriceIncreaseToPlanSubscribers } from '../../../services/billing/apply-price-increase.service.js';
import { SubscriptionCheckoutError } from '../../../services/billing/subscription-checkout-error.js';
import { mapSubscriptionCheckoutErrorToHttp } from '../../../services/billing/subscription-checkout-error-http.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

/**
 * Body schema for the apply-price-increase endpoint.
 */
export const AdminApplyPriceIncreaseBodySchema = z.object({
    /** New `transaction_amount` in ARS **centavos** to apply to every matched subscriber. */
    newAmountCentavos: z
        .number({ message: 'newAmountCentavos must be a number' })
        .int('newAmountCentavos must be an integer (centavos)')
        .positive('newAmountCentavos must be positive'),
    /**
     * When omitted or `true` (the default), no MercadoPago mutation is
     * performed — the response reports what WOULD change.
     */
    dryRun: z.boolean().optional(),
    /** Optional cap on the number of matched subscriptions processed. */
    limit: z.number().int().positive().optional()
});

/** Response schema mirroring `ApplyPriceIncreaseResult`. */
const AdminApplyPriceIncreaseResponseSchema = z.object({
    /**
     * The domain resolved from the PLAN and compared against every matched
     * subscription (HOS-1288). Echoed so a zero-row report still names the
     * vertical it looked at.
     */
    productDomain: z.nativeEnum(ProductDomainEnum),
    matched: z.number().int(),
    updated: z.number().int(),
    skipped: z.number().int(),
    failed: z.number().int(),
    details: z.array(
        z.object({
            subscriptionId: z.string().uuid(),
            mpSubscriptionId: z.string(),
            outcome: z.enum(['updated', 'skipped', 'failed']),
            reason: z.string().optional()
        })
    )
});

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/plans/:planId/apply-price-increase
 *
 * Applies (or previews, when `dryRun` is not explicitly `false`) a new
 * `transaction_amount` to every currently-active/trialing, non-discounted
 * subscriber of the given plan, in the plan's OWN product domain (HOS-1288).
 */
export const adminApplyPriceIncreaseRoute = createAdminRoute({
    method: 'post',
    path: '/{planId}/apply-price-increase',
    summary: 'Apply a manual price increase to a plan’s existing subscribers (admin)',
    description:
        'Mutates the live MercadoPago transaction_amount for every currently-active/trialing, ' +
        'non-discounted subscriber of the given plan, in whichever business vertical the plan ' +
        'belongs to (accommodation, gastronomy, experience, partner or tourist). Manual ' +
        'mechanism only — there is no automatic cron. Defaults to dryRun (no mutation) so the ' +
        'report can be reviewed first. Answers 404 for an unknown plan and 422 for a plan ' +
        'outside those verticals, never a 200 reporting zero rows. Requires BILLING_MANAGE.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        planId: z.string().uuid('Plan ID must be a valid UUID')
    },
    requestBody: AdminApplyPriceIncreaseBodySchema,
    responseSchema: AdminApplyPriceIncreaseResponseSchema,
    successStatusCode: 200,
    options: {
        // Conservative rate limit: this is a manual, batch, money-mutating operation.
        customRateLimit: { requests: 5, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const planId = params.planId as string;
        const { newAmountCentavos, dryRun, limit } = body as {
            newAmountCentavos: number;
            dryRun?: boolean;
            limit?: number;
        };

        apiLogger.info(
            { planId, newAmountCentavos, dryRun, limit, actorId: actor.id },
            'Admin applying manual price increase to plan subscribers'
        );

        // HOS-1288: the service refuses an unknown plan (`PLAN_NOT_FOUND` -> 404)
        // and a plan outside the subscribable verticals (`PLAN_DOMAIN_MISMATCH`
        // -> 422). Both used to be a 200 reporting `matched: 0`. The mapping is
        // the shared one, so this route can never disagree with `/start-paid`
        // about what either code means.
        let result: Awaited<ReturnType<typeof applyPriceIncreaseToPlanSubscribers>>;
        try {
            result = await applyPriceIncreaseToPlanSubscribers({
                planId,
                newAmountCentavos,
                ...(dryRun === undefined ? {} : { dryRun }),
                ...(limit === undefined ? {} : { limit })
            });
        } catch (err) {
            if (err instanceof SubscriptionCheckoutError) {
                apiLogger.warn(
                    { planId, actorId: actor.id, code: err.code, error: err.message },
                    'Admin price increase refused'
                );
                throw mapSubscriptionCheckoutErrorToHttp(err);
            }
            throw err;
        }

        apiLogger.info(
            {
                planId,
                actorId: actor.id,
                productDomain: result.productDomain,
                dryRun: dryRun ?? true,
                matched: result.matched,
                updated: result.updated,
                skipped: result.skipped,
                failed: result.failed
            },
            'Admin price increase run complete'
        );

        return result;
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

/**
 * Admin plan price-increase sub-router.
 *
 * Mounted under `/plans` by `apps/api/src/routes/billing/admin/index.ts`. The
 * full path is therefore:
 *   POST /api/v1/admin/billing/plans/:planId/apply-price-increase
 */
export const adminPlanPriceIncreaseRouter = createRouter();
adminPlanPriceIncreaseRouter.route('/', adminApplyPriceIncreaseRoute);
