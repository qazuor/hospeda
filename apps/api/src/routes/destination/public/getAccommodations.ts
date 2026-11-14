/**
 * Public destination accommodations endpoint
 * Returns accommodations for a specific destination
 */
import { AccommodationPublicSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { createGuestActor } from '../../../utils/actor';
import type { AccommodationData } from '../../../utils/entitlement-filter';
import {
    filterPublicPaidFieldsForOwner,
    resolvePublicFieldGrants
} from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/accommodations
 * Get destination accommodations - Public endpoint
 */
export const publicGetDestinationAccommodationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'Get destination accommodations',
    description: 'Retrieves all accommodations for a specific destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.array(AccommodationPublicSchema),
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const actor = createGuestActor();
        const result = await destinationService.getAccommodations(actor, {
            destinationId: params.id as string,
            page: 1,
            pageSize: 100
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        // The service wraps the value as { accommodations: [...] }; resolve paid
        // fields from each row owner before returning the bare response array.
        const rawAccommodations = result.data?.accommodations ?? [];
        const grants = await resolvePublicFieldGrants(
            rawAccommodations.map((item) => item.ownerId)
        );
        const strippedAccommodations = rawAccommodations.map((a) =>
            filterPublicPaidFieldsForOwner(a, grants)
        );

        return strippedAccommodations as AccommodationData[];
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
