import {
    AccommodationIdSchema,
    ListingSupportEditsResponseSchema,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { listSupportEdits } from '../../../services/listing-publication/listing-support-edit.service';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/accommodations/{id}/support-edits — row 26 (ACC:15,
 * HOS-1493, H13): the owner reads the most recent support edits of their own
 * accommodation. Anybody else gets 404.
 */
export const protectedAccommodationSupportEditsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/support-edits',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'READ_OWN', idParam: 'id' },
    summary: 'List support edits of own accommodation',
    description: 'The most recent edits support made to the content of the listing (row 26).',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: ListingSupportEditsResponseSchema,
    ownership: { entityType: 'accommodation', ownershipFields: ['ownerId', 'createdById'] },
    handler: async (_ctx: Context, params: Record<string, unknown>) =>
        listSupportEdits({ vertical: VerticalEnum.ACCOMMODATION, listingId: params.id as string })
});
