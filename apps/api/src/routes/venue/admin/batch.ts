/**
 * Admin batch gastronomy listings endpoint.
 * Retrieves multiple gastronomy listings by IDs in a single request.
 */
import { PermissionEnum, VenueBatchRequestSchema, VenueBatchResponseSchema } from '@repo/schemas';
import { VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/batch
 * Get multiple gastronomy listings by IDs — Admin endpoint.
 *
 * Used by admin relation-selector components that need to resolve multiple
 * UUIDs to their display labels in a single round-trip.
 */
export const adminBatchVenuesRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple gastronomy listings by IDs (admin)',
    description:
        'Retrieves multiple gastronomy listings by their IDs for entity select components. Requires GASTRONOMY_VIEW_ALL.',
    tags: ['Gastronomy'],
    anyOfPermissions: [[PermissionEnum.GASTRONOMY_VIEW_ALL]],
    requestBody: VenueBatchRequestSchema,
    responseSchema: VenueBatchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        const results = await Promise.all(
            ids.map(async (id) => {
                const result = await venueService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified — always include id for entity selectors.
        if (fields && fields.length > 0) {
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return results.map((venue) => {
                if (!venue) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in venue) {
                        filtered[field] = venue[field as keyof typeof venue];
                    }
                }

                return filtered;
            });
        }

        return results;
    }
});
