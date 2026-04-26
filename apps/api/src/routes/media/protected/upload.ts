import { resolveEnvironment, validateMediaFile } from '@repo/media/server';
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
 *
 * Response contract (SPEC-078-GAPS T-029):
 *   - HTTP 200 on success (avatars are always overwrites — not a creation).
 *   - Body is wrapped via `ResponseFactory` (`createResponse`) as
 *     `{ success: true, data: {...}, metadata: {...} }`.
 *   - `data.moderationState` is always `'APPROVED'`.
 *   - The provider response is validated with `UploadResponseDataSchema.parse()`
 *     before being returned — malformed provider output fails with 500.
 */
import { UploadResponseDataSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { Sentry } from '../../../lib/sentry';
import { incrementDomainCounter } from '../../../middlewares/metrics';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Fixed avatar upload limit in bytes (5MB). */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Allowance above the strict file-size limit for the Content-Length
 * pre-check (SPEC-078-GAPS T-033 / GAP-078-021). Multipart envelope
 * overhead (boundaries, field headers) on a file exactly at the byte
 * limit can push the declared Content-Length a few hundred bytes past
 * `AVATAR_MAX_BYTES` even though the parsed file body is within the
 * limit. The downstream `validateMediaFile` enforces the strict limit on
 * the parsed buffer.
 */
const CONTENT_LENGTH_MARGIN = 1024;

/**
 * POST /api/v1/protected/media/upload
 * Upload an avatar image for the authenticated user.
 *
 * Success status is forced to 200 (not 201) via `successStatusCode` because
 * avatar uploads always overwrite the user's existing avatar asset (fixed
 * publicId = userId). See SPEC-078-GAPS T-029 / GAP-078-062.
 */
export const protectedUploadAvatarRoute = createProtectedRoute({
    method: 'post',
    path: '/upload',
    summary: 'Upload user avatar',
    description:
        'Uploads a JPEG, PNG, or WebP avatar image (max 5MB) for the authenticated user. ' +
        'Overwrites any previously uploaded avatar.',
    tags: ['Media'],
    responseSchema: UploadResponseDataSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>
    ) => {
        // ── 0a. Cache-Control header (SPEC-078-GAPS GAP-078-135).
        // Avatar upload responses MUST never be cached: they contain the
        // freshly minted Cloudinary URL for the user's avatar, which is
        // immediately overwritten on the next upload (fixed publicId =
        // userId). Set the header on `ctx` early so it applies to every
        // return path — success, validation, and provider errors alike.
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
        if (contentLength > AVATAR_MAX_BYTES + CONTENT_LENGTH_MARGIN) {
            return createErrorResponse(
                {
                    code: 'PAYLOAD_TOO_LARGE',
                    message: 'Avatar file exceeds the 5MB limit'
                },
                ctx,
                413
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

        // ── 3. Extract authenticated user ─────────────────────────────────────
        const actor = getActorFromContext(ctx);
        const userId = actor.id;

        // ── 4. Extract file ───────────────────────────────────────────────────
        const fileEntry = formData.get('file');
        if (!(fileEntry instanceof File)) {
            return createErrorResponse(
                { code: 'VALIDATION_ERROR', message: 'Missing required "file" field' },
                ctx,
                400
            );
        }

        // ── 4b. Reject empty files (SPEC-078-GAPS T-032 / GAP-078-148).
        // A zero-byte upload bypasses every downstream content check (magic
        // bytes, dimensions) and would only fail much later inside the
        // provider call, wasting work. Reject it as early as possible with
        // a dedicated `EMPTY_FILE` code so clients can distinguish it from
        // generic validation errors.
        if (fileEntry.size === 0) {
            return createErrorResponse(
                { code: 'EMPTY_FILE', message: 'Uploaded file is empty' },
                ctx,
                422
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
            return createErrorResponse(
                {
                    code: 'UNPROCESSABLE_ENTITY',
                    message: `Avatar validation failed: ${validation.error}`,
                    details: validation.details
                },
                ctx,
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
            // SPEC-078-GAPS T-056 / GAP-078-128: capture provider errors so
            // upstream Cloudinary failures surface in Sentry with a tag that
            // groups them under the media-provider component.
            Sentry.captureException(uploadError, {
                tags: { component: 'media-provider', operation: 'upload' },
                contexts: { media: { preset: 'avatar', userId } }
            });
            incrementDomainCounter('media_upload_total', 'failure');
            return createErrorResponse(
                { code: 'UPSTREAM_ERROR', message: 'Avatar upload failed' },
                ctx,
                502
            );
        }

        // ── 8. Validate upload response completeness ──────────────────────────
        // `UploadResponseDataSchema` is the single source of truth for the
        // response payload shape. A malformed provider response MUST fail here
        // rather than silently flowing bad data downstream
        // (SPEC-078-GAPS T-029 / GAP-078-149).
        const parsedResponse = UploadResponseDataSchema.safeParse({
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            width: uploadResult.width,
            height: uploadResult.height,
            moderationState: 'APPROVED'
        });

        if (!parsedResponse.success) {
            apiLogger.error(
                {
                    issues: parsedResponse.error.issues.map((i) => ({
                        path: i.path.join('.'),
                        code: i.code
                    })),
                    userId
                },
                'Cloudinary avatar response did not match UploadResponseDataSchema'
            );
            incrementDomainCounter('media_upload_total', 'failure');
            return createErrorResponse(
                {
                    code: 'UPSTREAM_ERROR',
                    message: 'Incomplete response from image service'
                },
                ctx,
                502
            );
        }

        // ── 8b. Structured success log + counter (SPEC-078-GAPS T-056 /
        //         GAP-078-050 + GAP-078-128). Emitted once per confirmed
        //         avatar upload so dashboards can correlate publicId +
        //         preset with downstream profile updates.
        apiLogger.info(
            {
                event: 'media.upload.success',
                publicId: parsedResponse.data.publicId,
                preset: 'avatar',
                userId,
                actorId: actor.id
            },
            'media upload success'
        );
        incrementDomainCounter('media_upload_total', 'success');

        // ── 9. Return result — wrapping via ResponseFactory happens in the
        //       factory (`createCRUDRoute → createResponse`). No `ctx.json`
        //       bypass here. The factory attaches the `{ success, data,
        //       metadata }` envelope and returns HTTP 200 per
        //       `successStatusCode` above.
        return parsedResponse.data;
    },
    // SPEC-079: per-user sliding-window rate limit — 10 uploads per 1-minute
    // window for authenticated users. Replaces the interim IP-based fixed-window
    // limit from SPEC-078-GAPS T-033 / GAP-078-068.
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 10,
                keyPrefix: 'upload:protected'
            })
        ]
    }
});
