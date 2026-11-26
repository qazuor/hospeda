/**
 * GET /api/v1/protected/venues/:id/photo-allowance (HOS-2495)
 *
 * The photo allowance of an owned venue listing: the cap step 7 enforces on its
 * gallery writes, how many photos count toward it, how many approved photos the
 * public page hides, and the breakdown when it adds up. READ_OWN, so a no-plan
 * owner gets `status: 'NONE'` instead of a 403; another owner's listing is a 404.
 */
import { ListingPhotoAllowanceSchema, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
// Same module instance `utils/response-helpers` compares against (see sectionStates.ts).
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveListingPhotoAllowance } from '../../../utils/listing-access/photo-allowance';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Reads the photo allowance of an owned venue listing. */
export const protectedGetVenuePhotoAllowanceRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/photo-allowance',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' },
    summary: 'Read the venue listing photo allowance',
    description:
        'Returns the effective gallery photo cap the server enforces for this venue listing ' +
        '(plan + add-ons + grants, or the pre-trial DRAFT fallback), the gallery photos that ' +
        'count toward it, the approved photos hidden publicly, and its breakdown (HOS-2495).',
    tags: ['Venue'],
    requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
    responseSchema: ListingPhotoAllowanceSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const listingAccess = ctx.get('listingAccess');
        if (!listingAccess?.subjectId)
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        const listingId = params.id as string;
        const { facts } = await getListingAccessPorts().loadFacts({
            vertical: VerticalEnum.VENUE,
            listingId
        });
        return resolveListingPhotoAllowance({
            vertical: VerticalEnum.VENUE,
            listingId,
            ownerId: listingAccess.subjectId,
            publicationStatus: facts?.publicationStatus ?? null
        });
    }
});
