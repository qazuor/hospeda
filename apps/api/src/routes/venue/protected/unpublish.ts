import { VenueProtectedSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/gastronomies/{id}/unpublish */
export const protectedUnpublishVenueRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/unpublish',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    summary: 'Unpublish gastronomy listing',
    description: 'Moves a published gastronomy listing to DRAFT through PB6.',
    tags: ['Gastronomy'],
    requestParams: { id: z.string().uuid() },
    responseSchema: VenueProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return listingPublicationService.unpublish({
            actor,
            id: params.id as string,
            vertical: VerticalEnum.VENUE
        });
    }
});
