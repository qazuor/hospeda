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
    /**
     * Per-call fallback URL used when `url` is nullish or empty.
     *
     * When provided, it replaces the module-level placeholder
     * (`/images/placeholder.svg`). If the fallback itself is a Cloudinary
     * URL it is routed through the same transform pipeline — the same
     * `preset` / `raw` / `width` / `height` options are applied to it —
     * so the caller never has to choose between "use a fallback" and
     * "honor the preset".
     *
     * Non-Cloudinary fallbacks (local SVGs, external assets) pass through
     * unchanged, matching the normal pass-through semantics of this function.
     *
     * Precedence: a per-call `options.fallback` always wins over the default
     * placeholder (principle of most-specific). SPEC-078-GAPS GAP-078-069.
     */
    readonly fallback?: string;
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
 * Cloudinary delivery-type path segments where the `/upload/` transform
 * injection pattern does NOT apply.
 *
 * - `/image/fetch/`: remote URL fetch delivery — path carries an encoded URL,
 *   not a public ID; transform syntax differs and we must not splice tokens in.
 * - `/image/private/`, `/image/authenticated/`: access-controlled delivery with
 *   signed URLs — modifying the path would invalidate the signature.
 *
 * SPEC-078-GAPS GAP-078-179.
 */
const NON_UPLOAD_DELIVERY_PATTERN = /\/image\/(fetch|private|authenticated)\//;

/**
 * Detects whether a Cloudinary URL already carries a transform segment
 * immediately after `/upload/`, which would cause `.replace('/upload/', ...)`
 * to inject a second transform and produce a broken URL like
 * `/upload/t_card/w_400,.../v1/sample.jpg`.
 *
 * The heuristic positively matches a transform segment by looking for a
 * comma-separated sequence of tokens right after `/upload/` where at least
 * one token starts with a known Cloudinary transform prefix
 * ({@link ALLOWED_RAW_TOKEN_PREFIXES}) or a named transform (`t_<name>`).
 * We anchor on `/upload/` so other path fragments can't trigger false
 * positives. Version segments (`v1234/`) are NOT transforms and are
 * deliberately not matched.
 *
 * SPEC-078-GAPS GAP-078-166 + GAP-078-211 + GAP-078-218.
 *
 * @param url - Full Cloudinary URL to inspect.
 * @returns `true` when a transform segment is already present.
 */
function hasExistingTransform(url: string): boolean {
    const uploadIdx = url.indexOf('/upload/');
    if (uploadIdx === -1) {
        return false;
    }
    const afterUpload = url.slice(uploadIdx + '/upload/'.length);
    // Isolate the first path segment after `/upload/`.
    const firstSeg = afterUpload.split('/', 1)[0] ?? '';
    if (firstSeg === '') {
        return false;
    }
    // Version segments like `v1234` are numeric-only after the `v` prefix —
    // treat them as not-a-transform so they fall through to the insert path.
    if (/^v\d+$/.test(firstSeg)) {
        return false;
    }
    const tokens = firstSeg.split(',');
    for (const token of tokens) {
        if (token.startsWith('t_')) {
            return true;
        }
        if (ALLOWED_RAW_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) {
            return true;
        }
    }
    return false;
}

/**
 * Removes the Cloudinary transform segment (if any) from a Cloudinary delivery
 * URL, returning the "bare" URL that can be passed back through `getMediaUrl`
 * with a fresh preset.
 *
 * This is useful when a Cloudinary URL has already been baked with a preset
 * (e.g. `gallery`: `w_800,q_auto,f_auto,dpr_auto`) at extraction time but a
 * downstream component needs to re-apply a different preset per cell role.
 * Without stripping, `getMediaUrl` would detect `hasExistingTransform` and
 * return the URL unchanged, ignoring the new preset entirely.
 *
 * Behavior:
 * - Cloudinary URL with a transform segment after `/upload/`: removes that
 *   segment and returns the URL with `/upload/` followed directly by the
 *   version or public-ID path.
 * - Cloudinary URL with **no** transform segment (already bare): returned as-is.
 * - Cloudinary URL with a non-`/upload/` delivery segment (`/fetch/`,
 *   `/private/`, `/authenticated/`): returned as-is (those URLs must not
 *   be manipulated).
 * - Non-Cloudinary URL (e.g. `/images/placeholder.svg`, Unsplash): returned
 *   as-is — pass-through semantics match `getMediaUrl`'s non-Cloudinary path.
 *
 * @param url - Any image URL (Cloudinary or otherwise).
 * @returns The URL with the Cloudinary transform segment stripped, or the
 *   original URL unchanged when no stripping is applicable.
 *
 * @example
 * ```ts
 * // URL baked with the 'gallery' preset
 * stripCloudinaryTransform(
 *   'https://res.cloudinary.com/demo/image/upload/w_800,q_auto,f_auto,dpr_auto/v1/sample.jpg'
 * );
 * // → 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'
 *
 * // URL already bare (no transform segment)
 * stripCloudinaryTransform(
 *   'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'
 * );
 * // → 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'
 *
 * // Non-Cloudinary: pass through unchanged
 * stripCloudinaryTransform('/images/placeholder-accommodation.svg');
 * // → '/images/placeholder-accommodation.svg'
 * ```
 */
export function stripCloudinaryTransform(url: string): string {
    // Non-Cloudinary URLs pass through unchanged.
    if (!url.includes('res.cloudinary.com')) {
        return url;
    }

    // Non-`/upload/` delivery types must not be modified.
    if (NON_UPLOAD_DELIVERY_PATTERN.test(url)) {
        return url;
    }

    const uploadIdx = url.indexOf('/upload/');
    if (uploadIdx === -1) {
        return url;
    }

    const uploadEnd = uploadIdx + '/upload/'.length;
    const afterUpload = url.slice(uploadEnd);

    // Isolate the first path segment after `/upload/`.
    const firstSlash = afterUpload.indexOf('/');
    if (firstSlash === -1) {
        // Nothing after the first segment — nothing to strip.
        return url;
    }

    const firstSeg = afterUpload.slice(0, firstSlash);

    // Check whether the first segment is a transform (same logic as
    // `hasExistingTransform`, but we act on the result rather than returning bool).
    if (/^v\d+$/.test(firstSeg)) {
        // It's a version segment, not a transform — URL is already bare.
        return url;
    }

    const tokens = firstSeg.split(',');
    const isTransform = tokens.some(
        (token) =>
            token.startsWith('t_') ||
            ALLOWED_RAW_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))
    );

    if (!isTransform) {
        // First segment doesn't look like a transform — return as-is.
        return url;
    }

    // Strip the transform segment: reconstruct URL skipping the first segment.
    const remainder = afterUpload.slice(firstSlash + 1);
    return `${url.slice(0, uploadEnd)}${remainder}`;
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
 * - Cloudinary URL with a `/image/fetch/`, `/image/private/`, or
 *   `/image/authenticated/` delivery segment: returns unchanged. Those
 *   delivery types use a different URL shape where splicing in transform
 *   tokens would break the fetch encoding or invalidate a signed URL.
 * - Cloudinary URL that already carries a transform segment after
 *   `/upload/` (for example a previously-transformed URL being rendered
 *   again through a preset): returns unchanged to avoid double-transform.
 * - Non-Cloudinary URL: returns unchanged.
 * - Nullish or empty: returns `options.fallback` if provided, otherwise the
 *   module-level placeholder. The fallback is routed back through this
 *   function so the same preset/raw/width/height options apply to it.
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
    // Handle nullish/empty — route through the fallback pipeline so the
    // per-call fallback receives the same preset/raw/width/height treatment.
    // Per-call `options.fallback` wins over the module default placeholder.
    // SPEC-078-GAPS GAP-078-069.
    if (!url || url.trim() === '') {
        const fallbackUrl = options?.fallback ?? FALLBACK_PLACEHOLDER;
        // Re-enter with the fallback but WITHOUT `options.fallback` so we can't
        // recurse indefinitely if a caller mistakenly passed an empty fallback.
        const { fallback: _fallback, ...rest } = options ?? {};
        // Guard: if the fallback itself is empty, return the module default
        // to avoid bouncing back into this branch with no way out.
        if (!fallbackUrl || fallbackUrl.trim() === '') {
            return FALLBACK_PLACEHOLDER;
        }
        return getMediaUrl(fallbackUrl, rest);
    }

    // Non-Cloudinary URLs pass through unchanged.
    if (!url.includes('res.cloudinary.com')) {
        return url;
    }

    // Non-`/upload/` delivery types (fetch, private, authenticated) use a
    // different URL shape — splicing a transform segment in breaks the
    // fetch-URL encoding or the signed-URL signature. Return unchanged.
    // SPEC-078-GAPS GAP-078-179.
    if (NON_UPLOAD_DELIVERY_PATTERN.test(url)) {
        return url;
    }

    // Defend against callers that pre-transform a URL and then pass it back
    // through `getMediaUrl` (for example persisting a preset-baked URL and
    // later re-rendering it through a preset). Re-injecting would yield
    // `/upload/w_400,.../w_200,.../...` which Cloudinary rejects.
    // SPEC-078-GAPS GAP-078-166 + GAP-078-211 + GAP-078-218.
    if (hasExistingTransform(url)) {
        return url;
    }

    // Build transform string.
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

    // Insert transforms after the FIRST `/upload/` only. `url.replace` with a
    // string needle already targets the first occurrence, but we anchor the
    // intent explicitly via indexOf + slice so reviewers don't assume the
    // behavior depends on replacing the path verbatim.
    const uploadIdx = url.indexOf('/upload/');
    const uploadEnd = uploadIdx + '/upload/'.length;
    return `${url.slice(0, uploadEnd)}${transforms}/${url.slice(uploadEnd)}`;
}
