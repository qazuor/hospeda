/**
 * Admin batch gastronomy listings endpoint.
 * Retrieves multiple gastronomy listings by IDs in a single request.
 */
import {
    GastronomyBatchRequestSchema,
    GastronomyBatchResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/batch
 * Get multiple gastronomy listings by IDs — Admin endpoint.
 *
 * Used by admin relation-selector components that need to resolve multiple
 * UUIDs to their display labels in a single round-trip.
 */
export const adminBatchGastronomiesRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple gastronomy listings by IDs (admin)',
    description:
        'Retrieves multiple gastronomy listings by their IDs for entity select components. Requires COMMERCE_VIEW_ALL.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestBody: GastronomyBatchRequestSchema,
    responseSchema: GastronomyBatchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        const results = await Promise.all(
            ids.map(async (id) => {
                const result = await gastronomyService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified — always include id for entity selectors.
        if (fields && fields.length > 0) {
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return results.map((gastronomy) => {
                if (!gastronomy) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in gastronomy) {
                        filtered[field] = gastronomy[field as keyof typeof gastronomy];
                    }
                }

                return filtered;
            });
        }

        return results;
    }
});
