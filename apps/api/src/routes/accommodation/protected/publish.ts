/**
 * Protected publish accommodation endpoint
 * Requires authentication and ownership
 */
import { AnalyticsEvents } from '@repo/analytics';
import { AccommodationIdSchema, AccommodationProtectedSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { captureServerAnalyticsEvent } from '../../../lib/posthog';
import { getQZPayBilling } from '../../../middlewares/billing';
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
    buildAccommodationPublishDeps(() => getQZPayBilling())
);

/**
 * POST /api/v1/protected/accommodations/:id/publish
 * Publish accommodation - Transitions DRAFT (or INACTIVE) → ACTIVE.
 *
 * Calls `AccommodationService.publish()` directly (NOT the generic `update()`
 * HTTP path) because the general PATCH schema (`AccommodationUpdateHttpSchema`,
 * derived from the create schema) has no `lifecycleState` field, so Zod would
 * silently strip it and the request would be a no-op (HOS-110 bugfix). This
 * dedicated endpoint mirrors `/unpublish`. It DOES start the free trial when
 * the owner still has one in this vertical: HOS-1012 took the trial back off
 * MercadoPago, so it is a local row with `mp_subscription_id = NULL` inserted in
 * the same transaction as the lifecycle flip. The clock starts when the listing
 * goes live, not at signup (D-1).
 *
 * Protected endpoint with ownership check. No entitlement gate at the route
 * level — `publish()` itself resolves the owner's billing eligibility
 * (`first_publish` / `has_active_sub` / `subscription_required`): the first two
 * publish, the third rejects with `FORBIDDEN: subscription_required` and sends
 * the owner to the plans page.
 */
export const protectedPublishAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish',
    summary: 'Publish accommodation',
    description:
        'Transitions an accommodation from DRAFT (or INACTIVE) to ACTIVE. Requires either an active owner subscription or an unused free trial for this vertical (which this endpoint starts), plus ownership or ACCOMMODATION_UPDATE_ANY permission.',
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
            // `reason` MUST survive the re-throw. Without it the publish gate's
            // per-field verdict died right here: the service knew `bathrooms` was
            // the only missing field, this line dropped that, and the browser fell
            // back to "faltan datos de capacidad (huéspedes, habitaciones o baños)"
            // — naming three fields, two of which were filled in (H-94).
            //
            // It travels in `reason`, never `details`: `handleRouteError` strips
            // `details` unless HOSPEDA_API_DEBUG_ERRORS is on, and production
            // requires it off, so `details` reaches no real host.
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        captureServerAnalyticsEvent({
            distinctId: actor.id,
            name: AnalyticsEvents.accommodationPublished,
            properties: {
                accommodation_id: result.data.id,
                accommodation_type:
                    typeof result.data.type === 'string' ? result.data.type : undefined,
                destination_id:
                    typeof result.data.destinationId === 'string'
                        ? result.data.destinationId
                        : undefined,
                owner_id: typeof result.data.ownerId === 'string' ? result.data.ownerId : undefined
            }
        });

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
