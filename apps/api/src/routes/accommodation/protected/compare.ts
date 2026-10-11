/**
 * Protected accommodation comparison endpoint
 */
import {
    AccommodationComparisonRequestSchema,
    AccommodationComparisonResponseSchema,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/compare
 * Side-by-side comparison — Protected endpoint
 *
 * Accepts an ordered list of accommodation UUIDs and returns the matching
 * accommodations in the shared summary shape used by listing cards and the
 * comparison matrix.
 *
 * Gate order: authentication and validated request shape run before the plan
 * capability and batch-size limit; the comparison service runs last.
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
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['can_compare_accommodations'],
            limit: async () => ({ key: 'max_compare_items', requested: input.ids.length })
        });

        const result = await accommodationService.compareByIds(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
