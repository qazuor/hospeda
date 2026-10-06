/**
 * POST /api/v1/protected/gastronomies/:id/menu-item-photo
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import { GastronomyMenuItemPhotoUploadOutputSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import {
    buildEntityFolder,
    validateContentLength,
    validateFile
} from '../../../services/media/upload-helpers';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Upload budget for this route, per user per minute.
 *
 * Larger than the menu-file's 10, because loading a carta is genuinely a burst:
 * an owner photographing a twenty-dish menu uploads twenty times in a sitting,
 * and a budget sized for the one-off attachment would refuse honest work.
 * Still bounded, because every call spends Cloudinary quota before any row
 * exists to justify it.
 */
const MENU_ITEM_PHOTO_UPLOAD_RATE_LIMIT_MAX = 40;

export const protectedUploadGastronomyMenuItemPhotoRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/menu-item-photo',
    summary: 'Upload a photo for one dish of the menu',
    description:
        'Uploads a single dish photo and returns its delivery URL and Cloudinary public id. The caller attaches them to a dish in the next PUT /{id}/menu. Owner-only, and requires the menu_item_photos entitlement granted by the premium gastronomy plan.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyMenuItemPhotoUploadOutputSchema,
    successStatusCode: 200,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MENU_ITEM_PHOTOS entitlement gate.
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        ctx.header('Cache-Control', 'no-store');

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

        // ── 1. Content-Length pre-check, before the body is read ─────────────
        const contentLength = Number(ctx.req.header('content-length') ?? 0);
        const lengthError = validateContentLength(contentLength);
        if (lengthError) {
            return createErrorResponse(lengthError, ctx, lengthError.status);
        }

        // ── 2. Ownership, answered as 404 ────────────────────────────────────
        const actor = getActorFromContext(ctx);
        const gastronomyId = params.id as string;
        const listing = await gastronomyService.getById(actor, gastronomyId);
        const hasEditAll = actor.permissions?.includes(PermissionEnum.COMMERCE_EDIT_ALL);

        if (
            listing.error ||
            !listing.data ||
            (!hasEditAll && listing.data.ownerId !== actor.id) ||
            (!hasEditAll && !actor.permissions?.includes(PermissionEnum.COMMERCE_EDIT_OWN))
        ) {
            return createErrorResponse(
                { code: 'NOT_FOUND', message: 'Gastronomy listing not found' },
                ctx,
                404
            );
        }

        // ── 3. Parse the multipart body ──────────────────────────────────────
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
                { code: 'VALIDATION_ERROR', message: 'Missing file field' },
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

        // ── 4. Validate ──────────────────────────────────────────────────────
        // The SHARED validator, unchanged and with no local branch: unlike the
        // menu attachment, a dish photo is an IMAGE and nothing else. There is
        // no reason to accept a PDF of one dish, so the allowlist, the magic
        // bytes, the dimension parse and the decompression-bomb guard all apply
        // exactly as they do to every other image the platform takes.
        const buffer = Buffer.from(await fileEntry.arrayBuffer());
        const fileError = validateFile(buffer, fileEntry.type);
        if (fileError) {
            return createErrorResponse(fileError, ctx, fileError.status);
        }

        // ── 5. Upload ────────────────────────────────────────────────────────
        // NO fixed public id, which is the one place this differs from the
        // menu-file upload. That route pins `menu-file` and overwrites, because
        // a listing holds exactly one attachment. A carta holds as many photos
        // as it has dishes, so a fixed id would make every upload destroy the
        // previous dish's picture.
        const folder = buildEntityFolder('gastronomy', gastronomyId);

        let uploaded: Awaited<ReturnType<typeof provider.upload>>;
        try {
            uploaded = await provider.upload({ file: buffer, folder });
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    gastronomyId
                },
                'Gastronomy menu-item photo upload failed'
            );
            return createErrorResponse(
                { code: 'UPSTREAM_ERROR', message: 'Menu item photo upload failed' },
                ctx,
                502
            );
        }

        // No DB write — see this module's docblock. The client carries these two
        // values into the carta document, and `PUT .../menu` is what persists
        // them onto the dish.
        return { url: uploaded.url, publicId: uploaded.publicId };
    },
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: MENU_ITEM_PHOTO_UPLOAD_RATE_LIMIT_MAX,
                keyPrefix: 'upload:gastronomy-menu-item-photo'
            })
        ]
    }
});
