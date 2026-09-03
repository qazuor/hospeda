/**
 * POST /api/v1/protected/gastronomies/:id/menu-file
 *
 * Uploads a photo or a PDF of the venue's printed menu (HOS-895) — the
 * alternative for the restaurant that will not type its carta dish by dish.
 *
 * ## Why the row is written HERE, in the upload request
 *
 * This is the one part of HOS-895 that is a real uploaded asset, so it inherits
 * `gastronomy_media`'s rule rather than the carta's. HOS-372's finding: the
 * file used to land in Cloudinary immediately while the DB association waited
 * for the form's Save, so an owner who uploaded and walked away left the asset
 * billing with nothing pointing at it. The upload and the
 * `gastronomies.menu_file_*` write are therefore ONE request, and the menu
 * document (`PUT .../menu`) does not carry the file at all.
 *
 * ## Why NOT the shared `media/upload-entity` endpoint
 *
 * Three reasons, and the third is the decisive one:
 *
 *  - `validateMediaFile` allowlists IMAGE MIME types; a PDF is rejected as
 *    `INVALID_FILE_TYPE`.
 *  - It then parses dimensions with `image-size`, and a PDF has none.
 *  - `UploadResponseDataSchema` requires `width`/`height`, so even a successful
 *    PDF upload could not be described by that endpoint's response.
 *
 * Widening the shared validator would change the contract for every existing
 * image caller — including the avatar path — to accommodate one route. The
 * image branch below therefore still goes through the shared, battle-tested
 * `validateFile`; only the PDF branch is new, and it is deliberately small:
 * a size cap plus a magic-byte check.
 *
 * ## Not gated on `MANAGE_GASTRONOMY_MENU`
 *
 * The uploaded menu is how a `-basico` venue shows a menu at all. Gating it
 * would take away something every gastronomy tier has had since SPEC-239. Only
 * the STRUCTURED carta is the paid capability. See `putMenu.ts`.
 *
 * @module routes/gastronomy/protected/uploadMenuFile
 */
import {
    type GastronomyMenuFileKind,
    GastronomyMenuFileUploadOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import {
    buildEntityFolder,
    getEntityMaxFileSizeMb,
    validateContentLength,
    validateFile
} from '../../../services/media/upload-helpers';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** MIME type of a PDF, the one non-image this route accepts. */
const PDF_MIME_TYPE = 'application/pdf';

/**
 * The five bytes every PDF starts with (`%PDF-`).
 *
 * Checked for the same reason `validateMediaFile` checks image signatures
 * (GAP-078-103/104): a `Content-Type` header is supplied by the caller and
 * proves nothing about the bytes behind it.
 */
const PDF_MAGIC_BYTES = Buffer.from('%PDF-', 'ascii');

/**
 * Upload budget for this route.
 *
 * A menu is uploaded once and replaced rarely, so the allowance is small on
 * purpose — this is a route that writes to Cloudinary, and the ordinary use has
 * no burst at all.
 */
const MENU_FILE_UPLOAD_RATE_LIMIT_MAX = 10;

/**
 * Validates a PDF buffer: nothing but the size cap and the signature.
 *
 * There is no dimension check and no decompression-bomb guard, because neither
 * concept applies — those exist in `validateMediaFile` to stop `image-size`
 * from being handed a hostile raster, and this file is never rasterised by us.
 *
 * @param buffer - The parsed file bytes.
 * @returns `null` when the buffer is an acceptable PDF, an error otherwise.
 */
function validatePdf(buffer: Buffer): { code: string; message: string; status: number } | null {
    const maxBytes = getEntityMaxFileSizeMb() * 1024 * 1024;
    if (buffer.length > maxBytes) {
        return {
            code: 'PAYLOAD_TOO_LARGE',
            message: `File exceeds the ${getEntityMaxFileSizeMb()}MB limit`,
            status: 413
        };
    }

    if (!buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
        return {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'File validation failed: MIME_MISMATCH',
            status: 422
        };
    }

    return null;
}

export const protectedUploadGastronomyMenuFileRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/menu-file',
    summary: 'Upload a photo or PDF of the menu',
    description:
        'Uploads a photo or a PDF of the venue’s printed menu and stores it on the listing in the same request. Owner-only. Available on every gastronomy tier — only the structured menu is a paid capability.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyMenuFileUploadOutputSchema,
    successStatusCode: 200,
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
        // Before the file is parsed, let alone uploaded: a caller who does not
        // own the listing must not be able to spend our Cloudinary quota. The
        // 404 rather than 403 is the error contract's anti-enumeration rule —
        // a 403 would confirm the id exists.
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

        const buffer = Buffer.from(await fileEntry.arrayBuffer());
        const isPdf = fileEntry.type === PDF_MIME_TYPE;

        // ── 4. Validate ──────────────────────────────────────────────────────
        // The image branch is the SHARED validator, unchanged: allowlist,
        // magic bytes, dimensions and the decompression-bomb guard. Only the
        // PDF branch is local, and only because none of the last three apply.
        const fileError = isPdf ? validatePdf(buffer) : validateFile(buffer, fileEntry.type);
        if (fileError) {
            return createErrorResponse(fileError, ctx, fileError.status);
        }

        // ── 5. Upload ────────────────────────────────────────────────────────
        // A FIXED public id, so re-uploading replaces the previous menu instead
        // of accumulating one asset per correction — the listing holds exactly
        // one menu file, and `overwrite` is what keeps Cloudinary agreeing.
        //
        // `resourceType: 'auto'` because the same route stores both kinds and
        // the default (`'image'`) would make Cloudinary try to rasterise the
        // PDF.
        const folder = buildEntityFolder('gastronomy', gastronomyId);

        let uploaded: Awaited<ReturnType<typeof provider.upload>>;
        try {
            uploaded = await provider.upload({
                file: buffer,
                folder,
                publicId: 'menu-file',
                overwrite: true,
                resourceType: 'auto'
            });
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    gastronomyId
                },
                'Gastronomy menu-file upload failed'
            );
            return createErrorResponse(
                { code: 'UPSTREAM_ERROR', message: 'Menu file upload failed' },
                ctx,
                502
            );
        }

        // ── 6. Persist, in this same request ─────────────────────────────────
        // The whole reason this route exists rather than a field on the editor
        // PATCH. `menuFilePublicId` is stored alongside the URL so the delete
        // route can destroy the asset instead of merely forgetting it.
        const kind: GastronomyMenuFileKind = isPdf ? 'pdf' : 'image';

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`,
        // the same accessor the FAQ and media routes use.
        const model = (
            gastronomyService as unknown as {
                model: {
                    update: (
                        where: Record<string, unknown>,
                        data: Record<string, unknown>
                    ) => Promise<unknown>;
                };
            }
        ).model;

        await model.update(
            { id: gastronomyId },
            {
                menuFileUrl: uploaded.url,
                menuFilePublicId: uploaded.publicId,
                menuFileKind: kind,
                updatedById: actor.id
            }
        );

        return { file: { url: uploaded.url, kind } };
    },
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: MENU_FILE_UPLOAD_RATE_LIMIT_MAX,
                keyPrefix: 'upload:gastronomy-menu-file'
            })
        ]
    }
});
