/**
 * Admin batch destination endpoint
 * Retrieves multiple destinations by IDs - Admin only
 */
import {
    DestinationBatchRequestSchema,
    DestinationBatchResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/destinations/batch
 * Get multiple destinations by IDs - Admin endpoint
 */
export const adminBatchDestinationsRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple destinations by IDs',
    description:
        'Retrieves multiple destinations by their IDs for entity select components. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestBody: DestinationBatchRequestSchema,
    responseSchema: DestinationBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all destinations by their IDs
        const destinations = await Promise.all(
            ids.map(async (id) => {
                const result = await destinationService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return destinations.map((destination) => {
                if (!destination) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in destination) {
                        filtered[field] = destination[field as keyof typeof destination];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createAdminRoute will wrap it with success, data, metadata
        return destinations;
    }
});
