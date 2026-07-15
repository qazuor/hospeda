/**
 * Public destination points-of-interest endpoint (HOS-146)
 * Returns the points of interest associated with a destination, optionally
 * filtered by relation kind (PRIMARY | NEARBY | ALL).
 */

import type { GetDestinationPointsOfInterestInput } from '@repo/schemas';
import { DestinationIdSchema, DestinationPointOfInterestSummarySchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * `relation` query param values accepted by this endpoint. Mirrors
 * `GetDestinationPointsOfInterestInputSchema`'s `relation` field in
 * `@repo/schemas` — kept here as an explicit OpenAPI-facing schema (query
 * params are always strings pre-coercion) rather than importing the service
 * input schema directly.
 */
const RelationQuerySchema = z.enum(['PRIMARY', 'NEARBY', 'ALL']).optional();

/**
 * GET /api/v1/public/destinations/:id/points-of-interest
 * Get destination points of interest - Public endpoint (HOS-146)
 */
export const publicGetDestinationPointsOfInterestRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/points-of-interest',
    summary: 'Get destination points of interest',
    description:
        'Retrieves the points of interest (POIs) associated with a destination, optionally filtered by relation kind (PRIMARY | NEARBY | ALL, default ALL)',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    requestQuery: {
        relation: RelationQuerySchema
    },
    responseSchema: z.array(DestinationPointOfInterestSummarySchema),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // `relation` is optional on the wire (query param, `.default('ALL')`
        // in the schema); the service input's inferred TYPE is required
        // because z.infer reflects the post-default OUTPUT shape. The cast
        // here mirrors that: an omitted query param still validates fine at
        // runtime — `runWithLoggingAndValidation` re-parses this object
        // against `GetDestinationPointsOfInterestInputSchema` and applies the
        // default.
        const result = await destinationService.getPointsOfInterest(actor, {
            destinationId: params.id as string,
            relation: query?.relation as 'PRIMARY' | 'NEARBY' | 'ALL' | undefined
        } as GetDestinationPointsOfInterestInput);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        // Service wraps the value as { pointsOfInterest: [...] }; the
        // responseSchema is the bare array, so unwrap before returning.
        return result.data?.pointsOfInterest ?? [];
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
