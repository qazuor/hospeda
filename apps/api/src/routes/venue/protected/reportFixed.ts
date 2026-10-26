import { ReportFixedResponseSchema, VerticalEnum } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { reportFixed } from '../../../services/listing-notices/listing-notices.service';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
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
 * POST /api/v1/protected/gastronomies/{id}/fix-request/report-fixed — row 30
 * (HOS-1492, H4): the owner reports that they fixed what the open fix request
 * asked. Idempotent; 409 `NO_OPEN_FIX_REQUEST` without an open request. Anybody
 * else gets 404.
 */
export const protectedVenueReportFixedRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/fix-request/report-fixed',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    options: { middlewares: [ownerAccess] },
    summary: 'Report a fix request as fixed',
    description:
        'The owner reports the open fix request of their gastronomy listing as fixed (row 30).',
    tags: ['Gastronomies'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ReportFixedResponseSchema,
    handler: async (_ctx: Context, params: Record<string, unknown>) =>
        reportFixed({ vertical: VerticalEnum.VENUE, listingId: params.id as string })
});
