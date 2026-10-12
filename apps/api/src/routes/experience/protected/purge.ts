import { ExperienceIdSchema, VerticalEnum } from '@repo/schemas';
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
        vertical: VerticalEnum.EXPERIENCE,
        id
    });
    await next();
};
/** Owner PB12 route for experience listings. */
export const protectedPurgeExperienceRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/purge',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'DELETE', idParam: 'id' },
    options: { middlewares: [ownerAccess] },
    summary: 'Purge own experience listing',
    description: 'Permanently removes listing content through PB12.',
    tags: ['Experiences'],
    requestParams: { id: ExperienceIdSchema },
    responseSchema: z.object({ purged: z.literal(true) }),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        service.purge({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.EXPERIENCE,
            id: params.id as string
        })
});
