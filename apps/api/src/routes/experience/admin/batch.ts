/**
 * Admin batch experience listings endpoint.
 * Retrieves multiple experience listings by IDs in a single request.
 */
import {
    ExperienceBatchRequestSchema,
    ExperienceBatchResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/batch
 * Get multiple experience listings by IDs — Admin endpoint.
 *
 * Used by admin relation-selector components that need to resolve multiple
 * UUIDs to their display labels in a single round-trip.
 */
export const adminBatchExperiencesRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple experience listings by IDs (admin)',
    description:
        'Retrieves multiple experience listings by their IDs for entity select components. Requires COMMERCE_VIEW_ALL.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestBody: ExperienceBatchRequestSchema,
    responseSchema: ExperienceBatchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        const results = await Promise.all(
            ids.map(async (id) => {
                const result = await experienceService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified — always include id for entity selectors.
        if (fields && fields.length > 0) {
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return results.map((experience) => {
                if (!experience) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in experience) {
                        filtered[field] = experience[field as keyof typeof experience];
                    }
                }

                return filtered;
            });
        }

        return results;
    }
});
