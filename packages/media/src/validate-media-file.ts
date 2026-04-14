import { imageSize } from 'image-size';

/** Validation context determines which limits apply. */
export type ValidationContext = 'entity' | 'avatar';

/**
 * Input for file validation.
 */
export interface ValidateMediaFileInput {
    /** Raw file buffer. */
    readonly buffer: Buffer;
    /** MIME type as declared by the client (Content-Type of the file part). */
    readonly mimeType: string;
    /** Validation context: 'entity' for general images, 'avatar' for user avatars. */
    readonly context: ValidationContext;
    /**
     * Maximum file size in MB for entity context. Default: 10.
     * Ignored for avatar context (fixed 5MB limit).
     */
    readonly maxFileSizeMb?: number;
}

/** Successful validation result. */
export interface ValidationSuccess {
    readonly valid: true;
    readonly width: number;
    readonly height: number;
}

/** Failed validation result. */
export interface ValidationFailure {
    readonly valid: false;
    readonly error: 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'IMAGE_TOO_LARGE' | 'INVALID_IMAGE';
    readonly details: Record<string, unknown>;
}

/** Discriminated union of validation outcomes. */
export type ValidationResult = ValidationSuccess | ValidationFailure;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/avif'
]);

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ENTITY_MAX_DIMENSION = 8000;
const AVATAR_MAX_DIMENSION = 4000;
const AVATAR_MAX_SIZE_MB = 5;
const DEFAULT_MAX_SIZE_MB = 10;

/**
 * Allowed MIME types for entity images (general uploads).
 * Exported for client-side validation reuse.
 */
export const ENTITY_ALLOWED_MIME_TYPES = [...ENTITY_MIME_TYPES] as const;

/**
 * Allowed MIME types for avatar images.
 * Exported for client-side validation reuse.
 */
export const AVATAR_ALLOWED_MIME_TYPES = [...AVATAR_MIME_TYPES] as const;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Validates a media file before upload to Cloudinary.
 *
 * Performs three checks in order:
 * 1. **File size** — compares buffer byte length against the context-specific
 *    limit (entity: `maxFileSizeMb` or 10 MB default; avatar: always 5 MB).
 * 2. **MIME type** — verifies the declared Content-Type against the
 *    context-specific allowlist.
 * 3. **Image dimensions** — parses the buffer with `image-size` to confirm
 *    it is a valid image and that neither dimension exceeds the limit
 *    (entity: 8 000 px; avatar: 4 000 px).
 *
 * @param input - Validation parameters including buffer, MIME type, and context
 * @returns `ValidationSuccess` with `width` and `height` on success, or
 *          `ValidationFailure` with a typed `error` code and `details` on failure
 *
 * @example
 * ```ts
 * const result = validateMediaFile({
 *   buffer: fileBuffer,
 *   mimeType: 'image/jpeg',
 *   context: 'entity',
 * });
 *
 * if (result.valid) {
 *   console.log(result.width, result.height);
 * } else {
 *   console.error(result.error, result.details);
 * }
 * ```
 */
export function validateMediaFile(input: ValidateMediaFileInput): ValidationResult {
    const { buffer, mimeType, context, maxFileSizeMb } = input;

    // 1. File size check
    const maxMb =
        context === 'avatar' ? AVATAR_MAX_SIZE_MB : (maxFileSizeMb ?? DEFAULT_MAX_SIZE_MB);
    const maxBytes = maxMb * 1024 * 1024;

    if (buffer.length > maxBytes) {
        return {
            valid: false,
            error: 'FILE_TOO_LARGE',
            details: { maxBytes, actualBytes: buffer.length }
        };
    }

    // 2. MIME type check
    const allowedTypes = context === 'avatar' ? AVATAR_MIME_TYPES : ENTITY_MIME_TYPES;

    if (!allowedTypes.has(mimeType)) {
        return {
            valid: false,
            error: 'INVALID_FILE_TYPE',
            details: { allowedTypes: [...allowedTypes], actualType: mimeType }
        };
    }

    // 3. Dimension check via image-size
    let width: number;
    let height: number;

    try {
        const dimensions = imageSize(buffer);

        if (!dimensions.width || !dimensions.height) {
            return {
                valid: false,
                error: 'INVALID_IMAGE',
                details: { message: 'Unable to determine image dimensions' }
            };
        }

        width = dimensions.width;
        height = dimensions.height;
    } catch {
        return {
            valid: false,
            error: 'INVALID_IMAGE',
            details: { message: 'Unable to determine image dimensions' }
        };
    }

    const maxDim = context === 'avatar' ? AVATAR_MAX_DIMENSION : ENTITY_MAX_DIMENSION;

    if (width > maxDim || height > maxDim) {
        return {
            valid: false,
            error: 'IMAGE_TOO_LARGE',
            details: {
                maxWidth: maxDim,
                maxHeight: maxDim,
                actualWidth: width,
                actualHeight: height
            }
        };
    }

    return { valid: true, width, height };
}
