import { generateGalleryId, resolveEnvironment, validateMediaFile } from '@repo/media';
/**
 * Admin media upload endpoint.
 *
 * POST /api/v1/admin/media/upload
 *
 * Accepts multipart/form-data with:
 * - `file`       (required) image binary
 * - `entityType` (required) one of: accommodation, destination, event, post
 * - `entityId`   (required) UUID of the target entity
 * - `role`       (required) one of: featured, gallery
 *
 * Validates file size, MIME type, and image dimensions before uploading
 * to Cloudinary. Returns the resulting URL, publicId, width, and height.
 */
import { AdminUploadRequestSchema, UploadResponseSchema } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/** Default maximum file size in MB when HOSPEDA_MEDIA_MAX_FILE_SIZE_MB is unset. */
const DEFAULT_MAX_MB = 10;

/** Service instances for entity existence validation. */
const accommodationService = new AccommodationService({ logger: apiLogger });
const destinationService = new DestinationService({ logger: apiLogger });
const eventService = new EventService({ logger: apiLogger });
const postService = new PostService({ logger: apiLogger });

const entityServices: Record<
    string,
    AccommodationService | DestinationService | EventService | PostService
> = {
    accommodation: accommodationService,
    destination: destinationService,
    event: eventService,
    post: postService
};

/**
 * POST /api/v1/admin/media/upload
 * Upload an image for a content entity. Admin only.
 */
export const adminUploadMediaRoute = createAdminRoute({
    method: 'post',
    path: '/upload',
    summary: 'Upload entity image',
    description:
        'Uploads an image (featured or gallery) for a content entity (accommodation, destination, event, post). ' +
        'Accepts multipart/form-data. Returns the Cloudinary URL and asset metadata.',
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

        // ── 1. Content-Length pre-check (anti-DoS) ────────────────────────────
        const maxMb = Number(process.env.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB ?? DEFAULT_MAX_MB);
        const maxBytes = maxMb * 1024 * 1024;
        const contentLength = Number(ctx.req.header('content-length') ?? 0);

        if (contentLength > maxBytes) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'PAYLOAD_TOO_LARGE',
                        message: `File exceeds the ${maxMb}MB limit`
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

        // ── 3. Validate form fields with Zod ──────────────────────────────────
        const rawFields = {
            entityType: formData.get('entityType'),
            entityId: formData.get('entityId'),
            role: formData.get('role')
        };

        const parseResult = AdminUploadRequestSchema.safeParse(rawFields);
        if (!parseResult.success) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid form fields',
                        details: parseResult.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message
                        }))
                    }
                },
                400
            );
        }

        const { entityType, entityId, role } = parseResult.data;

        // ── 3b. Verify entity exists in DB ────────────────────────────────────
        const actor = getActorFromContext(ctx);
        const service = entityServices[entityType];
        if (!service) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Unsupported entity type: ${entityType}`
                    }
                },
                400
            );
        }
        const entityResult = await service.getById(actor, entityId);

        if (entityResult.error || !entityResult.data) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'ENTITY_NOT_FOUND',
                        message: `Entity not found: ${entityType} with id ${entityId}`,
                        entityType,
                        entityId
                    }
                },
                404
            );
        }

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
            context: 'entity',
            maxFileSizeMb: maxMb
        });

        if (!validation.valid) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'UNPROCESSABLE_ENTITY',
                        message: `File validation failed: ${validation.error}`,
                        details: validation.details
                    }
                },
                422
            );
        }

        // ── 6. Build storage path ─────────────────────────────────────────────
        const environment = resolveEnvironment();
        const folder = `hospeda/${environment}/${entityType}s/${entityId}`;
        const publicId = role === 'featured' ? 'featured' : `gallery/${generateGalleryId()}`;

        // ── 7. Upload to Cloudinary ───────────────────────────────────────────
        let uploadResult: Awaited<ReturnType<typeof provider.upload>>;
        try {
            uploadResult = await provider.upload({ file: buffer, folder, publicId });
        } catch (uploadError) {
            apiLogger.error(
                {
                    error: uploadError instanceof Error ? uploadError.message : String(uploadError),
                    entityType,
                    entityId
                },
                'Cloudinary upload failed'
            );
            return ctx.json(
                {
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Image upload failed' }
                },
                502
            );
        }

        // ── 8. Validate upload response completeness ──────────────────────────
        if (!uploadResult.url || !uploadResult.publicId) {
            apiLogger.error(
                { uploadResult, entityType, entityId },
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
