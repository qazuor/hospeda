/**
 * Protected publish accommodation endpoint
 * Requires authentication and ownership
 */
import { AccommodationIdSchema, AccommodationProtectedSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { buildAccommodationPublishDeps } from '../../../services/accommodation-publish-deps';
import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService(
    { logger: apiLogger },
    undefined,
    null,
    undefined,
    buildAccommodationPublishDeps()
);

/**
 * POST /api/v1/protected/accommodations/:id/publish
 * Publish accommodation - Transitions DRAFT (or INACTIVE) → ACTIVE.
 *
 * Calls `AccommodationService.publish()` directly (NOT the generic `update()`
 * HTTP path) because the general PATCH schema (`AccommodationUpdateHttpSchema`,
 * derived from the create schema) has no `lifecycleState` field, so Zod would
 * silently strip it and the request would be a no-op (HOS-110 bugfix). This
 * dedicated endpoint mirrors `/unpublish`. It does NOT start a trial: since
 * card-first (HOS-171) the trial is a MercadoPago preapproval created at
 * checkout, so an ineligible owner is rejected and sent to the plans page.
 *
 * Protected endpoint with ownership check. No entitlement gate at the route
 * level — `publish()` itself resolves the owner's billing eligibility
 * (`first_publish` / `has_active_sub` / `subscription_required`) and rejects
 * with `FORBIDDEN: subscription_required` when the owner has no active
 * subscription — including the `first_publish` case, which card-first also
 * rejects so the card can be collected at checkout before any free days
 * exist.
 */
export const protectedPublishAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish',
    summary: 'Publish accommodation',
    description:
        'Transitions an accommodation from DRAFT (or INACTIVE) to ACTIVE. Requires an active subscription (the trial is created at checkout, not here), plus ownership or ACCOMMODATION_UPDATE_ANY permission.',
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

        // BETA-199: `AccommodationProtectedSchema` declares the premium
        // rich-description pair so the owner's editor GET can show translation
        // status for it. That GET gates the pair on the owner's plan; EVERY other
        // route on this schema — including this one — drops it unconditionally.
        // This response echoes a mutated entity and has no use for rich text, so
        // an unconditional drop keeps the payload identical to what it was before
        // the pair was declared, with no entitlement lookup and no gate to
        // get wrong. See the schema comment for the full contract.
        return stripRichDescriptionFields(result.data);
    }
});
