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

import { PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor.js';
import { applyPriceIncreaseToPlanSubscribers } from '../../../services/billing/apply-price-increase.service.js';
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
 * subscriber of the given plan.
 */
export const adminApplyPriceIncreaseRoute = createAdminRoute({
    method: 'post',
    path: '/{planId}/apply-price-increase',
    summary: 'Apply a manual price increase to a plan’s existing subscribers (admin)',
    description:
        'Mutates the live MercadoPago transaction_amount for every currently-active/trialing, ' +
        'non-discounted subscriber of the given plan. Manual mechanism only — there is no ' +
        'automatic cron. Defaults to dryRun (no mutation) so the report can be reviewed first. ' +
        'Requires BILLING_MANAGE.',
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

        const result = await applyPriceIncreaseToPlanSubscribers({
            planId,
            newAmountCentavos,
            ...(dryRun === undefined ? {} : { dryRun }),
            ...(limit === undefined ? {} : { limit })
        });

        apiLogger.info(
            {
                planId,
                actorId: actor.id,
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
