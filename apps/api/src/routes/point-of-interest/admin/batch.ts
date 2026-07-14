/**
 * Admin batch operations endpoint
 * Performs batch operations on points of interest
 */
import {
    PermissionEnum,
    PointOfInterestBatchRequestSchema,
    PointOfInterestBatchResponseSchema
} from '@repo/schemas';
import { PointOfInterestService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * POST /api/v1/admin/points-of-interest/batch
 * Batch retrieve points of interest - Admin endpoint
 */
export const adminBatchPointsOfInterestRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple points of interest by IDs',
    description:
        'Retrieves multiple points of interest by their IDs for admin entity select components',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_VIEW],
    requestBody: PointOfInterestBatchRequestSchema,
    responseSchema: PointOfInterestBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all points of interest by their IDs
        const pointsOfInterest = await Promise.all(
            ids.map(async (id) => {
                const result = await pointOfInterestService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and slug for entity selectors to work.
            // Points of interest have no `name` column (HOS-113 OQ-2), so
            // `slug` is the stable plain-string identifier used in its place.
            const requiredFields = ['id', 'slug'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return pointsOfInterest.map((pointOfInterest: unknown) => {
                if (!pointOfInterest) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (
                        pointOfInterest &&
                        typeof pointOfInterest === 'object' &&
                        field in pointOfInterest
                    ) {
                        filtered[field] = (pointOfInterest as Record<string, unknown>)[field];
                    }
                }

                return filtered;
            });
        }

        return pointsOfInterest;
    }
});
