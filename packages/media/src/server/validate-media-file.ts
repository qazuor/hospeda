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
     * Maximum file size in MB.
     *
     * - For `entity` context: defaults to 10 MB when omitted.
     * - For `avatar` context: defaults to 5 MB when omitted
     *   (matches `DEFAULT_AVATAR_MAX_SIZE_MB` on the admin client).
     *
     * Callers can override either default to tighten or loosen the cap. The
     * resulting byte count is surfaced in `details.maxBytes` of a
     * `FILE_TOO_LARGE` failure so error messages reflect the actual cap
     * applied rather than a hardcoded constant.
     */
    readonly maxFileSizeMb?: number;
}

/** Successful validation result. */
export interface ValidationSuccess {
    readonly valid: true;
    readonly width: number;
    readonly height: number;
}

/**
 * All possible validation error codes.
 *
 * - `FILE_TOO_LARGE`: Buffer byte length exceeds the configured limit.
 * - `INVALID_FILE_TYPE`: Declared MIME type is not in the allowlist for the context.
 * - `MIME_MISMATCH`: Magic bytes in the buffer do not match the declared MIME type.
 *   Returned by GAP-078-103/104 to prevent extension/content-type spoofing.
 * - `IMAGE_TOO_LARGE`: Width or height exceeds the per-context dimension limit.
 * - `DECOMPRESSION_BOMB`: Total pixel count (width * height) exceeds
 *   `MAX_PIXEL_COUNT` (2e8). Prevents memory-exhaustion attacks via
 *   small files declaring huge dimensions (decompression bombs).
 * - `INVALID_IMAGE`: Buffer cannot be parsed as a valid image.
 */
export type ValidationErrorCode =
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE_TYPE'
    | 'MIME_MISMATCH'
    | 'IMAGE_TOO_LARGE'
    | 'DECOMPRESSION_BOMB'
    | 'INVALID_IMAGE';

/** Failed validation result. */
export interface ValidationFailure {
    readonly valid: false;
    readonly error: ValidationErrorCode;
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
/**
 * Default avatar size cap when the caller does not override `maxFileSizeMb`.
 * Matches `DEFAULT_AVATAR_MAX_SIZE_MB` on the admin client.
 */
const DEFAULT_AVATAR_MAX_SIZE_MB = 5;
const DEFAULT_MAX_SIZE_MB = 10;

/**
 * Maximum total pixel count (width * height) accepted for any image.
 *
 * 2e8 (200 megapixels) corresponds roughly to a 14142x14142 square image.
 * Any image whose declared dimensions multiply above this threshold is
 * treated as a decompression bomb and rejected.
 */
const MAX_PIXEL_COUNT = 2e8;

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
// Magic-byte detection
// ---------------------------------------------------------------------------

/**
 * Detects the actual image MIME type by inspecting the buffer's magic bytes.
 *
 * Recognised formats: JPEG, PNG, WEBP, HEIC/HEIF, AVIF. For ISO Base Media
 * formats (HEIC, AVIF) the discriminator lives in the `ftyp` brand at offset 8.
 *
 * @param buffer - Buffer whose first bytes are inspected
 * @returns Detected MIME type, or `null` if the format is unknown
 */
function detectMimeFromMagic(buffer: Buffer): string | null {
    if (buffer.length < 12) {
        return null;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return 'image/png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }

    // WEBP: "RIFF" .... "WEBP"
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp';
    }

    // ISO Base Media (HEIC / AVIF): bytes 4..8 == "ftyp"
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        const brand = buffer.subarray(8, 12).toString('ascii');
        // AVIF brands
        if (brand === 'avif' || brand === 'avis') {
            return 'image/avif';
        }
        // HEIC/HEIF brands
        if (
            brand === 'heic' ||
            brand === 'heix' ||
            brand === 'hevc' ||
            brand === 'hevx' ||
            brand === 'mif1' ||
            brand === 'msf1' ||
            brand === 'heim' ||
            brand === 'heis' ||
            brand === 'hevm' ||
            brand === 'hevs'
        ) {
            return 'image/heic';
        }
    }

    return null;
}

/**
 * Determines whether a detected MIME type is acceptable for a declared MIME type.
 *
 * Most formats require an exact match. HEIC and HEIF are intentionally treated
 * as interchangeable because they share the same container and brand set, and
 * the `image/heic` declaration is the canonical one we accept.
 *
 * @param declared - MIME type declared by the client
 * @param detected - MIME type detected from magic bytes
 */
function isMimeCompatible(declared: string, detected: string): boolean {
    if (declared === detected) {
        return true;
    }
    if (
        (declared === 'image/heic' && detected === 'image/heif') ||
        (declared === 'image/heif' && detected === 'image/heic')
    ) {
        return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Validates a media file before upload to Cloudinary.
 *
 * Performs the following checks in order:
 * 1. **File size** — compares buffer byte length against the context-specific
 *    limit. Both `entity` and `avatar` contexts honour the caller-supplied
 *    `maxFileSizeMb` when provided; defaults fall back to 10 MB (entity) and
 *    5 MB (avatar). The resulting cap is reflected in `details.maxBytes` on
 *    a `FILE_TOO_LARGE` failure.
 * 2. **MIME type allowlist** — verifies the declared Content-Type against the
 *    context-specific allowlist.
 * 3. **Magic-byte / MIME match** — inspects the buffer's signature bytes and
 *    rejects with `MIME_MISMATCH` if they do not match the declared MIME.
 *    Mitigates extension-spoofing attacks (GAP-078-103/104).
 * 4. **Image dimensions** — parses the buffer with `image-size` to confirm
 *    it is a valid image and that neither dimension exceeds the limit
 *    (entity: 8 000 px; avatar: 4 000 px).
 * 5. **Decompression-bomb guard** — rejects any image whose total pixel count
 *    (`width * height`) exceeds 2e8 (`DECOMPRESSION_BOMB`).
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

    // 1. File size check.
    //    Both contexts honour the caller-supplied `maxFileSizeMb`. When it is
    //    omitted we fall back to the context-specific default (5 MB avatar,
    //    10 MB entity). The resolved cap is surfaced in `details.maxBytes` so
    //    the error reflects the ACTUAL limit applied rather than a hardcoded
    //    constant — callers that tighten or loosen the cap see accurate caps
    //    in their error UIs.
    const defaultMb = context === 'avatar' ? DEFAULT_AVATAR_MAX_SIZE_MB : DEFAULT_MAX_SIZE_MB;
    const maxMb = maxFileSizeMb ?? defaultMb;
    const maxBytes = maxMb * 1024 * 1024;

    if (buffer.length > maxBytes) {
        return {
            valid: false,
            error: 'FILE_TOO_LARGE',
            details: { maxBytes, actualBytes: buffer.length }
        };
    }

    // 2. MIME type allowlist check
    const allowedTypes = context === 'avatar' ? AVATAR_MIME_TYPES : ENTITY_MIME_TYPES;

    if (!allowedTypes.has(mimeType)) {
        return {
            valid: false,
            error: 'INVALID_FILE_TYPE',
            details: { allowedTypes: [...allowedTypes], actualType: mimeType }
        };
    }

    // 3. Magic-byte / declared-MIME match check (GAP-078-103, GAP-078-104).
    //    Done BEFORE dimension parsing so spoofed payloads never reach
    //    `image-size`. If the buffer is too short or unrecognised we treat it
    //    as INVALID_IMAGE (handled by the dimension parser below).
    const detectedMime = detectMimeFromMagic(buffer);
    if (detectedMime !== null && !isMimeCompatible(mimeType, detectedMime)) {
        return {
            valid: false,
            error: 'MIME_MISMATCH',
            details: { declaredType: mimeType, detectedType: detectedMime }
        };
    }

    // 4. Dimension check via image-size
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

    // 5. Decompression-bomb guard (GAP-078-104). Run BEFORE the per-dimension
    //    cap so that, for example, a 15001x15001 image is reported as a bomb
    //    rather than as IMAGE_TOO_LARGE — that distinction matters for clients.
    const pixelCount = width * height;
    if (pixelCount > MAX_PIXEL_COUNT) {
        return {
            valid: false,
            error: 'DECOMPRESSION_BOMB',
            details: {
                maxPixelCount: MAX_PIXEL_COUNT,
                actualPixelCount: pixelCount,
                width,
                height
            }
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
