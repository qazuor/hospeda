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
 * Listing access (HOS-1682): for the three verticals with a listing
 * (accommodation, gastronomy, experience) the route runs the listing access
 * chain (`enforceListingAccess`, operation EDIT) with the vertical of the
 * service branch, after the ownership check and before the gallery cap, the
 * file read and the provider call: listing state, coverage, capability and the
 * plan limit apply here as they do on the persisting `addMedia` routes.
 * Destination, event and post are not listings and do not run the chain.
 *
 * Every upload, the `featured` one included, creates a NEW asset under a
 * unique public id: an upload never overwrites an existing image.
 *
 * Response contract follows the admin upload pattern:
 *   - HTTP 200 on success.
 *   - Body wrapped via ResponseFactory as `{ success, data, metadata }`.
 *   - `data.moderationState` is always `'APPROVED'`.
 */
import { generateGalleryId } from '@repo/media';
import {
    ENTITY_GALLERY_CAPS,
    getGalleryCap,
    UploadResponseDataSchema,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    ExperienceService,
    PostService,
    VenueService
} from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { enforceListingAccess } from '../../../middlewares/listing-access';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import {
    buildEntityFolder,
    uploadToProvider,
    validateContentLength,
    validateFile
} from '../../../services/media/upload-helpers';
import type { ListingAccessConfig } from '../../../types/authorization';
import { getActorFromContext } from '../../../utils/actor';
import { accommodationGalleryPhotoLimit } from '../../../utils/listing-access/photo-limit';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';
import { type MediaEntityType, validateEntityMediaPermission } from '../admin/permissions';
import { mediaEntityNotFoundResponse } from '../entity-not-found';
import { resolveVisibleGalleryCount } from '../gallery-count';
import { parseUploadEntityForm } from './upload-entity-form';

/** Reusable Zod validator for actor.id UUID format. */
const ActorIdSchema = z.string().uuid();

const formatRetryAfterLabel = (retryAfterSec: number): string => {
    if (retryAfterSec < 60) {
        return `${retryAfterSec} segundo${retryAfterSec === 1 ? '' : 's'}`;
    }

    const minutes = Math.floor(retryAfterSec / 60);
    const seconds = retryAfterSec % 60;
    const minuteLabel = `${minutes} minuto${minutes === 1 ? '' : 's'}`;

    if (seconds === 0) {
        return minuteLabel;
    }

    return `${minuteLabel} y ${seconds} segundo${seconds === 1 ? '' : 's'}`;
};

const buildUploadRateLimitMessage = ({
    retryAfterSec
}: {
    readonly retryAfterSec: number;
}): string =>
    `Se alcanzó el límite temporal de subida de fotos. Intentá de nuevo en ${formatRetryAfterLabel(retryAfterSec)}.`;

/**
 * Burst allowance for one album, uploaded in a single pass.
 *
 * The cap PLUS ONE, because a complete album is `cap + 1` REQUESTS through this
 * one route: the gallery photos, plus the featured image, which uploads here too
 * (`role=featured`). Sizing the burst to the gallery cap alone left the featured
 * image as the one request that got refused — a 50-photo Premium album still
 * ended the pass on a 429.
 *
 * Reviewed under HOS-791 (AC-3) and kept. HOS-785 originally justified this `+1`
 * by saying the featured image shared the gallery's quota; that is no longer true
 * — the featured image is excluded from the cap now — but the `+1` never depended
 * on it. What sizes this limit is the request count of one upload pass, and that
 * is still `cap` gallery uploads plus one featured upload either way.
 */
const PROTECTED_ENTITY_UPLOAD_RATE_LIMIT_MAX = Math.max(...Object.values(ENTITY_GALLERY_CAPS)) + 1;

/**
 * Resolve an entity service per-request for ownership verification.
 */
const resolveEntityService = (
    entityType: string
):
    | AccommodationService
    | DestinationService
    | EventService
    | PostService
    | VenueService
    | ExperienceService
    | null => {
    switch (entityType) {
        case 'accommodation':
            return new AccommodationService({ logger: apiLogger });
        case 'destination':
            return new DestinationService({ logger: apiLogger });
        case 'event':
            return new EventService({ logger: apiLogger });
        case 'post':
            return new PostService({ logger: apiLogger });
        case 'venue':
            return new VenueService({ logger: apiLogger });
        case 'experience':
            return new ExperienceService({ logger: apiLogger });
        default:
            return null;
    }
};

/** One listing access declaration, in the `listingAccess:` shape G2 scans. */
type UploadListingAccess = { readonly listingAccess: ListingAccessConfig };

/**
 * Listing access of the upload, per listing vertical and role (HOS-1682).
 *
 * Each entry mirrors the persisting route the uploaded asset ends up in: the
 * accommodation gallery takes `addMedia`'s plan photo limit, the accommodation
 * featured image takes `addFeaturedMedia`'s `requested: 1`, and gastronomy and
 * experience declare no limit, like their own `addMedia`/`addFeaturedMedia`.
 * The vertical is named literally per branch: it is the vertical of the table
 * the service branch reads the listing from, never a value of the request.
 */
const UPLOAD_LISTING_ACCESS = {
    accommodationGallery: {
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            limit: accommodationGalleryPhotoLimit
        }
    },
    accommodationFeatured: {
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            limit: async () => ({ key: 'max_photos_per_accommodation', requested: 1 })
        }
    },
    venue: {
        listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' }
    },
    experience: {
        listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' }
    }
} satisfies Record<string, UploadListingAccess>;

/**
 * Resolve the listing access the upload runs, or `null` when the entity type
 * is not a listing (destination, event, post).
 *
 * @param input.entityType - The validated entity type; the same branch picks the service.
 * @param input.role - The validated upload role.
 * @returns The listing access config of that branch, or `null`.
 */
const resolveUploadListingAccess = ({
    entityType,
    role
}: {
    readonly entityType:
        | 'accommodation'
        | 'destination'
        | 'event'
        | 'post'
        | 'venue'
        | 'experience';
    readonly role: 'featured' | 'gallery';
}): ListingAccessConfig | null => {
    switch (entityType) {
        case 'accommodation':
            return role === 'gallery'
                ? UPLOAD_LISTING_ACCESS.accommodationGallery.listingAccess
                : UPLOAD_LISTING_ACCESS.accommodationFeatured.listingAccess;
        case 'venue':
            return UPLOAD_LISTING_ACCESS.venue.listingAccess;
        case 'experience':
            return UPLOAD_LISTING_ACCESS.experience.listingAccess;
        case 'destination':
        case 'event':
        case 'post':
            return null;
        default: {
            const exhaustive: never = entityType;
            throw new Error(`Unhandled upload entity type: ${String(exhaustive)}`);
        }
    }
};

/**
 * POST /api/v1/protected/media/upload-entity
 * Upload an entity image (featured or gallery) for the authenticated user's entity.
 *
 * Ownership check: the entity must have `ownerId === actor.id`.
 * Listing verticals also run listing access (HOS-1682).
 * Success status is 200; every upload creates a new asset.
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

        // ── 2-3. Parse the multipart form and validate its fields ─────────────
        const form = await parseUploadEntityForm({ ctx });
        if (!form.ok) return form.response;
        const { formData } = form;

        const { entityType, entityId, role } = form.fields;
        const tags = form.fields.tags;
        const overwrite = form.fields.overwrite;

        // ── 3b. Verify entity exists + ownership check ────────────────────────
        const service = resolveEntityService(entityType);
        if (!service) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    reason: 'UNSUPPORTED_ENTITY_TYPE',
                    message: `Unsupported entity type: ${entityType}`
                },
                ctx,
                400
            );
        }

        const entityResult = await service.getById(actor, entityId);
        if (entityResult.error || !entityResult.data) {
            return mediaEntityNotFoundResponse({ ctx });
        }

        // Ownership check.
        //
        // Entities that carry `ownerId` (accommodation, gastronomy, experience)
        // keep the original direct comparison, unchanged.
        //
        // The rest do not have that column at all. This code used to cast every
        // entity to `{ ownerId?: string | null }` regardless, so `!entity.ownerId`
        // was unconditionally true for them and the route answered 403 to
        // everyone — the author included — for `post`, `event` and `destination`.
        // Those fall through to the shared media permission policy, which
        // resolves them by authorship or by the entity's update permission.
        //
        // HOS-600: refusing here answers the SAME 404 as "no such entity"
        // above. A 403 told the caller their id was real — the exact
        // confirmation the contract's 404-for-foreign-rows rule exists to deny.
        const entity = entityResult.data as { ownerId?: string | null; authorId?: string | null };

        if (entity.ownerId !== undefined && entity.ownerId !== null) {
            if (entity.ownerId !== actor.id) {
                return mediaEntityNotFoundResponse({ ctx });
            }
        } else {
            const permissionCheck = validateEntityMediaPermission({
                actor,
                entityType: entityType as MediaEntityType,
                entity
            });

            if (!permissionCheck.allowed) {
                return mediaEntityNotFoundResponse({ ctx });
            }
        }

        // ── 3c. Listing access (HOS-1682) ─────────────────────────────────────
        // The three listing verticals run the chain: listing state, coverage,
        // capability and the plan limit. Its NOT_FOUND is answered with the
        // SAME body as "no such entity" (HOS-600); every other refusal is a
        // ServiceError the route factory maps (403 gates).
        const listingAccess = resolveUploadListingAccess({ entityType, role });
        if (listingAccess) {
            try {
                await enforceListingAccess({
                    ctx,
                    params: { id: entityId },
                    config: listingAccess,
                    tier: 'protected'
                });
            } catch (error) {
                if (error instanceof HTTPException && error.status === 404) {
                    return mediaEntityNotFoundResponse({ ctx });
                }
                throw error;
            }
        }

        // ── 3d. Enforce gallery cap ───────────────────────────────────────────
        if (role === 'gallery') {
            // Counted via the shared resolver so this path and the admin upload
            // path can never disagree about where an entity type's photos live —
            // see routes/media/gallery-count.ts.
            const currentGalleryCount = await resolveVisibleGalleryCount({
                entityType,
                entityId,
                entity: entityResult.data
            });
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
                {
                    code: 'VALIDATION_ERROR',
                    reason: 'MISSING_FILE',
                    message: 'Missing required "file" field'
                },
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
        // HOS-1682 (Coord-356): `featured` gets a unique public id like the
        // gallery. A fixed `featured` name could be overwritten from this route,
        // which persists nothing, without passing through `addFeaturedMedia`;
        // the effective cover is chosen by `setFeaturedMedia`, not by the name.
        const publicId =
            role === 'featured'
                ? `featured/${generateGalleryId()}`
                : `gallery/${generateGalleryId()}`;

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
                max: PROTECTED_ENTITY_UPLOAD_RATE_LIMIT_MAX,
                keyPrefix: 'upload:protected-entity',
                buildExceededMessage: buildUploadRateLimitMessage
            })
        ]
    }
});
