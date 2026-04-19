import { z } from 'zod';

/**
 * Entity types that support image upload via the admin media endpoint.
 *
 * Defines the set of content domains for which the upload API accepts files.
 * Used to build the storage path and to validate the target entity before upload.
 */
export const MediaEntityTypeSchema = z.enum(['accommodation', 'destination', 'event', 'post']);

/**
 * Image role within an entity's media structure.
 *
 * - `featured` — the primary image shown in listings and headers.
 * - `gallery` — additional images in the entity's photo gallery.
 */
export const MediaRoleSchema = z.enum(['featured', 'gallery']);

/**
 * Request validation for `POST /api/v1/admin/media/upload` (multipart form fields).
 *
 * All three fields must be present in the form alongside the binary file part.
 *
 * @example
 * ```ts
 * const parsed = AdminUploadRequestSchema.parse({
 *   entityType: 'accommodation',
 *   entityId: '550e8400-e29b-41d4-a716-446655440000',
 *   role: 'featured',
 * });
 * ```
 */
export const AdminUploadRequestSchema = z.object({
    entityType: MediaEntityTypeSchema,
    entityId: z.string().uuid({ message: 'entityId must be a valid UUID' }),
    role: MediaRoleSchema
});

/**
 * Safely decode a URL-encoded string. Returns the input unchanged when
 * `decodeURIComponent` throws (malformed sequence). The fallback ensures the
 * traversal refinement still inspects the raw value instead of crashing
 * validation with an uncaught error.
 */
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Query parameter validation for `DELETE /api/v1/admin/media`.
 *
 * The `publicId` must start with `'hospeda/'` to prevent callers from deleting
 * assets that live outside the project's Cloudinary namespace.
 *
 * It must also not contain a parent-directory traversal segment (`..`) in
 * either its raw form or after URL-decoding. This blocks attempts such as
 * `hospeda/dev/../prod/x` and `hospeda/dev/%2E%2E/prod/x` from escaping the
 * environment-scoped folder layout.
 *
 * @example
 * ```ts
 * // Valid
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/prod/accommodations/abc/featured' });
 *
 * // Invalid — wrong namespace
 * DeleteMediaQuerySchema.parse({ publicId: 'other/image' }); // throws
 *
 * // Invalid — path traversal
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/dev/../prod/x' }); // throws
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/dev/%2E%2E/prod/x' }); // throws
 * ```
 */
export const DeleteMediaQuerySchema = z.object({
    publicId: z
        .string()
        .min(1, 'publicId is required')
        .refine((s) => s.startsWith('hospeda/'), {
            message: 'publicId must start with "hospeda/"'
        })
        .refine((s) => !s.includes('..') && !safeDecode(s).includes('..'), {
            message: 'publicId must not contain path traversal segments'
        })
});

/**
 * Shape of the `data` payload on a successful upload response.
 *
 * Mirrors the relevant subset of the Cloudinary upload API response that
 * downstream consumers (admin UI, service layer) need to store on the entity.
 *
 * Includes `moderationState: 'APPROVED'` because, per project policy, every
 * image persisted via the upload endpoint is considered pre-approved at
 * creation time. Keeping the literal in the schema makes the contract
 * explicit and lets callers consume the status without a follow-up fetch.
 *
 * Unknown provider fields are stripped (default Zod behavior). This matches
 * the schema compatibility policy: the contract is additive only and
 * downstream clients must never see non-contractual fields leaking through.
 *
 * @example
 * ```ts
 * const data: UploadResponseData = {
 *   url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
 *   publicId: 'hospeda/prod/accommodations/abc/featured',
 *   width: 1920,
 *   height: 1080,
 *   moderationState: 'APPROVED',
 * };
 * ```
 */
export const UploadResponseDataSchema = z.object({
    url: z.string().url({ message: 'url must be a valid URL' }),
    publicId: z.string().min(1, 'publicId is required'),
    width: z.number().int().positive({ message: 'width must be a positive integer' }),
    height: z.number().int().positive({ message: 'height must be a positive integer' }),
    moderationState: z.literal('APPROVED').default('APPROVED')
});

/**
 * Metadata envelope returned alongside every successful upload response.
 *
 * Matches the project-wide `ApiResponse.metadata` shape produced by
 * `createResponse()` in the API. Kept inline here (rather than imported from
 * a shared API response schema) so this package remains decoupled from the
 * API app and can be consumed by any client that needs to validate upload
 * responses end-to-end.
 */
export const UploadResponseMetadataSchema = z.object({
    timestamp: z.string().datetime().optional(),
    requestId: z.string().optional()
});

/**
 * Full wrapped response shape returned by the upload endpoint on success.
 *
 * The shape is `{ success: true, data: {...}, metadata: {...} }` (wrapped via
 * the shared `ResponseFactory` on the API side). Route handlers call
 * `UploadResponseSchema.parse(response)` before returning so a malformed
 * provider response causes an explicit 500 instead of silent bad data.
 *
 * Upload routes return HTTP 200 (not 201) because uploads may overwrite an
 * existing asset (avatars, featured images) — they are not strictly a
 * creation.
 *
 * @example
 * ```ts
 * const response: UploadResponse = {
 *   success: true,
 *   data: {
 *     url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
 *     publicId: 'hospeda/prod/accommodations/abc/featured',
 *     width: 1920,
 *     height: 1080,
 *     moderationState: 'APPROVED',
 *   },
 *   metadata: { timestamp: '2026-04-19T00:00:00.000Z', requestId: 'abc' },
 * };
 * ```
 */
export const UploadResponseSchema = z.object({
    success: z.literal(true),
    data: UploadResponseDataSchema,
    metadata: UploadResponseMetadataSchema
});

/**
 * Response shape returned by the delete endpoint on success.
 *
 * The `deleted: true` literal acts as a discriminant so callers can safely
 * assert that the operation completed without needing to inspect HTTP status.
 *
 * @example
 * ```ts
 * const response: DeleteMediaResponse = {
 *   deleted: true,
 *   publicId: 'hospeda/prod/accommodations/abc/featured',
 * };
 * ```
 */
export const DeleteMediaResponseSchema = z.object({
    deleted: z.literal(true),
    publicId: z.string().min(1, 'publicId is required')
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

/** Union of all entity types that support media uploads. */
export type MediaEntityType = z.infer<typeof MediaEntityTypeSchema>;

/** Role of an image within an entity's media structure. */
export type MediaRole = z.infer<typeof MediaRoleSchema>;

/** Validated form fields for a media upload request. */
export type AdminUploadRequest = z.infer<typeof AdminUploadRequestSchema>;

/** Validated query parameters for a media delete request. */
export type DeleteMediaQuery = z.infer<typeof DeleteMediaQuerySchema>;

/** Shape of the `data` payload on a successful upload response. */
export type UploadResponseData = z.infer<typeof UploadResponseDataSchema>;

/** Metadata envelope returned alongside a successful upload response. */
export type UploadResponseMetadata = z.infer<typeof UploadResponseMetadataSchema>;

/** Shape of a successful (wrapped) upload response. */
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** Shape of a successful delete response. */
export type DeleteMediaResponse = z.infer<typeof DeleteMediaResponseSchema>;
