/**
 * Public point-of-interest destinations endpoint.
 * Returns the destinations that reference a given point of interest.
 *
 * This backs the "Está en" block of the POI detail page
 * (`/destinos/lugar/{slug}/`). A POI is many-to-many with destinations —
 * the Molino Forclaz is offered by Colón, San José, Liebig and Villa Elisa
 * alike — so the page cannot derive a single parent from the payload and
 * has to ask for the whole set.
 *
 * Mirrors `publicGetAttractionDestinationsRoute`, the equivalent route for
 * attractions.
 */

import type { DestinationsByPointOfInterestInput } from '@repo/schemas';
import { DestinationPublicSchema, PointOfInterestIdSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/public/points-of-interest/:id/destinations
 * Get the destinations referencing a point of interest - Public endpoint
 */
export const publicGetPointOfInterestDestinationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/destinations',
    summary: 'Get destinations for a point of interest',
    description: 'Retrieves the destinations that reference a given point of interest',
    tags: ['PointsOfInterest'],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: z.array(DestinationPublicSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        // `page`/`pageSize` carry `.default()` in the input schema, so the
        // inferred TYPE lists them as required (z.infer reflects the
        // post-default OUTPUT shape) while omitting them validates fine at
        // runtime — the same cast the attraction destinations route makes. The
        // service ignores both and returns every destination for the POI,
        // which is what this page needs: the full list, unpaginated.
        const result = await pointOfInterestService.getDestinationsByPointOfInterest(actor, {
            pointOfInterestId: params.id as string
        } as DestinationsByPointOfInterestInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // The service wraps the value as { destinations: [...] }; the response
        // schema is the bare array, so unwrap before returning.
        return result.data?.destinations ?? [];
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
