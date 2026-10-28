import { VerticalEnum } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const service = new ListingPurgeService();
const ownerAccess: MiddlewareHandler = async (ctx, next) => {
    const id = ctx.req.param('id') ?? '';
    if (!z.string().uuid().safeParse(id).success)
        throw new HTTPException(400, { message: 'Invalid listing id' });
    await service.assertOwnerAccess({
        actor: getActorFromContext(ctx),
        vertical: VerticalEnum.VENUE,
        id
    });
    await next();
};
/** Owner PB12 route for venue listings. */
export const protectedPurgeVenueRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/purge',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'DELETE', idParam: 'id' },
    emailUnverifiedOperation: 'DELETE_LISTING',
    options: { middlewares: [ownerAccess] },
    summary: 'Purge own gastronomy listing',
    description: 'Permanently removes listing content through PB12.',
    tags: ['Gastronomies'],
    requestParams: { id: z.string().uuid() },
    responseSchema: z.object({ purged: z.literal(true) }),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        service.purge({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.VENUE,
            id: params.id as string
        })
});
