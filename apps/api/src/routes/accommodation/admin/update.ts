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
 * Permission model:
 * - Route requires admin-panel access (ACCESS_PANEL_ADMIN or ACCESS_API_ADMIN
 *   via `createAdminRoute`'s level check). Only staff roles
 *   (SUPER_ADMIN / ADMIN / EDITOR / CLIENT_MANAGER) hold that permission, so
 *   this endpoint is admin-only. HOST / COMMERCE_OWNER do NOT reach it: they
 *   self-manage their own accommodations from the web app
 *   (`/mi-cuenta/propiedades/`) via the owner-scoped `/api/v1/protected/*`
 *   routes, which enforce ownership without any admin permission.
 * - Entity-specific permission is still enforced at the SERVICE layer:
 *   `accommodationService.update` calls `checkCanUpdate(actor, entity)` which
 *   accepts `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` AND
 *   actor is the entity owner). This service-layer check is kept as
 *   defense-in-depth even though the route-layer gate already restricts
 *   callers to staff — the service still throws FORBIDDEN if the actor has
 *   neither permission.
 *
 * Historical note (SPEC-143 Finding #14): this route once deferred the
 * entity-specific check to the service layer specifically to let HOSTs edit
 * their own listings here, back when the "publicar" onboarding redirected
 * HOSTs into the admin UI and HOST carried ACCESS_PANEL_ADMIN. Both of those
 * are gone (HOS-152): the grant was removed and onboarding now keeps hosts on
 * the web, so this route no longer serves any HOST flow.
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
