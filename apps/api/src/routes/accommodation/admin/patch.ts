/**
 * Admin patch accommodation endpoint
 * Allows admins to partially update any accommodation
 */
import {
    AccommodationAdminSchema,
    AccommodationIdSchema,
    AccommodationPatchInputSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps(getQZPayBilling)
);

/**
 * PATCH /api/v1/admin/accommodations/:id
 * Partial update accommodation - Admin endpoint
 *
 * See `adminUpdateAccommodationRoute` for the permission model rationale
 * (SPEC-143 Finding #14). Route only enforces admin-panel access; the
 * service-layer `checkCanUpdate` enforces ACCOMMODATION_UPDATE_ANY or
 * (ACCOMMODATION_UPDATE_OWN + ownership).
 */
export const adminPatchAccommodationRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update accommodation (admin)',
    description:
        'Updates specific fields of an accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    requestBody: AccommodationPatchInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await accommodationService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
