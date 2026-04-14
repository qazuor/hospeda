/**
 * Admin media delete endpoint.
 *
 * DELETE /api/v1/admin/media?publicId=hospeda/prod/accommodations/...
 *
 * Deletes a Cloudinary asset by its publicId.
 * The publicId must start with "hospeda/" to prevent accidental deletion of
 * assets outside the project namespace.
 */
import { DeleteMediaQuerySchema, DeleteMediaResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/media
 * Delete a media asset by its Cloudinary publicId. Admin only.
 */
export const adminDeleteMediaRoute = createAdminRoute({
    method: 'delete',
    path: '/',
    summary: 'Delete media asset',
    description:
        'Permanently deletes a Cloudinary asset by its publicId. ' +
        'The publicId must start with "hospeda/" to protect assets outside the project namespace.',
    tags: ['Media'],
    requestQuery: DeleteMediaQuerySchema.shape,
    responseSchema: DeleteMediaResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        // ── 0. Provider availability check ───────────────────────────────────
        const provider = getMediaProvider();
        if (!provider) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'CLOUDINARY_NOT_CONFIGURED',
                        message: 'Media service is not configured'
                    }
                },
                503
            );
        }

        // ── 1. Validate query params ──────────────────────────────────────────
        const parseResult = DeleteMediaQuerySchema.safeParse(query ?? {});
        if (!parseResult.success) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: parseResult.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message
                        }))
                    }
                },
                400
            );
        }

        const { publicId } = parseResult.data;

        // ── 2. Delete from Cloudinary ─────────────────────────────────────────
        try {
            await provider.delete({ publicId });
        } catch (deleteError) {
            apiLogger.error(
                {
                    error: deleteError instanceof Error ? deleteError.message : String(deleteError),
                    publicId
                },
                'Cloudinary delete failed'
            );
            return ctx.json(
                {
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Media deletion failed' }
                },
                502
            );
        }

        return { deleted: true as const, publicId };
    }
});
