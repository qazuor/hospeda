/**
 * PATCH /api/v1/protected/accommodations/:id/occupancy/event
 *
 * Owner self-service: atomically edit a MANUAL occupancy event — move its
 * date range and/or change its text (HOS-175 Phase 3, web event-bar editor).
 *
 * `accommodationId` is derived from the URL path, never trusted from the
 * request body — same rationale as `addOccupancy.ts` / `batchOccupancy.ts`.
 *
 * HOS-1352: transitional until V3 (HOS-1357), see PR — former plan entitlement gate removed.
 */

import {
    AccommodationIdSchema,
    AccommodationOccupancyEventUpdateSchema,
    AccommodationOccupancySchema
} from '@repo/schemas';
import { updateOccupancyEvent } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const UpdateOccupancyEventResponseSchema = z.object({
    occupancy: z.array(AccommodationOccupancySchema)
});

/**
 * PATCH /api/v1/protected/accommodations/:id/occupancy/event
 *
 * Deletes the `MANUAL` rows across `[oldStartDate..oldEndDate]` (inclusive)
 * and idempotently upserts `MANUAL` rows across `[newStartDate..newEndDate]`
 * (inclusive) with `note`, as ONE transaction. Sync-sourced rows on any of
 * those dates are never touched. Returns the post-operation state for the
 * union of both date ranges.
 */
export const protectedUpdateOccupancyEventRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/occupancy/event',
    summary: 'Edit a manual occupancy event (owner)',
    description:
        'Atomically moves a MANUAL occupancy event from [oldStartDate..oldEndDate] to ' +
        '[newStartDate..newEndDate] (both inclusive) and/or changes its note. Deletes the ' +
        'MANUAL rows across the old range, then idempotently upserts MANUAL rows across the ' +
        'new range with note, in a single transaction. Sync-sourced rows (GOOGLE_CALENDAR/' +
        'AIRBNB/BOOKING/OTHER) on any of those dates are never touched. Requires ' +
        'ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a live CAN_USE_CALENDAR entitlement ' +
        "on the accommodation owner's plan.",
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationOccupancyEventUpdateSchema,
    responseSchema: UpdateOccupancyEventResponseSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed CAN_USE_CALENDAR entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { oldStartDate, oldEndDate, newStartDate, newEndDate, note } = body as {
            oldStartDate: string;
            oldEndDate: string;
            newStartDate: string;
            newEndDate: string;
            note?: string | null;
        };

        const occupancy = await updateOccupancyEvent({
            actor,
            accommodationId,
            oldStartDate,
            oldEndDate,
            newStartDate,
            newEndDate,
            note
        });

        return { occupancy };
    },
    options: {}
});
