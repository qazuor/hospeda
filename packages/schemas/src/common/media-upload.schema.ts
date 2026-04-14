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
 * Query parameter validation for `DELETE /api/v1/admin/media`.
 *
 * The `publicId` must start with `'hospeda/'` to prevent callers from deleting
 * assets that live outside the project's Cloudinary namespace.
 *
 * @example
 * ```ts
 * // Valid
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/prod/accommodations/abc/featured' });
 *
 * // Invalid — wrong namespace
 * DeleteMediaQuerySchema.parse({ publicId: 'other/image' }); // throws
 * ```
 */
export const DeleteMediaQuerySchema = z.object({
    publicId: z
        .string()
        .min(1, 'publicId is required')
        .refine((s) => s.startsWith('hospeda/'), {
            message: 'publicId must start with "hospeda/"'
        })
});

/**
 * Response shape returned by the upload endpoint on success.
 *
 * Mirrors the relevant subset of the Cloudinary upload API response that
 * downstream consumers (admin UI, service layer) need to store on the entity.
 *
 * @example
 * ```ts
 * const response: UploadResponse = {
 *   url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
 *   publicId: 'hospeda/prod/accommodations/abc/featured',
 *   width: 1920,
 *   height: 1080,
 * };
 * ```
 */
export const UploadResponseSchema = z.object({
    url: z.string().url({ message: 'url must be a valid URL' }),
    publicId: z.string().min(1, 'publicId is required'),
    width: z.number().int().positive({ message: 'width must be a positive integer' }),
    height: z.number().int().positive({ message: 'height must be a positive integer' })
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

/** Shape of a successful upload response. */
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** Shape of a successful delete response. */
export type DeleteMediaResponse = z.infer<typeof DeleteMediaResponseSchema>;
