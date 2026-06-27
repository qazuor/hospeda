/**
 * POST /api/v1/admin/accommodations/:id/external-reputation/disable
 *
 * Admin-only soft-disable: sets `showLink=false` and `showReviews=false` on
 * ALL non-deleted listings for the accommodation.
 *
 * Permission: ACCOMMODATION_UPDATE_ANY (enforced by the service layer).
 * Does NOT delete any rows — data is preserved and can be re-enabled by the
 * accommodation owner via the protected listing update endpoints.
 *
 * SPEC-237 T-009 — admin soft-takedown route.
 */

import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import { AccommodationIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AccommodationExternalReputationService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getReputationAdapterCredentials } from '../../../utils/reputation-credentials';
import { createAdminRoute } from '../../../utils/route-factory';

const listingModel = new AccommodationExternalListingModel();
const reputationModel = new AccommodationExternalReputationModel();
const accommodationModel = new AccommodationModel();

const reputationService = new AccommodationExternalReputationService(
    { logger: apiLogger },
    {
        listingModel,
        reputationModel,
        accommodationModel,
        adapterCredentials: getReputationAdapterCredentials()
    }
);

/** Shape returned by a successful disable call. */
const DisableReputationResponseSchema = z.object({
    disabled: z.number().int().min(0)
});

/**
 * POST /api/v1/admin/accommodations/:id/external-reputation/disable
 *
 * Silences all external reputation listings for the accommodation.
 *
 * - Returns 200 `{ disabled: N }` on success.
 * - Returns 403 when the actor lacks `ACCOMMODATION_UPDATE_ANY`.
 * - Returns 404 when the accommodation does not exist.
 */
export const adminDisableReputationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/external-reputation/disable',
    summary: 'Admin disable external reputation for an accommodation',
    description:
        'Sets showLink=false and showReviews=false on ALL non-deleted external reputation ' +
        'listings for the accommodation. This is a soft-disable — no data is deleted. ' +
        'To restore visibility the owner must re-enable their listings via the protected ' +
        'listing update endpoints. Requires ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations', 'External Reputation'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: DisableReputationResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const result = await reputationService.disableReputation(accommodationId, actor);

        if (result.error) {
            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        return result.data;
    }
});
