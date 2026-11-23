/**
 * Partner logo upload for the caller's OWN partner listing (HOS-2506, D13).
 *
 * ```
 * POST /api/v1/protected/partners/mine/logo
 * ```
 *
 * Accepts `multipart/form-data` with a single `file` field (JPEG, PNG or WebP)
 * and answers the Cloudinary URL. It persists NOTHING: the web form then sends
 * that URL as `logoUrl` through `PATCH /partners/mine`, which is the path that
 * parks the change for admin review (§6.3 step 4). Uploading a file therefore
 * never makes a logo live by itself.
 *
 * Why this is not the avatar endpoint: `POST /media/upload` writes under a FIXED
 * public id (the user's id) with `overwrite: true`, so reusing it would replace
 * the partner's own profile photo and tie the logo to every future avatar
 * change. Why it is not `upload-entity` either: that route only knows
 * accommodation, destination, event, post, venue and experience.
 *
 * Like `GET|PATCH /mine`, the path carries no id. The partner is resolved from
 * the actor, so uploading under somebody else's listing is unreachable rather
 * than checked. Every upload creates a NEW asset under a unique public id and
 * never overwrites an earlier logo, so a rejected or replaced logo can never
 * alter what is currently published.
 *
 * @module routes/partners/protected/mine-logo
 */

import { generateGalleryId } from '@repo/media';
import { PermissionEnum, ServiceErrorCode, UploadResponseDataSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
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

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * Handler for the logo upload. Exported standalone so it is unit-testable
 * against a mocked `Context` without booting Hono.
 *
 * @param ctx - The Hono request context (multipart body)
 * @returns The upload result, or an error response
 */
export async function handleUploadMyPartnerLogo(ctx: Context) {
    // The response carries a freshly minted asset URL; never cache it.
    ctx.header('Cache-Control', 'no-store');

    const actor = getActorFromContext(ctx);

    // Resolve the listing from the actor before reading the body: an account
    // with no partner listing has nothing to upload for.
    const owned = await partnerService.getOwn(actor);
    if (owned.error) {
        throw new ServiceError(owned.error.code, owned.error.message);
    }
    const partner = owned.data?.partner ?? null;
    if (partner === null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'No partner listing is owned by this account'
        );
    }

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

    const lengthError = validateContentLength(Number(ctx.req.header('content-length') ?? 0));
    if (lengthError) {
        return createErrorResponse(lengthError, ctx, lengthError.status);
    }

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

    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    const fileError = validateFile(buffer, fileEntry.type);
    if (fileError) {
        return createErrorResponse(fileError, ctx, fileError.status);
    }

    const result = await uploadToProvider(provider, {
        buffer,
        folder: buildEntityFolder('partner', partner.id),
        publicId: `logo/${generateGalleryId()}`,
        overwrite: false,
        entityType: 'partner',
        entityId: partner.id,
        actorId: actor.id
    });

    if ('code' in result) {
        return createErrorResponse(result, ctx, result.status);
    }

    return result;
}

/**
 * POST /api/v1/protected/partners/mine/logo
 *
 * Uploads a logo image for the caller's own partner listing and answers its
 * URL. Requires the partner owner family (`partner.editOwn`), the same gate as
 * the PATCH that saves it.
 */
export const protectedUploadMyPartnerLogoRoute = createProtectedRoute({
    method: 'post',
    path: '/mine/logo',
    summary: "Upload the caller's own partner logo",
    description:
        'Requires the partner owner family (partner.editOwn). Uploads a JPEG, PNG or WebP logo to the media provider under the caller’s own partner folder and returns its URL. Persists nothing: the URL is then saved through PATCH /partners/mine, which sends the change to admin review.',
    tags: ['Partners'],
    responseSchema: UploadResponseDataSchema,
    successStatusCode: 200,
    handler: async (ctx: Context) => handleUploadMyPartnerLogo(ctx),
    requiredPermissions: [PermissionEnum.PARTNER_EDIT_OWN],
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 10,
                keyPrefix: 'upload:partner-logo'
            })
        ]
    }
});
