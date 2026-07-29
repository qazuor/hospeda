import { AccommodationIdSchema, AccommodationSummarySchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodation summary
 * @param ctx - Hono context
 * @param params - Path parameters containing id
 * @returns Accommodation summary data or null if not found
 */
const getSummaryHandler = async (_ctx: Context, params: Record<string, unknown>) => {
    // Get the ID from the path params
    const id = params.id as string;

    // Validate the ID using AccommodationIdSchema
    const validationResult = AccommodationIdSchema.safeParse(id);

    if (!validationResult.success) {
        // Re-throw the Zod error to maintain the expected error format
        throw validationResult.error;
    }

    // HOS-353: resolve visibility against a GUEST actor, never the caller. This route
    // lives under the `/api/v1/public/accommodations` prefix, whose cache key carries
    // no actor and which is consulted before auth — and the payload it returns names
    // `visibility`, `lifecycleState`, `ownerId` and `slug`, so a privileged reader's
    // 200 for an unpublished listing would be replayed to every anonymous visitor for
    // the TTL. Privileged reads live on the protected and admin tiers.

    // Call the real accommodation service using getById to get full entity with summary
    const result = await accommodationService.getById(createGuestActor(), id);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // Return null if accommodation not found (schema is nullable)
    if (!result.data) {
        return null;
    }

    // Transform service response to match AccommodationSummarySchema
    const summaryData = {
        id: result.data.id,
        slug: result.data.slug,
        name: result.data.name,
        summary: result.data.summary,
        type: result.data.type,
        reviewsCount: result.data.reviewsCount,
        averageRating: result.data.averageRating,
        isFeatured: result.data.isFeatured,
        visibility: result.data.visibility || 'PUBLIC',
        lifecycleState: result.data.lifecycleState || 'ACTIVE',
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
        ownerId: result.data.ownerId,
        destinationId: result.data.destinationId
    };

    return summaryData;
};

/**
 * GET /accommodations/:id/summary
 * Public endpoint to get accommodation summary
 */
export const getSummaryRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get accommodation summary',
    description:
        'Retrieve a summary for a specific accommodation including basic info, location, and key metrics',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationSummarySchema.nullable(),
    handler: getSummaryHandler,
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});
