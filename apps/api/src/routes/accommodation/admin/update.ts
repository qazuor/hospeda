/**
 * Admin update accommodation endpoint
 * Allows admins to update any accommodation
 */
import {
    AccommodationAdminSchema,
    AccommodationIdSchema,
    type AccommodationUpdateInput,
    AccommodationUpdateInputSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps(getQZPayBilling)
);

/**
 * PUT /api/v1/admin/accommodations/:id
 * Update accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14):
 * - Route requires only admin-panel access (ACCESS_PANEL_ADMIN or ACCESS_API_ADMIN
 *   via `createAdminRoute`'s level check). HOST users have ACCESS_PANEL_ADMIN
 *   and reach this endpoint when editing their own accommodations from the
 *   admin UI ("publicar" onboarding redirects HOSTs here).
 * - Entity-specific permission is enforced at the SERVICE layer:
 *   `accommodationService.update` calls `checkCanUpdate(actor, entity)` which
 *   accepts `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` AND
 *   actor is the entity owner).
 * - Previously this route required `[ACCOMMODATION_UPDATE_ANY]` at the route
 *   layer, which blocked HOSTs with only UPDATE_OWN with a generic
 *   "Insufficient admin permissions" error before the service could decide.
 *   Deferring to the service-layer check unblocks the HOST onboarding flow
 *   without weakening security — the service still throws FORBIDDEN if the
 *   actor has neither permission.
 */
export const adminUpdateAccommodationRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update accommodation (admin)',
    description:
        'Updates an accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationUpdateInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as AccommodationUpdateInput;

        const result = await accommodationService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
