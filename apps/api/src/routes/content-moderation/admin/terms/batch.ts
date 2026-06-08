/**
 * Admin batch import moderation terms endpoint
 */
import { z } from '@hono/zod-openapi';
import { createContentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const termService = new ContentModerationTermService({ logger: apiLogger });

const BatchImportResponseSchema = z.object({
    createdCount: z.number().int().nonnegative()
});

/**
 * POST /api/v1/admin/content-moderation/terms/batch
 * Batch import moderation terms - Admin endpoint.
 */
export const adminBatchImportTermsRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Batch import moderation terms (admin)',
    description: 'Imports multiple moderation terms in a single transaction (max 5000)',
    tags: ['Content Moderation'],
    requestBody: z.object({
        rows: z.array(createContentModerationTermSchema).min(1).max(5000)
    }),
    responseSchema: BatchImportResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { rows } = body as {
            rows: Array<z.infer<typeof createContentModerationTermSchema>>;
        };

        const result = await termService.bulkImport(actor, { rows });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { createdCount: result.data?.createdCount ?? 0 };
    }
});
