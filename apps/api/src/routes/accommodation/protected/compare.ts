/**
 * Protected accommodation comparison endpoint
 * Requires authentication + CAN_COMPARE_ACCOMMODATIONS entitlement
 * (SPEC-288 T-003)
 */
import {
    AccommodationComparisonRequestSchema,
    AccommodationComparisonResponseSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { entitlementMiddleware } from '../../../middlewares/entitlement';
import { gateComparator } from '../../../middlewares/tourist-entitlements';
import type { AppMiddleware } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Middleware that reads the `ids` array from the (not-yet-validated) JSON body
 * and stores its length in the Hono context so {@link gateComparator} can check
 * the per-plan `MAX_COMPARE_ITEMS` limit BEFORE OpenAPI body validation runs.
 *
 * Hono caches the parsed body on the raw Request object, so the later
 * `ctx.req.valid('json')` call in the route handler reuses the same parsed
 * value without a second parse or stream-consumption error.
 *
 * On malformed / missing body the count defaults to 0 and we let the OpenAPI
 * validator reject the request with a proper 400 response further down the
 * middleware chain.
 */
const setCompareCount: AppMiddleware = async (c, next) => {
    let count = 0;
    try {
        const raw = await c.req.json();
        if (raw && Array.isArray((raw as { ids?: unknown }).ids)) {
            count = (raw as { ids: unknown[] }).ids.length;
        }
    } catch {
        // Malformed / empty body — leave count at 0; OpenAPI validator will reject it
    }
    c.set('currentCompareItemsCount' as never, count as never);
    await next();
};

/**
 * POST /api/v1/protected/accommodations/compare
 * Side-by-side comparison — Protected endpoint
 *
 * Accepts an ordered list of accommodation UUIDs and returns the matching
 * accommodations in the shared summary shape used by listing cards and the
 * comparison matrix.
 *
 * Gate order (all run BEFORE OpenAPI body validation):
 * 1. `protectedAuthMiddleware` — enforces session / JWT (injected by `createProtectedRoute`)
 * 2. `entitlementMiddleware` — loads the actor's entitlement + limit set into context
 * 3. `setCompareCount` — reads `ids.length` from the raw body and stores it in context
 * 4. `gateComparator` — throws ENTITLEMENT_REQUIRED or LIMIT_REACHED when appropriate
 *
 * Items that the actor cannot view (inactive, plan-restricted, suspended, etc.)
 * are silently excluded from the response rather than causing a 404/403.
 *
 * Returns 200 OK (not 201) because this is a read operation, not a creation.
 */
export const compareAccommodationsRoute = createProtectedRoute({
    method: 'post',
    path: '/compare',
    summary: 'Compare accommodations side by side',
    description:
        'Returns the summary shape for each requested accommodation ordered to match the input IDs. ' +
        'Requires the CAN_COMPARE_ACCOMMODATIONS entitlement (Plus / VIP plans). ' +
        'Non-viewable items are silently omitted. Returns 200 OK.',
    tags: ['Accommodations'],
    // No extra requiredPermissions beyond authentication — the entitlement gate
    // (`gateComparator`) is enforced by the middleware array below. This mirrors
    // the pattern of GET /:id (protectedGetOwnAccommodationByIdRoute) which also
    // carries no permission gate at the route level.
    requestBody: AccommodationComparisonRequestSchema,
    responseSchema: AccommodationComparisonResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as { ids: string[] };

        const result = await accommodationService.compareByIds(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        middlewares: [entitlementMiddleware(), setCompareCount, gateComparator()]
    }
});
