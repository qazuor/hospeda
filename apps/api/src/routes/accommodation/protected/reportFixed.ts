import { AccommodationIdSchema, ReportFixedResponseSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { reportFixed } from '../../../services/listing-notices/listing-notices.service';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * POST /api/v1/protected/accommodations/{id}/fix-request/report-fixed — row 30
 * (HOS-1492, H4): the owner reports that they fixed what the open fix request
 * asked. Idempotent; 409 `NO_OPEN_FIX_REQUEST` without an open request. Anybody
 * else gets 404.
 */
export const protectedAccommodationReportFixedRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/fix-request/report-fixed',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Report a fix request as fixed',
    description: 'The owner reports the open fix request of their listing as fixed (row 30).',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: ReportFixedResponseSchema,
    ownership: { entityType: 'accommodation', ownershipFields: ['ownerId', 'createdById'] },
    handler: async (_ctx: Context, params: Record<string, unknown>) =>
        reportFixed({ vertical: VerticalEnum.ACCOMMODATION, listingId: params.id as string })
});
