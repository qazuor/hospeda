import { MEDIA_PRESETS } from './presets.js';
import type { MediaPreset } from './presets.js';

/** Default fallback placeholder for missing images. */
const FALLBACK_PLACEHOLDER = '/images/placeholder.svg';

/**
 * Allowlisted Cloudinary transform token prefixes accepted by the `raw` option.
 *
 * Restricting the raw transform string to these prefixes prevents callers from
 * injecting arbitrary Cloudinary directives (for example fetch URLs, custom
 * functions, or remote-loaded layers) that could lead to SSRF or unexpected
 * billing impact.
 */
const ALLOWED_RAW_TOKEN_PREFIXES = [
    'w_',
    'h_',
    'c_',
    'q_',
    'f_',
    'g_',
    'ar_',
    'dpr_',
    'e_'
] as const;

/**
 * Options for building a media URL.
 */
export interface GetMediaUrlOptions {
    /** Named preset to apply. Throws TypeError if unknown. */
    readonly preset?: MediaPreset;
    /** Override the preset's width. */
    readonly width?: number;
    /** Override the preset's height. */
    readonly height?: number;
    /**
     * Raw Cloudinary transform string — bypasses presets entirely.
     *
     * Each comma-separated token must start with one of
     * {@link ALLOWED_RAW_TOKEN_PREFIXES}. Unknown tokens cause a TypeError.
     */
    readonly raw?: string;
}

/**
 * Validates a raw transform string against the token allowlist.
 *
 * @param raw - The raw transform string (comma-separated tokens).
 * @throws {TypeError} If any token does not start with an allowed prefix.
 */
function assertAllowedRawTokens(raw: string): void {
    const tokens = raw.split(',');
    for (const rawToken of tokens) {
        const token = rawToken.trim();
        if (token === '') {
            throw new TypeError('Empty transform token in raw string');
        }
        const isAllowed = ALLOWED_RAW_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
        if (!isAllowed) {
            throw new TypeError(
                `Disallowed transform token: "${token}". Allowed prefixes: ${ALLOWED_RAW_TOKEN_PREFIXES.join(', ')}`
            );
        }
    }
}

/**
 * Builds an optimized image URL from a stored base URL.
 *
 * This is THE single function all apps call to render any image URL.
 * It does NOT require Cloudinary credentials — pure string transformation.
 * It MUST NOT import the Cloudinary SDK.
 * It MUST NOT make any network call.
 *
 * Behavior:
 * - Cloudinary URL (contains 'res.cloudinary.com'): inserts transform string
 *   from the named preset between '/upload/' and the version/path segment.
 * - Non-Cloudinary URL: returns unchanged.
 * - Nullish or empty: returns fallback placeholder URL.
 *
 * @param url - The base image URL to transform.
 * @param options - Optional transform options (preset, width, height, raw).
 * @returns Transformed URL string, original URL if non-Cloudinary, or fallback placeholder.
 *
 * @example
 * ```ts
 * // Cloudinary URL with preset
 * getMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/sample.jpg', { preset: 'card' });
 * // → 'https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto/v1/sample.jpg'
 *
 * // Non-Cloudinary URL passes through unchanged
 * getMediaUrl('https://images.unsplash.com/photo-abc', { preset: 'card' });
 * // → 'https://images.unsplash.com/photo-abc'
 *
 * // Nullish returns fallback
 * getMediaUrl(null);
 * // → '/images/placeholder.svg'
 *
 * // Raw transform bypasses presets (allowlisted tokens only)
 * getMediaUrl(url, { raw: 'w_300,h_300,c_crop,g_center' });
 * ```
 *
 * @throws {TypeError} If `options.preset` is provided but is not a known preset key,
 *   or if `options.raw` contains a token outside {@link ALLOWED_RAW_TOKEN_PREFIXES}.
 */
export function getMediaUrl(url: string | null | undefined, options?: GetMediaUrlOptions): string {
    // Handle nullish/empty
    if (!url || url.trim() === '') {
        return FALLBACK_PLACEHOLDER;
    }

    // Non-Cloudinary URLs pass through unchanged
    if (!url.includes('res.cloudinary.com')) {
        return url;
    }

    // Build transform string
    let transforms: string;

    if (options?.raw) {
        // Raw transform bypasses presets entirely; validate against allowlist first.
        assertAllowedRawTokens(options.raw);
        transforms = options.raw;
    } else if (options?.preset) {
        const presetTransforms = MEDIA_PRESETS[options.preset];
        if (!presetTransforms) {
            throw new TypeError(`Unknown media preset: ${options.preset}`);
        }
        transforms = presetTransforms;

        // Apply width override
        if (options.width !== undefined) {
            if (transforms.includes('w_')) {
                transforms = transforms.replace(/w_\d+/, `w_${options.width}`);
            } else {
                transforms = `w_${options.width},${transforms}`;
            }
        }

        // Apply height override
        if (options.height !== undefined) {
            if (transforms.includes('h_')) {
                transforms = transforms.replace(/h_\d+/, `h_${options.height}`);
            } else {
                transforms = `h_${options.height},${transforms}`;
            }
        }
    } else {
        // No preset and no raw — return URL unchanged
        return url;
    }

    // Insert transforms after /upload/
    return url.replace('/upload/', `/upload/${transforms}/`);
}
