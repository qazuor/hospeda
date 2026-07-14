/**
 * DELETE /api/v1/protected/accommodations/:id/occupancy/:date
 *
 * Owner self-service: unblock a single day (HOS-43 Phase 1, spec section 6).
 *
 * No declarative `ownership:` config — MANAGE permission + ownership are
 * enforced inside `removeOccupancy`. Only removes a `source=MANUAL` row; a
 * sync-sourced row for the same date is untouched. The `CAN_USE_CALENDAR`
 * entitlement is enforced HERE at the route via `requireEntitlement` — see
 * the module doc in `addOccupancy.ts` for the full rationale.
 */
import { EntitlementKey } from '@repo/billing';
import { AccommodationIdSchema, OccupancyDateSchema } from '@repo/schemas';
import { removeOccupancy } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const RemoveOccupancyResponseSchema = z.object({ deleted: z.boolean() });

/**
 * DELETE /api/v1/protected/accommodations/:id/occupancy/:date
 *
 * `deleted: false` (not a 404) when no MANUAL row existed for the date — a
 * no-op unblock of an already-free (or sync-only-occupied) day is not an error.
 */
export const protectedRemoveOccupancyRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/occupancy/{date}',
    summary: 'Unblock a single day on the occupancy calendar (owner)',
    description:
        'Deletes the source=MANUAL occupancy row for a single date, if any. A ' +
        'sync-sourced row (Phase 2/3) for the same date is left untouched. Requires ' +
        'ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a live CAN_USE_CALENDAR ' +
        "entitlement on the accommodation owner's plan.",
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema,
        date: OccupancyDateSchema
    },
    responseSchema: RemoveOccupancyResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const date = params.date as string;

        return await removeOccupancy({ actor, accommodationId, date });
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_USE_CALENDAR)]
    }
});
