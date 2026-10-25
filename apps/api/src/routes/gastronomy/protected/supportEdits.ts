import { ListingSupportEditsResponseSchema, VerticalEnum } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
import { listSupportEdits } from '../../../services/listing-publication/listing-support-edit.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const ownership = new ListingPurgeService();
/** 404 unless the actor owns the listing (same owner check as the PB12 route). */
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

/**
 * GET /api/v1/protected/gastronomies/{id}/support-edits — row 26 (ACC:15,
 * HOS-1493, H13): the owner reads the most recent support edits of their own
 * gastronomy listing. Anybody else gets 404.
 */
export const protectedGastronomySupportEditsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/support-edits',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    emailUnverifiedOperation: 'READ_OWN',
    options: { middlewares: [ownerAccess] },
    summary: 'List support edits of own gastronomy listing',
    description: 'The most recent edits support made to the content of the listing (row 26).',
    tags: ['Gastronomies'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ListingSupportEditsResponseSchema,
    handler: async (_ctx: Context, params: Record<string, unknown>) =>
        listSupportEdits({ vertical: VerticalEnum.VENUE, listingId: params.id as string })
});
