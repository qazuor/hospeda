/** Public, session-blind filter options for experience listings. The HTML consuming
 * this response is cached with the `list-experience` tag.
 */
import {
    ExperiencePublicFilterOptionsQuerySchema,
    ExperiencePublicFilterOptionsSchema
} from '@repo/schemas';
import { getExperiencePublicFilterOptions, ServiceError } from '@repo/service-core';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/public/experiences/filter-options
 * Returns the amenity and feature ids present on published listings.
 */
export const publicGetExperienceFilterOptionsRoute = createPublicRoute({
    method: 'get',
    path: '/filter-options',
    summary: 'Get public experience filter options',
    description: 'Returns filter values present on published experience listings',
    tags: ['Experience'],
    requestQuery: ExperiencePublicFilterOptionsQuerySchema.shape,
    responseSchema: ExperiencePublicFilterOptionsSchema,
    handler: async (_ctx, _params, _body, query) => {
        const result = await getExperiencePublicFilterOptions({ input: query ?? {} });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
