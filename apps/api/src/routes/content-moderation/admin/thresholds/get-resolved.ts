/**
 * Admin get resolved threshold for context endpoint
 */
import { z } from '@hono/zod-openapi';
import { PermissionEnum } from '@repo/schemas';
import { getThresholdForContext } from '@repo/service-core';
import { createAdminRoute } from '../../../../utils/route-factory';

const ResolvedThresholdSchema = z.object({
    context: z.string(),
    pending: z.number(),
    reject: z.number(),
    source: z.enum(['row', 'default-row', 'code-constants'])
});

/**
 * GET /api/v1/admin/content-moderation/thresholds/resolved
 * Get resolved threshold for a given context - Admin endpoint.
 * Returns the effective threshold after applying the chain: row → default → code constants.
 */
export const adminGetResolvedThresholdRoute = createAdminRoute({
    method: 'get',
    path: '/resolved',
    summary: 'Get resolved threshold for context (admin)',
    description:
        'Returns the effective moderation threshold for a given context, applying the fallback chain: specific row → default row → code constants.',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW],
    requestQuery: { context: z.string().optional() },
    responseSchema: ResolvedThresholdSchema,
    handler: async (_ctx, _params, _body, query) => {
        const context = (query as { context?: string })?.context;
        const result = await getThresholdForContext({ context });
        return result;
    },
    options: {
        cacheTTL: 10
    }
});
