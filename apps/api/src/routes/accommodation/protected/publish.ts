/**
 * Protected publish accommodation endpoint
 * Requires authentication and ownership
 */
import { AccommodationIdSchema, AccommodationProtectedSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps(getQZPayBilling)
);

/**
 * POST /api/v1/protected/accommodations/:id/publish
 * Publish accommodation - Transitions DRAFT (or INACTIVE) → ACTIVE.
 *
 * Calls `AccommodationService.publish()` directly (NOT the generic `update()`
 * HTTP path) because the general PATCH schema (`AccommodationUpdateHttpSchema`,
 * derived from the create schema) has no `lifecycleState` field, so Zod would
 * silently strip it and the request would be a no-op (HOS-110 bugfix). This
 * dedicated endpoint mirrors `/unpublish` and orchestrates the first-publish
 * no-card trial (`TrialService.startTrial()`) when the owner is eligible.
 *
 * Protected endpoint with ownership check. No entitlement gate at the route
 * level — `publish()` itself resolves the owner's billing eligibility
 * (`first_publish` / `has_active_sub` / `subscription_required`) and rejects
 * with `FORBIDDEN: subscription_required` when the owner has already
 * consumed their one-per-life trial and has no active subscription. A
 * first-time publisher with no subscription at all is NOT blocked — that is
 * exactly the `first_publish` path that starts their trial.
 */
export const protectedPublishAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish',
    summary: 'Publish accommodation',
    description:
        'Transitions an accommodation from DRAFT (or INACTIVE) to ACTIVE, starting the no-card trial for first-time publishers. Requires ownership or ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationProtectedSchema,
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.publish(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
