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
import { AdminUploadRequestSchema, PermissionEnum, UploadResponseSchema } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { type MediaEntityType, validateEntityMediaPermission } from './permissions';

/**
 * Reusable Zod validator for actor.id. Centralized here so the
 * defensive UUID check in this route stays single-sourced.
 *
 * GAP-078-058 + GAP-078-175: actor.id MUST be a valid UUID before being
 * used as part of any storage path or publicId component.
 */
const ActorIdSchema = z.string().uuid();

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
    path: '/',
    summary: 'Upload entity image',
    description:
        'Uploads an image (featured or gallery) for a content entity (accommodation, destination, event, post). ' +
        'Accepts multipart/form-data. Returns the Cloudinary URL and asset metadata.',
    tags: ['Media'],
    requiredPermissions: [PermissionEnum.MEDIA_UPLOAD],
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
        const maxMb = env.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB;
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

        // ── 1b. Validate actor.id is a UUID BEFORE it can flow into any
        // provider call or storage path component (GAP-078-058 + GAP-078-175).
        // Sanitize the response: never echo the offending actor.id back.
        // We perform this check early (before multipart parsing) because
        // actor.id is unconditionally used downstream and must never reach
        // the provider layer in invalid form.
        const actor = getActorFromContext(ctx);
        const actorIdCheck = ActorIdSchema.safeParse(actor.id);
        if (!actorIdCheck.success) {
            apiLogger.error(
                { issue: actorIdCheck.error.issues[0]?.code ?? 'invalid_string' },
                'Refusing media upload: actor.id is not a valid UUID'
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Internal server error'
                    }
                },
                500
            );
        }

        // ── 1c. Re-verify session BEFORE the heavy work (GAP-078-114).
        // Compares actor.id against the user/session already resolved into the
        // Hono context by authMiddleware, so this is a memory comparison and
        // does NOT hit the auth DB again. If a session/user is present we MUST
        // require it matches actor.id — a mismatch indicates the session was
        // replaced or revoked between route entry and now, and we abort with
        // 401. If neither is present (e.g. test mode with x-mock-actor-* only,
        // where authMiddleware never resolves a real session) there is nothing
        // to compare, and we proceed.
        // The check is performed early so it ALSO short-circuits before the
        // multipart parse, the entity DB lookup, and most importantly the
        // provider.upload call further below.
        const currentSessionUser = ctx.get('user') as { id?: string } | undefined;
        const currentSession = ctx.get('session') as { userId?: string } | undefined;
        const liveActorId = currentSessionUser?.id ?? currentSession?.userId;
        const sessionContextPresent = Boolean(currentSessionUser) || Boolean(currentSession);
        if (sessionContextPresent && liveActorId !== actor.id) {
            apiLogger.warn(
                {
                    hadSession: Boolean(currentSession),
                    hadUser: Boolean(currentSessionUser)
                },
                'Aborting media upload: session no longer matches actor at provider call'
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'SESSION_STALE',
                        message: 'Session expired or revoked. Please re-authenticate.'
                    }
                },
                401
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

        // ── 3c. Validate entity-specific permission (defense in depth) ───────
        const permissionCheck = validateEntityMediaPermission({
            actor,
            entityType: entityType as MediaEntityType,
            entity: entityResult.data as { ownerId?: string | null }
        });

        if (!permissionCheck.allowed) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message:
                            permissionCheck.reason === 'NOT_ENTITY_OWNER'
                                ? 'You do not own this entity'
                                : `Insufficient permissions to modify ${entityType} media`
                    }
                },
                403
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

        // ── 6b. Re-verify session right before provider call (GAP-078-114).
        // Defense-in-depth: even though we performed the same check at step
        // 1c before parsing the body, we re-check immediately before the
        // provider call so any context-mutating middleware that ran in
        // between cannot smuggle in a stale or replaced session.
        const sessionUserPre = ctx.get('user') as { id?: string } | undefined;
        const sessionPre = ctx.get('session') as { userId?: string } | undefined;
        const liveActorIdPre = sessionUserPre?.id ?? sessionPre?.userId;
        const sessionPresentPre = Boolean(sessionUserPre) || Boolean(sessionPre);
        if (sessionPresentPre && liveActorIdPre !== actor.id) {
            apiLogger.warn(
                { hadSession: Boolean(sessionPre), hadUser: Boolean(sessionUserPre) },
                'Aborting media upload: session no longer matches actor at provider call'
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'SESSION_STALE',
                        message: 'Session expired or revoked. Please re-authenticate.'
                    }
                },
                401
            );
        }

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
