/**
 * GET /api/v1/public/accommodations/:id/similar
 * Returns accommodations similar to the given one, matched by type or destination.
 */
import { accommodations, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { type SQL, and, desc, eq, ne, or } from 'drizzle-orm';
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
    responseSchema: z.array(z.record(z.string(), z.unknown())),
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

        const source = current[0];
        if (!source) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        const { type, destinationId } = source;

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

        // Use the relational query builder so the `destination` relation is
        // eager-loaded in the same round trip. Without this the consumer cards
        // (Web app) cannot show the destination name and fall back to "—".
        const orCondition = or(...similarityConditions) as SQL<unknown>;
        const where = and(
            orCondition,
            ne(accommodations.id, id),
            eq(accommodations.lifecycleState, 'ACTIVE'),
            eq(accommodations.visibility, 'PUBLIC')
        ) as SQL<unknown>;

        const rows = await db.query.accommodations.findMany({
            where,
            with: {
                destination: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        summary: true,
                        destinationType: true,
                        level: true,
                        path: true,
                        pathIds: true
                    }
                }
            },
            orderBy: desc(accommodations.averageRating),
            limit
        });

        // Project the loaded `destination` relation as `cityDestination` to
        // match the public API response shape used by listByOwner / list.
        // The Web transform's `deriveCityFields()` reads `cityDestination`
        // (preferred) before falling back to legacy `destination`.
        return rows.map((row) => {
            const { destination, ...rest } = row as Record<string, unknown> & {
                destination?: unknown;
            };
            return destination ? { ...rest, cityDestination: destination } : rest;
        });
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
