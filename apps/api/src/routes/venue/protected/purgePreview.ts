import { ListingPurgePreviewResponseSchema, VerticalEnum } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
import { readListingPurgePreview } from '../../../services/listing-publication/listing-purge-preview.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownership = new ListingPurgeService();
const ownerAccess: MiddlewareHandler = async (ctx, next) => {
    const id = ctx.req.param('id') ?? '';
    if (!z.string().uuid().safeParse(id).success)
        throw new HTTPException(400, { message: 'Invalid listing id' });
    await ownership.assertOwnerAccess({
        actor: getActorFromContext(ctx),
        vertical: VerticalEnum.VENUE,
        id
    });
    await next();
};

/** Owner-only read of the add-ons left behind by purging a gastronomy listing. */
export const protectedVenuePurgePreviewRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/purge-preview',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    emailUnverifiedOperation: 'READ_OWN',
    options: { middlewares: [ownerAccess] },
    summary: 'Preview add-ons lost when purging own gastronomy listing',
    description: 'Lists live listing add-ons that remain after a purge.',
    tags: ['Gastronomies'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ListingPurgePreviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        readListingPurgePreview({
            ownerId: getActorFromContext(ctx).id,
            listingId: params.id as string
        })
});
