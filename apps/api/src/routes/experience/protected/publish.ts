import { ExperienceProtectedSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/experiences/{id}/publish */
export const protectedPublishExperienceRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'PUBLISH', idParam: 'id' },
    summary: 'Publish experience listing',
    description: 'Publishes an owned experience listing immediately through PB1.',
    tags: ['Experience'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ExperienceProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return listingPublicationService.publish({
            actor,
            id: params.id as string,
            vertical: VerticalEnum.EXPERIENCE
        });
    }
});
