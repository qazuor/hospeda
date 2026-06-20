/**
 * GET /api/v1/public/accommodations/:id/external-reputation
 *
 * Returns the toggle-filtered, TTL-degraded external reputation block for
 * the public accommodation detail page.
 *
 * No authentication required. If the master toggle is OFF, returns an empty
 * block `{ items: [] }` with HTTP 200. A short server-side cache hint is
 * set via Cache-Control.
 *
 * SPEC-237 T-009 — public read route.
 */

import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import {
    AccommodationIdSchema,
    ExternalReputationBlockSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationExternalReputationService, ServiceError } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger';
import { getReputationAdapterCredentials } from '../../../utils/reputation-credentials';
import { createPublicRoute } from '../../../utils/route-factory';

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

/**
 * GET /api/v1/public/accommodations/:id/external-reputation
 *
 * Returns the public external reputation block for an accommodation.
 *
 * - Master toggle OFF → `{ items: [] }` (200, no error).
 * - No DB rows → `{ items: [] }` (200).
 * - Cache-Control: `public, max-age=300`.
 */
export const publicGetExternalReputationRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/external-reputation',
    summary: 'Get external reputation block for an accommodation',
    description:
        'Returns the public-facing external reputation block for an accommodation, ' +
        'including per-platform ratings, review counts, and Google snippets (when available). ' +
        'Returns an empty block when the master toggle is disabled or no verified listings exist. ' +
        'No authentication required.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: ExternalReputationBlockSchema,
    handler: async (_ctx, params) => {
        // listForDisplay never returns an error — it degrades to empty block on failure.
        const result = await reputationService.listForDisplay(params.id as string);

        if (result.error) {
            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
