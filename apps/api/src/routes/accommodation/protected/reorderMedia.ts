/**
 * PATCH /api/v1/protected/accommodations/:id/media/reorder
 * Reorder photos in an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries) and then applies the new `sortOrder` positions in
 * a single transaction.
 *
 * IMPORTANT: Must be mounted BEFORE `/:id/media/:mediaId` routes so Hono does
 * not resolve the literal path segment "reorder" as a `mediaId` UUID param.
 */

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationMediaListOutputSchema,
    type AccommodationMediaReorderPayload,
    AccommodationMediaReorderPayloadSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
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
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
