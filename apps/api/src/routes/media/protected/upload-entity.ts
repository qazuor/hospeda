/**
 * Protected media upload endpoint for entity images.
 *
 * POST /api/v1/protected/media/upload-entity
 *
 * Accepts multipart/form-data with:
 * - `file`       (required) image binary
 * - `entityType` (required) one of: accommodation, destination, event, post
 * - `entityId`   (required) UUID of the target entity
 * - `role`       (required) one of: featured, gallery
 *
 * Performs an ownership check: the entity must belong to the authenticated
 * user. Validates file size, MIME type, and image dimensions before uploading
 * to Cloudinary. Returns the resulting URL, publicId, width, and height.
 *
 * Response contract follows the admin upload pattern:
 *   - HTTP 200 on success (uploads may overwrite existing assets).
 *   - Body wrapped via ResponseFactory as `{ success, data, metadata }`.
 *   - `data.moderationState` is always `'APPROVED'`.
 */
import { generateGalleryId } from '@repo/media';
import {
    ProtectedUploadEntityRequestSchema,
    UploadResponseDataSchema,
    getGalleryCap
} from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import {
    buildEntityFolder,
    uploadToProvider,
    validateContentLength,
    validateFile
} from '../../../services/media/upload-helpers';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Reusable Zod validator for actor.id UUID format. */
const ActorIdSchema = z.string().uuid();

/**
 * Resolve an entity service per-request for ownership verification.
 */
const resolveEntityService = (
    entityType: string
): AccommodationService | DestinationService | EventService | PostService | null => {
    switch (entityType) {
        case 'accommodation':
            return new AccommodationService({ logger: apiLogger });
        case 'destination':
            return new DestinationService({ logger: apiLogger });
        case 'event':
            return new EventService({ logger: apiLogger });
        case 'post':
            return new PostService({ logger: apiLogger });
        default:
            return null;
    }
};

/**
 * POST /api/v1/protected/media/upload-entity
 * Upload an entity image (featured or gallery) for the authenticated user's entity.
 *
 * Ownership check: the entity must have `ownerId === actor.id`.
 * Success status is 200 (uploads may overwrite existing assets).
 */
export const protectedUploadEntityRoute = createProtectedRoute({
    method: 'post',
    path: '/upload-entity',
    summary: 'Upload entity image (owner only)',
    description:
        'Uploads an image (featured or gallery) for a content entity owned by the authenticated user. ' +
        'Accepts multipart/form-data. Returns the Cloudinary URL and asset metadata.',
    tags: ['Media'],
    responseSchema: UploadResponseDataSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>
    ) => {
        // ── 0a. Cache-Control header — never cache upload responses.
        ctx.header('Cache-Control', 'no-store');

        // ── 0. Provider availability check ───────────────────────────────────
        const provider = getMediaProvider();
        if (!provider) {
            return createErrorResponse(
                {
                    code: 'CLOUDINARY_NOT_CONFIGURED',
                    message: 'Media upload service is not configured'
                },
                ctx,
                503
            );
        }

        // ── 1. Content-Length pre-check ───────────────────────────────────────
        const contentLength = Number(ctx.req.header('content-length') ?? 0);
        const lengthError = validateContentLength(contentLength);
        if (lengthError) {
            return createErrorResponse(lengthError, ctx, lengthError.status);
        }

        // ── 1b. Validate actor.id is a UUID ──────────────────────────────────
        const actor = getActorFromContext(ctx);
        const actorIdCheck = ActorIdSchema.safeParse(actor.id);
        if (!actorIdCheck.success) {
            apiLogger.error(
                { issue: actorIdCheck.error.issues[0]?.code ?? 'invalid_string' },
                'Refusing media upload: actor.id is not a valid UUID'
            );
            return createErrorResponse(
                { code: 'INTERNAL_ERROR', message: 'Internal server error' },
                ctx,
                500
            );
        }

        // ── 1c. Re-verify session ────────────────────────────────────────────
        const currentSessionUser = ctx.get('user') as { id?: string } | undefined;
        const currentSession = ctx.get('session') as { userId?: string } | undefined;
        const liveActorId = currentSessionUser?.id ?? currentSession?.userId;
        const sessionContextPresent = Boolean(currentSessionUser) || Boolean(currentSession);
        if (sessionContextPresent && liveActorId !== actor.id) {
            apiLogger.warn(
                { hadSession: Boolean(currentSession), hadUser: Boolean(currentSessionUser) },
                'Aborting media upload: session no longer matches actor'
            );
            return createErrorResponse(
                {
                    code: 'SESSION_STALE',
                    message: 'Session expired or revoked. Please re-authenticate.'
                },
                ctx,
                401
            );
        }

        // ── 2. Parse multipart form data ──────────────────────────────────────
        let formData: FormData;
        try {
            formData = await ctx.req.formData();
        } catch {
            return createErrorResponse(
                { code: 'VALIDATION_ERROR', message: 'Invalid multipart form data' },
                ctx,
                400
            );
        }

        // ── 3. Validate form fields with Zod ──────────────────────────────────
        const rawTags = formData.get('tags');
        const tagsArray =
            typeof rawTags === 'string' && rawTags.length > 0
                ? rawTags
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter((tag) => tag.length > 0)
                : undefined;

        const rawOverwrite = formData.get('overwrite');
        const overwriteBool =
            typeof rawOverwrite === 'string'
                ? rawOverwrite === 'true'
                    ? true
                    : rawOverwrite === 'false'
                      ? false
                      : undefined
                : undefined;

        const rawFields = {
            entityType: formData.get('entityType'),
            entityId: formData.get('entityId'),
            role: formData.get('role'),
            ...(tagsArray !== undefined ? { tags: tagsArray } : {}),
            ...(overwriteBool !== undefined ? { overwrite: overwriteBool } : {})
        };

        const parseResult = ProtectedUploadEntityRequestSchema.safeParse(rawFields);
        if (!parseResult.success) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid form fields',
                    details: parseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                ctx,
                400
            );
        }

        const { entityType, entityId, role } = parseResult.data;
        const tags = parseResult.data.tags;
        const overwrite = parseResult.data.overwrite;

        // ── 3b. Verify entity exists + ownership check ────────────────────────
        const service = resolveEntityService(entityType);
        if (!service) {
            return createErrorResponse(
                { code: 'VALIDATION_ERROR', message: `Unsupported entity type: ${entityType}` },
                ctx,
                400
            );
        }

        const entityResult = await service.getById(actor, entityId);
        if (entityResult.error || !entityResult.data) {
            return createErrorResponse(
                {
                    code: 'ENTITY_NOT_FOUND',
                    message: `Entity not found: ${entityType} with id ${entityId}`,
                    details: { entityType, entityId }
                },
                ctx,
                404
            );
        }

        // Ownership check: entity must belong to the authenticated user.
        const entity = entityResult.data as { ownerId?: string | null };
        if (!entity.ownerId || entity.ownerId !== actor.id) {
            return createErrorResponse(
                { code: 'FORBIDDEN', message: 'You do not own this entity' },
                ctx,
                403
            );
        }

        // ── 3d. Enforce gallery cap ───────────────────────────────────────────
        if (role === 'gallery') {
            const entityMedia = (entityResult.data as { media?: { gallery?: unknown[] } }).media;
            const currentGalleryCount = entityMedia?.gallery?.length ?? 0;
            const galleryLimit = getGalleryCap(entityType);
            if (currentGalleryCount >= galleryLimit) {
                return createErrorResponse(
                    {
                        code: 'GALLERY_LIMIT_EXCEEDED',
                        message: `Gallery limit of ${galleryLimit} items reached for this entity`,
                        details: {
                            entityType,
                            entityId,
                            currentCount: currentGalleryCount,
                            limit: galleryLimit
                        }
                    },
                    ctx,
                    422
                );
            }
        }

        // ── 4. Extract file ───────────────────────────────────────────────────
        const fileEntry = formData.get('file');
        if (!(fileEntry instanceof File)) {
            return createErrorResponse(
                { code: 'VALIDATION_ERROR', message: 'Missing required "file" field' },
                ctx,
                400
            );
        }

        if (fileEntry.size === 0) {
            return createErrorResponse(
                { code: 'EMPTY_FILE', message: 'Uploaded file is empty' },
                ctx,
                422
            );
        }

        const arrayBuffer = await fileEntry.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ── 5. Validate file ──────────────────────────────────────────────────
        const fileError = validateFile(buffer, fileEntry.type);
        if (fileError) {
            return createErrorResponse(fileError, ctx, fileError.status);
        }

        // ── 6. Build storage path ─────────────────────────────────────────────
        const folder = buildEntityFolder(entityType, entityId);
        const publicId = role === 'featured' ? 'featured' : `gallery/${generateGalleryId()}`;

        // ── 7. Upload to Cloudinary ───────────────────────────────────────────
        const result = await uploadToProvider(provider, {
            buffer,
            folder,
            publicId,
            tags,
            overwrite,
            entityType,
            entityId,
            actorId: actor.id
        });

        if ('code' in result) {
            return createErrorResponse(result, ctx, result.status);
        }

        return result;
    },
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 10,
                keyPrefix: 'upload:protected-entity'
            })
        ]
    }
});
