/**
 * POST /api/v1/protected/gastronomies/:id/menu-item-photo
 *
 * Uploads ONE dish photo and hands back the URL for the client to attach to a
 * dish in the carta document (HOS-1045).
 *
 * ## Why this route does NOT write a row, when `menu-file` does
 *
 * `POST .../menu-file` persists in the same request, and its docblock explains
 * why: an asset that lands in Cloudinary while the association waits for a form
 * Save is an asset that bills with nothing pointing at it (HOS-372). That rule
 * is right, and this route cannot follow it — not because the cost is smaller,
 * but because there is nothing to write TO. The menu-file's target is a column
 * on the listing, which exists. A dish photo's target is a `gastronomy_menu_items`
 * row whose id is minted afresh on every `PUT .../menu` (the carta is replaced
 * as a whole document), so at upload time the dish may not exist at all and,
 * if it does, its id will not survive the next save.
 *
 * What that costs is bounded and named rather than hidden: an owner who uploads
 * a dish photo and then abandons the editor without saving leaves one orphaned
 * Cloudinary asset. The same window already exists for the listing gallery,
 * where the shared upload endpoint runs before `POST .../media` persists the
 * row. It is narrowed here the same way that path narrows it — an ownership
 * check and an entitlement check BEFORE a single byte is read, plus a small
 * per-user rate limit — and `photo_public_id` is round-tripped into the row so
 * a sweeper can destroy what it finds instead of merely forgetting it.
 *
 * ## Order of refusals
 *
 * 1. **Authentication** — `createProtectedRoute`.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's GASTRONOMY grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `MENU_ITEM_PHOTOS`. The loader MUST stay
 *    ahead of the gate: the global `entitlementMiddleware` has already put the
 *    ACCOMMODATION set in the context, and that set never carries a commerce key
 *    (HOS-1074).
 * 3. **Ownership**, as a 404 — before the body is parsed, so a caller who does
 *    not own the listing cannot spend our Cloudinary quota, and so no 403 ever
 *    confirms that the id exists.
 *
 * Only `MENU_ITEM_PHOTOS` is required, not `MANAGE_GASTRONOMY_MENU` alongside
 * it, even though today the one plan granting the first also grants the second.
 * Stacking both would make this route dead the day a plan is defined that
 * grants photos without the carta — a catalogue decision this route has no
 * business pre-empting.
 *
 * @module routes/gastronomy/protected/uploadMenuItemPhoto
 */
import { EntitlementKey } from '@repo/billing';
import { GastronomyMenuItemPhotoUploadOutputSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
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
            }),
            // Loader before checker (HOS-1074) — the global entitlement
            // middleware resolves the ACCOMMODATION set, which never carries a
            // commerce key, so `commerceVerticalEntitlementMiddleware` MUST run
            // before `requireEntitlement` on every commerce route.
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MENU_ITEM_PHOTOS)
        ]
    }
});
