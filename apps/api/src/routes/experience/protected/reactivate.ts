import { ExperienceProtectedSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/experiences/{id}/reactivate */
export const protectedReactivateExperienceRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/reactivate',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'REACTIVATE', idParam: 'id' },
    emailUnverifiedOperation: 'REACTIVATE_LISTING',
    summary: 'Reactivate archived experience listing',
    description: 'Moves an archived listing back to DRAFT through PB8.',
    tags: ['Experience'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ExperienceProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return listingPublicationService.reactivate({
            actor,
            id: params.id as string,
            vertical: VerticalEnum.EXPERIENCE
        });
    }
});
