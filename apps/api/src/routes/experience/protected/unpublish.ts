import { ExperienceProtectedSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/experiences/{id}/unpublish */
export const protectedUnpublishExperienceRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/unpublish',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' },
    summary: 'Unpublish experience listing',
    description: 'Moves a published experience listing to DRAFT through PB6.',
    tags: ['Experience'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ExperienceProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return listingPublicationService.unpublish({
            actor,
            id: params.id as string,
            vertical: VerticalEnum.EXPERIENCE
        });
    }
});
