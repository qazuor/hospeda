/** Public, session-blind filter options for venue listings. The HTML consuming
 * this response is cached with the `list-venue` tag.
 */
import { VenuePublicFilterOptionsQuerySchema, VenuePublicFilterOptionsSchema } from '@repo/schemas';
import { getVenuePublicFilterOptions, ServiceError } from '@repo/service-core';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/public/venues/filter-options
 * Returns types, amenities, and features present on published listings.
 */
export const publicGetVenueFilterOptionsRoute = createPublicRoute({
    method: 'get',
    path: '/filter-options',
    summary: 'Get public venue filter options',
    description: 'Returns filter values present on published venue listings',
    tags: ['Venue'],
    requestQuery: VenuePublicFilterOptionsQuerySchema.shape,
    responseSchema: VenuePublicFilterOptionsSchema,
    handler: async (_ctx, _params, _body, query) => {
        const result = await getVenuePublicFilterOptions({ input: query ?? {} });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
