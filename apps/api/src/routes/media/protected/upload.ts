import { resolveEnvironment, validateMediaFile } from '@repo/media';
/**
 * Protected avatar upload endpoint.
 *
 * POST /api/v1/protected/media/upload
 *
 * Accepts multipart/form-data with:
 * - `file` (required) image binary (JPEG, PNG, or WebP, max 5MB)
 *
 * Uploads to Cloudinary under hospeda/{env}/avatars/{userId}.
 * Always overwrites the existing avatar for the user.
 */
import { UploadResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Fixed avatar upload limit in bytes (5MB). */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/v1/protected/media/upload
 * Upload an avatar image for the authenticated user.
 */
export const protectedUploadAvatarRoute = createProtectedRoute({
    method: 'post',
    path: '/upload',
    summary: 'Upload user avatar',
    description:
        'Uploads a JPEG, PNG, or WebP avatar image (max 5MB) for the authenticated user. ' +
        'Overwrites any previously uploaded avatar.',
    tags: ['Media'],
    responseSchema: UploadResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>
    ) => {
        // ── 0. Provider availability check ───────────────────────────────────
        const provider = getMediaProvider();
        if (!provider) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'CLOUDINARY_NOT_CONFIGURED',
                        message: 'Media upload service is not configured'
                    }
                },
                503
            );
        }

        // ── 1. Content-Length pre-check ───────────────────────────────────────
        const contentLength = Number(ctx.req.header('content-length') ?? 0);
        if (contentLength > AVATAR_MAX_BYTES) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'PAYLOAD_TOO_LARGE',
                        message: 'Avatar file exceeds the 5MB limit'
                    }
                },
                413
            );
        }

        // ── 2. Parse multipart form data ──────────────────────────────────────
        let formData: FormData;
        try {
            formData = await ctx.req.formData();
        } catch {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid multipart form data' }
                },
                400
            );
        }

        // ── 3. Extract authenticated user ─────────────────────────────────────
        const actor = getActorFromContext(ctx);
        const userId = actor.id;

        // ── 4. Extract file ───────────────────────────────────────────────────
        const fileEntry = formData.get('file');
        if (!(fileEntry instanceof File)) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Missing required "file" field' }
                },
                400
            );
        }

        const arrayBuffer = await fileEntry.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ── 5. Validate file (size, MIME type, dimensions) ────────────────────
        const validation = validateMediaFile({
            buffer,
            mimeType: fileEntry.type,
            context: 'avatar'
        });

        if (!validation.valid) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'UNPROCESSABLE_ENTITY',
                        message: `Avatar validation failed: ${validation.error}`,
                        details: validation.details
                    }
                },
                422
            );
        }

        // ── 6. Build storage path ─────────────────────────────────────────────
        const environment = resolveEnvironment();
        const folder = `hospeda/${environment}/avatars`;

        // ── 7. Upload to Cloudinary ───────────────────────────────────────────
        let uploadResult: Awaited<ReturnType<typeof provider.upload>>;
        try {
            uploadResult = await provider.upload({
                file: buffer,
                folder,
                publicId: userId,
                overwrite: true
            });
        } catch (uploadError) {
            apiLogger.error(
                {
                    error: uploadError instanceof Error ? uploadError.message : String(uploadError),
                    userId
                },
                'Cloudinary avatar upload failed'
            );
            return ctx.json(
                {
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Avatar upload failed' }
                },
                502
            );
        }

        // ── 8. Validate upload response completeness ──────────────────────────
        if (!uploadResult.url || !uploadResult.publicId) {
            apiLogger.error(
                { uploadResult, userId },
                'Cloudinary response missing url or publicId'
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'UPSTREAM_ERROR',
                        message: 'Incomplete response from image service'
                    }
                },
                502
            );
        }

        // ── 9. Return result ──────────────────────────────────────────────────
        return {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            width: uploadResult.width,
            height: uploadResult.height
        };
    }
});
