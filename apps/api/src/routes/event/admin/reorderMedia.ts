/**
 * PATCH /api/v1/admin/events/:id/media/reorder
 * Reorder photos in a event gallery (HOS-390).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * Gated on EVENT_UPDATE, the broad grant — enforced inside
 * `reorderEventMedia` via `checkEventCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention.
 * That is defensive, not required — Hono resolves the static `reorder` segment
 * ahead of the `{mediaId}` param regardless of insertion order (verified by
 * mutation in `test/routes/post-protected-media.test.ts`).
 */
import {
    EventMediaListOutputSchema,
    type EventMediaReorderPayload,
    EventMediaReorderPayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, reorderEventMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — reorders the gallery photos on an event.
 */
export const adminReorderEventMediaRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder event gallery photos (admin)',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires EVENT_UPDATE.',
    tags: ['Event', 'Media'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: EventMediaReorderPayloadSchema,
    responseSchema: EventMediaListOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (
            eventService as unknown as { model: Parameters<typeof reorderEventMedia>[0] }
        ).model;

        const result = await reorderEventMedia(model, actor, {
            eventId: params.id as string,
            orderedIds: (body as EventMediaReorderPayload).orderedIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
