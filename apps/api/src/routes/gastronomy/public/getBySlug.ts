/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { GastronomyPublicSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import {
    fetchGastronomyAmenities,
    fetchGastronomyFeatures
} from '../../../utils/commerce-catalog-relations';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/slug/:slug
 * Get gastronomy listing by slug — Public endpoint.
 *
 * Delegates to GastronomyService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetGastronomyBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get gastronomy listing by slug',
    description: 'Retrieves a gastronomy listing by its URL-friendly slug',
    tags: ['Gastronomy'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: GastronomyPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const gastronomy = result.data;
        if (!gastronomy) {
            return null;
        }

        // HOS-1072: the amenities and features the owner ticked. The service
        // loads the junction rows but not the catalog behind them, so the slug
        // (the i18n key) and the icon are fetched here — same reason and same
        // shape as the accommodation route's own `fetchAmenities`/`fetchFeatures`.
        //
        // Emitted as `undefined` when empty rather than `[]`: the detail page
        // renders nothing for either, and an empty array on the wire would read
        // as "loaded, and there are none" from a payload that never joined.
        const [amenitiesData, featuresData] = await Promise.all([
            fetchGastronomyAmenities(gastronomy.id),
            fetchGastronomyFeatures(gastronomy.id)
        ]);

        return {
            ...gastronomy,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
