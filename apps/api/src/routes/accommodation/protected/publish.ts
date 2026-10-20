/**
 * Protected publish accommodation endpoint
 * Requires authentication and ownership
 */
import { AnalyticsEvents } from '@repo/analytics';
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { captureServerAnalyticsEvent } from '../../../lib/posthog';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/**
 * POST /api/v1/protected/accommodations/:id/publish
 * Publishes a DRAFT or billing-unpublished accommodation immediately through PB1.
 *
 * Protected endpoint with ownership check. No entitlement gate at the route
 * level — PB1 checks coverage and starts T1 in the locked transaction when eligible.
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
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'PUBLISH', idParam: 'id' },
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const data = await listingPublicationService.publish({ actor, id: params.id as string });

        captureServerAnalyticsEvent({
            distinctId: actor.id,
            name: AnalyticsEvents.accommodationPublished,
            properties: {
                accommodation_id: data.id,
                accommodation_type: typeof data.type === 'string' ? data.type : undefined,
                destination_id:
                    typeof data.destinationId === 'string' ? data.destinationId : undefined,
                owner_id: typeof data.ownerId === 'string' ? data.ownerId : undefined
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
        return stripRichDescriptionFields(data);
    }
});
