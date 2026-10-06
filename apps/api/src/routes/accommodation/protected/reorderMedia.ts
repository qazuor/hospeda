/**
 * PATCH /api/v1/protected/accommodations/:id/media/reorder
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    AccommodationIdSchema,
    AccommodationMediaListOutputSchema,
    type AccommodationMediaReorderPayload,
    AccommodationMediaReorderPayloadSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/accommodations/:id/media/reorder
 * Reorder accommodation gallery photos — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.reorderMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route requires `EDIT_ACCOMMODATION_INFO` entitlement — gallery mutation gate.
 *
 * The service rejects any request where `orderedIds` does not exactly match the
 * current set of visible row ids with a `VALIDATION_ERROR`.
 */
export const protectedReorderMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder accommodation gallery photos (owner)',
    description:
        'Set the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires EDIT_ACCOMMODATION_INFO entitlement; the service layer ' +
        'enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationMediaReorderPayloadSchema,
    responseSchema: AccommodationMediaListOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.reorderMedia(actor, {
            accommodationId: params.id as string,
            orderedIds: (body as AccommodationMediaReorderPayload).orderedIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    },
    options: {
        // SPEC-145 T-004 / SPEC-204: gallery mutation requires EDIT_ACCOMMODATION_INFO.
    }
});
