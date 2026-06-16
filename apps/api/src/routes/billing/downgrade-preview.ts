/**
 * Downgrade Preview Route
 *
 * Read-only informational endpoint that returns a structured preview of the
 * resources that would be restricted if the authenticated owner downgrades to
 * a given plan. No mutation is performed — the response is purely descriptive.
 *
 * Routes:
 * - GET /api/v1/protected/billing/subscriptions/downgrade-preview
 *
 * @remarks
 * **SPEC-203 UI contract:** The `DowngradePreview` shape returned here is the
 * canonical preview object consumed by the self-serve plan management UI.
 * The handler delegates entirely to `computeDowngradeExcess` — no duplication
 * of its logic lives in this file.
 *
 * **No entitlement gate:** This endpoint is informational (read-only preview).
 * Entitlement checks are the responsibility of the mutating change-plan flow.
 *
 * @module routes/billing/downgrade-preview
 */

import { DowngradePreviewQuerySchema, DowngradePreviewSchema } from '@repo/schemas';
import type { DowngradePreview } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../middlewares/actor';
import {
    PlanCatalogMissError,
    computeDowngradeExcess,
    defaultExcessDeps
} from '../../services/subscription-downgrade-excess.service';
import { createRouter } from '../../utils/create-app';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Handler for the downgrade preview endpoint.
 *
 * Extracted from the route definition for unit-testability, following the
 * same pattern as `handlePlanChange` and `handleGetSubscriptionStatus`.
 *
 * @param c - Hono context (must carry an authenticated actor).
 * @param _params - Unused URL path params (none for this route).
 * @param _body - Unused request body (GET endpoint).
 * @param query - Validated query params ({ targetPlan: string }).
 * @returns A {@link DowngradePreview} describing the excess per dimension.
 * @throws HTTPException 401 when no authenticated actor is present.
 * @throws HTTPException 422 when `targetPlan` does not match any catalog plan.
 */
export const handleDowngradePreview = async (
    c: Context,
    _params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
): Promise<DowngradePreview> => {
    // getActorFromContext throws 401 when the actor is absent or is a guest.
    const actor = getActorFromContext(c);

    const targetPlanSlug = (query?.targetPlan as string | undefined) ?? '';

    // Defensive: the route factory validates via requestQuery / DowngradePreviewQuerySchema
    // before calling the handler, so this path is only reached if the factory is bypassed
    // (e.g., unit tests that call the handler directly without query validation).
    if (!targetPlanSlug) {
        throw new HTTPException(422, {
            message: 'targetPlan query parameter is required'
        });
    }

    try {
        return await computeDowngradeExcess(
            { userId: actor.id, targetPlanSlug },
            defaultExcessDeps
        );
    } catch (err) {
        if (err instanceof PlanCatalogMissError) {
            throw new HTTPException(422, {
                message: `Unknown plan slug '${targetPlanSlug}'. Check the billing catalog for valid slugs.`
            });
        }
        throw err;
    }
};

/**
 * GET /api/v1/protected/billing/subscriptions/downgrade-preview
 *
 * Returns an informational preview of the resources that would be excess
 * under the target plan — no subscription is mutated by this call.
 *
 * Access control:
 * - Requires authentication (handled by the parent billing router).
 * - The actor is always resolved from the session; `targetPlan` comes from
 *   the query string (never from the request body or a user-supplied id).
 */
export const getDowngradePreviewRoute = createCRUDRoute({
    method: 'get',
    path: '/downgrade-preview',
    summary: 'Preview downgrade restrictions',
    description:
        'Returns a structured preview of the resources (accommodations, promotions, photos) that would be restricted if the authenticated owner downgrades to the given plan. Read-only; no entitlement gate.',
    tags: ['Billing', 'Subscriptions'],
    requestQuery: DowngradePreviewQuerySchema.shape,
    responseSchema: DowngradePreviewSchema,
    handler: handleDowngradePreview
});

/**
 * Router that exposes the downgrade-preview endpoint.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside the
 * plan-change and subscription-status routers.
 */
const downgradePreviewRouter = createRouter();

downgradePreviewRouter.route('/', getDowngradePreviewRoute);

export { downgradePreviewRouter };
