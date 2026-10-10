/**
 * POST /api/v1/protected/accommodations/:id/occupancy
 *
 * Owner self-service: block a single day (HOS-43 Phase 1, spec section 6).
 *
 * `accommodationId` is intentionally NOT trusted from the request body: the
 * `AccommodationOccupancyCreateInputSchema` (from `@repo/schemas`) requires
 * it as a field, but this route always derives the accommodation from the
 * URL path and overwrites whatever the client sent — mirroring the sibling
 * nested-resource precedent in `accommodation/reviews/protected/create.ts`
 * ("the client never needs to echo them in the body"; here the schema forces
 * the field to be present, so instead of requiring a second round-trip 400
 * on mismatch, the path value simply always wins).
 *
 * No declarative `ownership:` config — MANAGE permission + ownership are
 * enforced inside `addOccupancy`. Calendar operations run without the former
 * `CAN_USE_CALENDAR` plan entitlement during the billing transition.
 * HOS-1352: transitional until V3 (HOS-1357), see PR — former plan entitlement gate removed.
 */

import {
    AccommodationIdSchema,
    AccommodationOccupancyCreateInputSchema,
    AccommodationOccupancySchema,
    VerticalEnum
} from '@repo/schemas';
import { addOccupancy } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * POST /api/v1/protected/accommodations/:id/occupancy
 *
 * Idempotent: re-blocking an already-occupied date returns the existing row
 * (any source) instead of erroring (spec US-1).
 */
export const protectedAddOccupancyRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/occupancy',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' },
    summary: 'Block a single day on the occupancy calendar (owner)',
    description:
        'Creates (or idempotently returns the existing) source=MANUAL occupancy row ' +
        'for a single date. Requires ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a ' +
        "live CAN_USE_CALENDAR entitlement on the accommodation owner's plan.",
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationOccupancyCreateInputSchema,
    responseSchema: AccommodationOccupancySchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed CAN_USE_CALENDAR entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { date, note } = body as { date: string; note?: string | null };

        return await addOccupancy({
            actor,
            input: { accommodationId, date, note }
        });
    },
    options: {}
});
