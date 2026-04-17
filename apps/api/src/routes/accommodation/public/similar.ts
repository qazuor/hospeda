/**
 * GET /api/v1/public/accommodations/:id/similar
 * Returns accommodations similar to the given one, matched by type or destination.
 */
import { accommodations, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/public/accommodations/:id/similar
 * Public endpoint - no auth required
 */
export const publicGetSimilarRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/similar',
    summary: 'Get similar accommodations',
    description: 'Returns accommodations similar to the given one by type or destination',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().uuid()
    },
    requestQuery: {
        limit: z.coerce.number().int().min(1).max(12).default(6).optional()
    },
    responseSchema: z.array(z.record(z.unknown())),
    handler: async (
        _ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const id = params.id as string;
        const limit = Math.min(Number(query?.limit) || 6, 12);

        /**
         * @remarks getDb() is used directly here because no service method exposes
         * the two-step similarity pattern: (1) fetch the source accommodation's type
         * and destinationId, then (2) query with OR(same-type, same-destination) plus
         * exclusion of the source record. AccommodationService.search() would require
         * two separate calls and does not support the OR condition between type and
         * destinationId simultaneously.
         */
        const db = getDb();

        // Fetch current accommodation to get type and destinationId
        const current = await db
            .select({
                type: accommodations.type,
                destinationId: accommodations.destinationId
            })
            .from(accommodations)
            .where(eq(accommodations.id, id))
            .limit(1);

        if (current.length === 0) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        const { type, destinationId } = current[0];

        // Build OR condition: same type OR same destination
        const similarityConditions = [];
        if (type) {
            similarityConditions.push(eq(accommodations.type, type));
        }
        if (destinationId) {
            similarityConditions.push(eq(accommodations.destinationId, destinationId));
        }

        if (similarityConditions.length === 0) {
            return [];
        }

        const rows = await db
            .select()
            .from(accommodations)
            .where(
                and(
                    or(...similarityConditions),
                    ne(accommodations.id, id),
                    eq(accommodations.lifecycleState, 'ACTIVE'),
                    eq(accommodations.visibility, 'PUBLIC')
                )
            )
            .orderBy(desc(accommodations.averageRating))
            .limit(limit);

        return rows;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
