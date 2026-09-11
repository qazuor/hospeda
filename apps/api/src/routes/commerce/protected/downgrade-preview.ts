/**
 * Read-only commerce downgrade preview (HOS-1122).
 *
 * ```
 * GET /api/v1/protected/commerce/subscriptions/{entityType}/downgrade-preview?targetPlan=<slug>
 * ```
 *
 * Which of the owner's listings a cheaper tier would stop covering, and in
 * which order the system would keep them if the owner chose nothing.
 *
 * ## Why a GET, when the change-plan POST already returns the same preview
 *
 * Because the POST returns it AFTER scheduling. `billing/downgrade-preview.ts`
 * exists next door for exactly this reason on the accommodation side, and the
 * order it enables is the point: the owner sees what they are about to lose
 * BEFORE anything is written, picks what to keep, and only then does a single
 * POST carry both the decision and the selection.
 *
 * Without it the flow would have to schedule first and re-POST the selection
 * afterwards. `scheduleSubscriptionDowngrade` does replace a pending schedule,
 * so that would technically work — and it would mean an owner who closed the
 * tab between the two calls had silently scheduled a downgrade they were still
 * deciding on. The preview stays read-only so that state cannot exist.
 *
 * The `commerceRestrictionPreview` on the POST response is not redundant with
 * this: it is the recomputed, post-schedule record, and the apply-time cron
 * recomputes once more. Three reads, none of them cached from another.
 *
 * @module routes/commerce/protected/downgrade-preview
 */

import type { CommerceVertical } from '@repo/billing';
import type { CommerceDowngradePreview } from '@repo/schemas';
import {
    CommerceDowngradePreviewSchema,
    DowngradePreviewQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    CommerceListingCapMissingError,
    computeCommerceDowngradeExcess
} from '../../../services/commerce-downgrade-remediation.service';
import {
    CommercePlanNotConfiguredError,
    CommercePlanNotForVerticalError,
    resolveCommercePlanSlug
} from '../../../services/commerce-plan-resolver';
import { findOwnerVerticalSubscription } from '../../../services/commerce-subscription-attach.service';
import { createRouter } from '../../../utils/create-app';
import { createCRUDRoute } from '../../../utils/route-factory';

/** Mirrors the change-plan route's enum so an unknown vertical is a 400. */
const CommerceVerticalSchema = z.enum(['gastronomy', 'experience']);

/** Path params for the preview endpoint. */
const PreviewParamsSchema = {
    entityType: CommerceVerticalSchema
};

/**
 * Handler for the commerce downgrade preview.
 *
 * Exported standalone so it is unit-testable against a mocked `Context`,
 * matching `handleCommerceChangePlan` next door.
 *
 * Status contract, in the error contract's mandated order:
 *   - 401/403 — auth + `COMMERCE_EDIT_OWN`, by the router's middleware.
 *   - 400 — a slug that is not a tier of this vertical.
 *   - 404 — the caller holds no live subscription for this vertical (same
 *     answer for a caller with no billing customer at all, for the same
 *     reason the change-plan route gives).
 *   - 422 — the target tier declares no listing cap. NOT a zero-excess
 *     preview: an unresolvable cap is the one thing this whole flow may not
 *     paper over, because every layer beneath reads it as *unlimited*.
 *   - 503 — billing unavailable, or the vertical mapping is unusable.
 *
 * @param ctx - The Hono request context.
 * @param params - Path params (`entityType`).
 * @param _body - Unused (GET).
 * @param query - Validated query params (`{ targetPlan }`).
 * @returns A {@link CommerceDowngradePreview}.
 */
export async function handleCommerceDowngradePreview(
    ctx: Context,
    params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
): Promise<CommerceDowngradePreview> {
    const entityType = params.entityType as CommerceVertical;
    const requestedPlanSlug = (query?.targetPlan as string | undefined) ?? '';

    if (!requestedPlanSlug) {
        throw new HTTPException(422, { message: 'targetPlan query parameter is required' });
    }

    // Through the ONE site that may turn a vertical into a plan slug (AC-35),
    // exactly as the change-plan route does. A preview is read-only, but it
    // must not describe the other vertical's tier as if it were reachable.
    let targetSlug: string;
    try {
        targetSlug = resolveCommercePlanSlug({ entityType, requestedPlanSlug });
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
        throw new HTTPException(404, { message: 'No subscription found for this vertical.' });
    }

    const ownerSubscription = await findOwnerVerticalSubscription({
        billing,
        customerId: billingCustomerId,
        vertical: entityType
    });
    if (!ownerSubscription) {
        throw new HTTPException(404, { message: 'No subscription found for this vertical.' });
    }

    try {
        return await computeCommerceDowngradeExcess({
            subscriptionId: ownerSubscription.id,
            vertical: entityType,
            targetPlanSlug: targetSlug
        });
    } catch (error) {
        if (error instanceof CommerceListingCapMissingError) {
            // Surfaced rather than swallowed: answering "nothing is over the
            // cap" for a tier whose cap could not be read is the exact lie the
            // limit engine already tells one layer down.
            throw new HTTPException(422, { message: error.message });
        }
        throw error;
    }
}

/**
 * GET /api/v1/protected/commerce/subscriptions/{entityType}/downgrade-preview
 */
export const protectedCommerceDowngradePreviewRoute = createCRUDRoute({
    method: 'get',
    path: '/subscriptions/{entityType}/downgrade-preview',
    summary: 'Preview which listings a cheaper tier would stop covering',
    description:
        "Read-only. Returns the caller's listings for one commerce vertical ordered by default-keep priority, with the target tier's cap and how many listings exceed it. Nothing is scheduled or mutated; feed the chosen ids back as `keepSelections.listingIds` on the change-plan POST.",
    tags: ['Protected - Commerce', 'Billing'],
    requestParams: PreviewParamsSchema,
    requestQuery: DowngradePreviewQuerySchema.shape,
    responseSchema: CommerceDowngradePreviewSchema,
    handler: handleCommerceDowngradePreview
});

/**
 * Router exposing the preview endpoint.
 *
 * Same permission as the change-plan route it precedes — a preview of what an
 * owner would lose is still their own subscription's data. No idempotency
 * middleware: nothing is written.
 */
const commerceDowngradePreviewRouter = createRouter();

commerceDowngradePreviewRouter.use(
    '/subscriptions/:entityType/downgrade-preview',
    protectedAuthMiddleware([PermissionEnum.COMMERCE_EDIT_OWN])
);

commerceDowngradePreviewRouter.route('/', protectedCommerceDowngradePreviewRoute);

export { commerceDowngradePreviewRouter };
