import { VenueProtectedSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/venues/{id}/publish */
export const protectedPublishVenueRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'PUBLISH', idParam: 'id' },
    summary: 'Publish gastronomy listing',
    description: 'Publishes an owned gastronomy listing immediately through PB1.',
    tags: ['Gastronomy'],
    requestParams: { id: z.string().uuid() },
    responseSchema: VenueProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return listingPublicationService.publish({
            actor,
            id: params.id as string,
            vertical: VerticalEnum.VENUE
        });
    }
});
