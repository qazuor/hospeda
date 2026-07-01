/**
 * Admin verify accommodation endpoint
 * Sets or clears the isVerified flag on an accommodation
 */
import { AccommodationAdminSchema, AccommodationIdSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/verify
 * Verify or unverify accommodation — Admin endpoint
 *
 * Requires `ACCOMMODATION_VERIFY` permission. Sets `isVerified`, `verifiedAt`,
 * and `verifiedById` columns on the accommodation. Passing `isVerified: false`
 * clears all three columns (un-verification).
 */
export const adminVerifyAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/verify',
    summary: 'Verify accommodation',
    description:
        'Sets or clears the verification status of an accommodation. Requires ACCOMMODATION_VERIFY permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VERIFY],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: z.object({
        isVerified: z.boolean()
    }),
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { isVerified } = body as { isVerified: boolean };

        const result = await accommodationService.verifyAccommodation(actor, id, isVerified);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const fetchResult = await accommodationService.adminGetById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
