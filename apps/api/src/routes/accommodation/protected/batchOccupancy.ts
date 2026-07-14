/**
 * PATCH /api/v1/protected/accommodations/:id/occupancy/batch
 *
 * Owner self-service: batch block/unblock a set of days (HOS-43 Phase 1,
 * spec section 6).
 *
 * `accommodationId` is derived from the URL path, never trusted from the
 * request body — same rationale as `addOccupancy.ts`.
 *
 * No declarative `ownership:` config — MANAGE permission + ownership are
 * enforced inside `batchToggleOccupancy`. The `CAN_USE_CALENDAR` entitlement
 * is enforced HERE at the route via `requireEntitlement` — see the module
 * doc in `addOccupancy.ts` for the full rationale (route-level gate reads
 * the same `loadEntitlements` path the frontend trusts, unlike the removed
 * service-level `resolveOwnerCanUseCalendar` check).
 */
import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationOccupancyBatchInputSchema,
    AccommodationOccupancySchema
} from '@repo/schemas';
import { batchToggleOccupancy } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const BatchOccupancyResponseSchema = z.object({
    occupancy: z.array(AccommodationOccupancySchema)
});

/**
 * PATCH /api/v1/protected/accommodations/:id/occupancy/batch
 *
 * `isBlocked: true` idempotently upserts MANUAL rows for every date;
 * `isBlocked: false` deletes only the MANUAL rows for those dates (sync rows
 * are never removable here). Returns the post-operation state for exactly
 * the requested dates.
 */
export const protectedBatchOccupancyRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/occupancy/batch',
    summary: 'Batch block/unblock days on the occupancy calendar (owner)',
    description:
        'Toggles a set of dates blocked/unblocked. isBlocked=true idempotently upserts ' +
        'source=MANUAL rows; isBlocked=false deletes only the MANUAL rows for those dates. ' +
        'Requires ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a live CAN_USE_CALENDAR ' +
        "entitlement on the accommodation owner's plan.",
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationOccupancyBatchInputSchema,
    responseSchema: BatchOccupancyResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { dates, isBlocked, note } = body as {
            dates: string[];
            isBlocked: boolean;
            note?: string | null;
        };

        const occupancy = await batchToggleOccupancy({
            actor,
            input: { accommodationId, dates, isBlocked, note }
        });

        return { occupancy };
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_USE_CALENDAR)]
    }
});
