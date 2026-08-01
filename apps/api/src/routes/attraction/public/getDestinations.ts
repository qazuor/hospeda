/**
 * Public attraction destinations endpoint
 * Returns the destinations that offer a given attraction.
 *
 * This is what makes the attraction landing page possible: an attraction is a
 * taxonomy term ("Termas", "Playa Fluvial"), not a place, so its page answers
 * "which destinations have this?" rather than describing the term itself.
 */

import type { DestinationsByAttractionInput } from '@repo/schemas';
import { AttractionIdSchema, DestinationPublicSchema } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/public/attractions/:id/destinations
 * Get the destinations offering an attraction - Public endpoint
 */
export const publicGetAttractionDestinationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/destinations',
    summary: 'Get destinations for an attraction',
    description: 'Retrieves the destinations that offer a given attraction',
    tags: ['Attractions'],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: z.array(DestinationPublicSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        // `page`/`pageSize` carry `.default()` in the input schema, so the
        // inferred TYPE lists them as required (z.infer reflects the post-default
        // OUTPUT shape) while omitting them validates fine at runtime — the same
        // cast the destination points-of-interest route makes. The service
        // ignores both anyway and returns every destination for the attraction,
        // which is what this landing needs: the full list, unpaginated.
        const result = await attractionService.getDestinationsByAttraction(actor, {
            attractionId: params.id as string
        } as DestinationsByAttractionInput);

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
