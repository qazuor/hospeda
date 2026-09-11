/**
 * @file compress-image.ts
 * @description Client-side image resize/recompress pipeline (HOS-332).
 *
 * A phone photo lands between 3 and 15 MB. Cloudinary's plan on this project
 * has a hard 10 MB ceiling per image (`PROVIDER_MAX_IMAGE_FILE_SIZE_MB` in
 * `@repo/media`), so a heavy original either fails outright or spends 20-120s
 * on a mobile uplink only to die at the provider with a generic
 * `502 UPSTREAM_ERROR`. Shrinking the file IN THE BROWSER before it leaves the
 * device is the only way to accept those originals reliably — this module is
 * that shrink step, decoupled from any specific upload surface so the three
 * editors that upload images (accommodation gallery, commerce listings,
 * avatar) share one implementation.
 *
 * Compression is always an OPTIMIZATION, never a requirement: every failure
 * mode here — an unsupported format, a browser with no canvas support, a
 * compressed result that ended up bigger than the original — falls back to
 * returning the original `File` untouched. The one thing this module must
 * never do is throw past its own boundary or block an upload that would
 * otherwise have succeeded.
 *
 * The clearest example of why that matters: Chrome cannot decode HEIC (no
 * `ImageDecoder`/`createImageBitmap` support for it), while Safari can. A
 * HEIC photo from an iPhone, viewed in Chrome, must upload as-is — the server
 * already accepts `image/heic` (`packages/media/src/server/validate-media-file.ts`).
 * `compressImageForUpload` is written so that path costs nothing more than a
 * caught exception.
 */

// ---------------------------------------------------------------------------
// Tunable defaults
// ---------------------------------------------------------------------------

/**
 * Target length, in pixels, of the longer side after resizing.
 *
 * 2560px comfortably exceeds every surface this app renders an image at
 * (including the widest hero/gallery presets in `@repo/media`'s
 * `MEDIA_PRESETS`), so downstream consumers never notice the resize. Chosen
 * over a "web-safe" 1920/2048 specifically so a host who right-clicks and
 * saves the "original" still gets a print-usable image, not a
 * screen-resolution crop.
 */
export const DEFAULT_COMPRESSION_MAX_DIMENSION_PX = 2560;

/**
 * JPEG/WebP encode quality (0-1) used when recompressing.
 *
 * 0.85 is the conventional "visually lossless" floor for photographic
 * content — below it, compression artifacts start showing in skies and flat
 * walls, exactly the content that dominates accommodation/commerce photos.
 */
export const DEFAULT_COMPRESSION_QUALITY = 0.85;

/**
 * Below this size, a file is not worth compressing: decoding + re-encoding
 * has a real CPU/battery cost, and a file already this small has already
 * cleared the "20-120s on mobile" problem this module exists to solve.
 *
 * 1 MB (not, say, 500 KB): a phone photo that already sits under 1 MB is
 * virtually always a previously-compressed download or a screenshot, not a
 * fresh camera capture — the population this feature targets starts at 3 MB.
 */
export const DEFAULT_COMPRESSION_SKIP_BELOW_BYTES = 1_000_000;

// ---------------------------------------------------------------------------
// Pure helpers (no browser API — fully unit-testable)
// ---------------------------------------------------------------------------

/** Input for {@link computeScaledDimensions}. */
export interface ScaledDimensionsInput {
    readonly width: number;
    readonly height: number;
    readonly maxDimensionPx: number;
}

/** Output of {@link computeScaledDimensions}. */
export interface ScaledDimensions {
    readonly width: number;
    readonly height: number;
}

/**
 * Scale `width`/`height` down so the longer side is at most `maxDimensionPx`,
 * preserving aspect ratio. Returns the input unchanged when it already fits —
 * this pipeline only ever shrinks, never upscales.
 *
 * @param input - Source dimensions and the target cap
 * @returns The scaled dimensions, rounded to whole pixels (minimum 1)
 */
export function computeScaledDimensions(input: ScaledDimensionsInput): ScaledDimensions {
    const { width, height, maxDimensionPx } = input;
    const longestSide = Math.max(width, height);

    if (longestSide <= maxDimensionPx) {
        return { width, height };
    }

    const scale = maxDimensionPx / longestSide;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

/** MIME types the `<canvas>` 2D context can encode a blob as, directly. */
export type CanvasEncodableMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const CANVAS_ENCODABLE_MIME_TYPES: ReadonlySet<string> = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);

/**
 * Resolve the MIME type to re-encode a decoded image as.
 *
 * A format canvas already knows how to write (JPEG/PNG/WebP) round-trips as
 * itself. Anything else that reached this point necessarily decoded
 * successfully (HEIC/AVIF on a browser that supports it, e.g. Safari) but
 * canvas cannot re-encode those directly — they fall back to JPEG, the
 * smallest and most universally compatible lossy format, and what every
 * consumer of a "gallery photo" already expects.
 *
 * @param inputMimeType - The original file's declared MIME type
 * @returns A MIME type `canvas.toBlob`/`OffscreenCanvas.convertToBlob` accepts
 */
export function resolveCompressionOutputMimeType(inputMimeType: string): CanvasEncodableMimeType {
    if (CANVAS_ENCODABLE_MIME_TYPES.has(inputMimeType)) {
        return inputMimeType as CanvasEncodableMimeType;
    }
    return 'image/jpeg';
}

/** Input for {@link shouldAttemptCompression}. */
export interface ShouldAttemptCompressionInput {
    readonly fileSizeBytes: number;
    readonly skipBelowBytes?: number;
}

/**
 * Whether a file is large enough to be worth compressing.
 *
 * @param input - File size and the skip threshold (defaults to
 *   {@link DEFAULT_COMPRESSION_SKIP_BELOW_BYTES})
 */
export function shouldAttemptCompression(input: ShouldAttemptCompressionInput): boolean {
    const { fileSizeBytes, skipBelowBytes = DEFAULT_COMPRESSION_SKIP_BELOW_BYTES } = input;
    return fileSizeBytes > skipBelowBytes;
}

const EXTENSION_BY_MIME_TYPE: Record<CanvasEncodableMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

/**
 * Rename a file to match a (possibly different, e.g. HEIC → JPEG) output MIME
 * type, preserving everything before the last extension.
 */
function renameForMimeType(originalName: string, mimeType: CanvasEncodableMimeType): string {
    const extension = EXTENSION_BY_MIME_TYPE[mimeType];
    const dotIndex = originalName.lastIndexOf('.');
    const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
    return `${base}.${extension}`;
}

// ---------------------------------------------------------------------------
// Browser-API-backed steps (injectable for tests — jsdom has no real canvas)
// ---------------------------------------------------------------------------

/** Decodes a `File` into a drawable bitmap. */
type DecodeImageFn = (file: File) => Promise<ImageBitmap>;

/** Parameters for encoding a decoded bitmap back into a `Blob`. */
export interface EncodeCanvasParams {
    readonly bitmap: ImageBitmap;
    readonly width: number;
    readonly height: number;
    readonly mimeType: CanvasEncodableMimeType;
    readonly quality: number;
}

/** Draws a bitmap at the target size and encodes it. `null` means "cannot". */
type EncodeCanvasFn = (params: EncodeCanvasParams) => Promise<Blob | null>;

/**
 * Default decode step: `createImageBitmap` with `imageOrientation:
 * 'from-image'`.
 *
 * That option is load-bearing, not cosmetic: without it, the EXIF orientation
 * tag a phone camera writes (portrait shots are stored as landscape pixel
 * data plus a rotation flag) is IGNORED, and every vertical photo comes out
 * rotated 90° once redrawn onto a plain canvas — canvas has no concept of
 * EXIF. `'from-image'` makes the browser bake the rotation into the decoded
 * bitmap itself, so the canvas draws it upright with zero extra code here.
 */
async function defaultDecodeImage(file: File): Promise<ImageBitmap> {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/**
 * Default encode step. Prefers `OffscreenCanvas` (available on a worker or a
 * modern main thread) and falls back to a detached `<canvas>` element,
 * returning `null` when neither is usable (e.g. a non-browser test runtime
 * with no injected override).
 */
async function defaultEncodeCanvas(params: EncodeCanvasParams): Promise<Blob | null> {
    const { bitmap, width, height, mimeType, quality } = params;

    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        return canvas.convertToBlob({ type: mimeType, quality });
    }

    if (typeof document === 'undefined') {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Why {@link compressImageForUpload} returned the original file unchanged. */
export type CompressionSkipReason =
    | 'already-small'
    | 'decode-unsupported'
    | 'encode-unsupported'
    | 'no-size-gain';

/** The compression pipeline produced a smaller file. */
export interface CompressedOutcome {
    readonly file: File;
    readonly wasCompressed: true;
    readonly originalBytes: number;
    readonly compressedBytes: number;
}

/** The original file is returned unchanged, for the stated reason. */
export interface SkippedOutcome {
    readonly file: File;
    readonly wasCompressed: false;
    readonly reason: CompressionSkipReason;
}

/** Result of {@link compressImageForUpload}. */
export type CompressionOutcome = CompressedOutcome | SkippedOutcome;

/** Input for {@link compressImageForUpload}. */
export interface CompressImageForUploadInput {
    readonly file: File;
    /** @default {@link DEFAULT_COMPRESSION_MAX_DIMENSION_PX} */
    readonly maxDimensionPx?: number;
    /** @default {@link DEFAULT_COMPRESSION_QUALITY} */
    readonly quality?: number;
    /** @default {@link DEFAULT_COMPRESSION_SKIP_BELOW_BYTES} */
    readonly skipBelowBytes?: number;
    /** Test seam — defaults to `createImageBitmap`-based decoding. */
    readonly decodeImage?: DecodeImageFn;
    /** Test seam — defaults to canvas-based encoding. */
    readonly encodeCanvas?: EncodeCanvasFn;
}

/**
 * Resize and recompress an image file for upload, entirely client-side.
 *
 * Never throws and never returns a file larger than the input: any failure
 * along the way (unsupported format, no canvas support, a compressed result
 * that is not actually smaller) falls back to the original `File` with a
 * `reason` describing why. Callers that need to distinguish "we chose not to
 * compress" from "we tried and could not" should use
 * {@link isCompressionUnavailable}.
 *
 * @param input - The file plus optional tuning/test overrides
 * @returns The outcome: either a smaller `File`, or the original with a reason
 */
export async function compressImageForUpload(
    input: CompressImageForUploadInput
): Promise<CompressionOutcome> {
    const {
        file,
        maxDimensionPx = DEFAULT_COMPRESSION_MAX_DIMENSION_PX,
        quality = DEFAULT_COMPRESSION_QUALITY,
        skipBelowBytes = DEFAULT_COMPRESSION_SKIP_BELOW_BYTES,
        decodeImage = defaultDecodeImage,
        encodeCanvas = defaultEncodeCanvas
    } = input;

    if (!shouldAttemptCompression({ fileSizeBytes: file.size, skipBelowBytes })) {
        return { file, wasCompressed: false, reason: 'already-small' };
    }

    let bitmap: ImageBitmap;
    try {
        bitmap = await decodeImage(file);
    } catch {
        // The browser cannot decode this format at all (the canonical case:
        // HEIC on Chrome). Compression is an optimization, never a
        // requirement — fall back to the original file untouched rather than
        // failing the upload.
        return { file, wasCompressed: false, reason: 'decode-unsupported' };
    }

    try {
        const { width, height } = computeScaledDimensions({
            width: bitmap.width,
            height: bitmap.height,
            maxDimensionPx
        });
        const mimeType = resolveCompressionOutputMimeType(file.type);

        let blob: Blob | null = null;
        try {
            blob = await encodeCanvas({ bitmap, width, height, mimeType, quality });
        } catch {
            blob = null;
        }

        if (!blob) {
            return { file, wasCompressed: false, reason: 'encode-unsupported' };
        }
        if (blob.size >= file.size) {
            // Never hand back something worse than what came in — a tiny or
            // already-efficiently-encoded source can legitimately grow.
            return { file, wasCompressed: false, reason: 'no-size-gain' };
        }

        const compressedFile = new File([blob], renameForMimeType(file.name, mimeType), {
            type: mimeType,
            lastModified: file.lastModified
        });

        return {
            file: compressedFile,
            wasCompressed: true,
            originalBytes: file.size,
            compressedBytes: compressedFile.size
        };
    } finally {
        bitmap.close?.();
    }
}

/**
 * Whether a {@link CompressionOutcome} means the browser genuinely could not
 * process the image (unsupported format / no canvas support), as opposed to
 * choosing not to (already small, or no size gain).
 *
 * Callers use this to decide whether an over-the-cap file deserves the
 * "we couldn't shrink this" actionable message instead of the generic
 * "file too large" one — see `buildCompressionUnsupportedTooLargeMessage`
 * callers in each upload surface.
 */
export function isCompressionUnavailable(outcome: CompressionOutcome): boolean {
    return (
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
    );
}
