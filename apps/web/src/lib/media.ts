/**
 * Utility functions for extracting media URLs from API response objects.
 *
 * API responses store images in a nested `media` JSONB structure:
 * `{ media: { featuredImage: { url, caption }, gallery: [...] } }`
 *
 * These helpers extract the plain URL string and apply Cloudinary transforms
 * via `getMediaUrl()` from `@repo/media`. Non-Cloudinary URLs pass through unchanged.
 *
 * Note: the API may attach a `moderationState` on each image but that field is
 * an admin-only concern. Moderation filtering happens on the server — public
 * web responses only ever include approved assets, so this file ignores the
 * field entirely. See SPEC-078-GAPS T-049 (GAP-078-064).
 */

import type { MediaPreset } from '@repo/media';
import { getMediaUrl } from '@repo/media';

const DEFAULT_PLACEHOLDER = '/images/placeholder.svg';

/**
 * Allowlist of remote hostnames that the web app is permitted to fetch images
 * from at build/SSR time via Astro's `getImage()`.
 *
 * This list is the **single source of truth** for both:
 *   1. `astro.config.mjs#image.remotePatterns` (Astro's own validation)
 *   2. {@link isAllowedRemoteHost} runtime SSRF guard for user-controllable URLs
 *
 * SECURITY (SPEC-099 S-1): Astro's `getImage()` will fetch any remote URL it is
 * configured to optimize. If we pass a user-controlled image URL through
 * `getImage()` without an allowlist check, an attacker can coerce the build
 * server (or SSR runtime) to issue HTTP requests to arbitrary hosts —
 * including internal/cloud-metadata endpoints (SSRF). Always validate
 * user-controllable URLs with {@link isAllowedRemoteHost} before passing
 * them to `getImage()`.
 *
 * Note: `localhost` is allowed for local development. The wildcard pattern
 * `*.vercel.app` from `remotePatterns` is **not** modeled here — wildcard
 * subdomain matching is intentionally omitted from the runtime guard to keep
 * the allowlist explicit and auditable. If a future use case requires it,
 * extend the helper rather than the constant.
 */
export const ALLOWED_REMOTE_HOSTS = [
    'localhost',
    'res.cloudinary.com',
    'images.pexels.com',
    'images.unsplash.com',
    'i0.wp.com',
    'i1.wp.com',
    'i2.wp.com'
] as const;

/**
 * Returns `true` if the given URL's hostname is in {@link ALLOWED_REMOTE_HOSTS}.
 * Returns `false` for malformed URLs, empty strings, or hostnames not in
 * the allowlist.
 *
 * Use this BEFORE passing any user-controllable URL to Astro's `getImage()`
 * to prevent SSRF (Server-Side Request Forgery) during builds or SSR. Astro
 * will fetch any remote URL it is configured to optimize, so an attacker
 * who controls the `src` argument can coerce the build/SSR runtime to issue
 * HTTP requests to arbitrary hosts (including internal/cloud-metadata
 * endpoints). Always gate `getImage({ src })` calls with this helper when
 * `src` originates from API/database content.
 *
 * @example
 * ```ts
 * const url = item.featuredImage.url; // user-controllable
 * if (isAllowedRemoteHost(url)) {
 *   const optimized = await getImage({ src: url, width: 300 });
 *   return optimized.src;
 * }
 * return url; // pass through unchanged — no fetch issued
 * ```
 *
 * @param url - URL string to validate
 * @returns `true` if hostname is allowlisted, `false` otherwise
 */
export function isAllowedRemoteHost(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return (ALLOWED_REMOTE_HOSTS as readonly string[]).includes(hostname);
    } catch {
        return false;
    }
}

/**
 * Returns `true` when `value` can be used directly as an `<img src>`.
 *
 * Accepts an absolute `http(s)` URL or a root-relative path (`/…`, including
 * the protocol-relative `//host/…` form). Everything else is rejected: bare
 * relative paths (`avatars/x.jpg`, which resolve against the CURRENT page path
 * and 404 on any detail route), non-fetchable schemes (`javascript:`, `data:`),
 * empty/whitespace strings, and anything `new URL()` cannot parse at all.
 *
 * ## Why this exists (HOS-375)
 *
 * The public author-avatar fields — `PostAuthorPublicSchema.image`,
 * `EventAuthorPublicSchema.image` and the author page's `avatar` — are
 * deliberately LENIENT on the API side: they assert type and presence but not
 * URL format, because `users.image` and the `profile.avatar` JSONB path are
 * both written outside Zod (Better Auth signup, seed fixtures, data-migration
 * `0043`) and a strict response schema fail-closes to an HTTP 500 through
 * `stripWithSchema`. The schema's job is "never take the page down"; keeping a
 * broken picture off the page is THIS function's job, at the consumer, right
 * before render.
 *
 * That split is intentional and must not be collapsed back into the schema with
 * `.catch()` — `ZodCatch` has no renderer in `@hono/zod-openapi`, and the
 * OpenAPI document is global, so one such field 500s `/docs/openapi.json`
 * everywhere.
 *
 * SSRF is a SEPARATE concern with a separate guard: use
 * {@link isAllowedRemoteHost} before handing a URL to Astro's `getImage()`.
 * This function only answers "will the browser be able to load it".
 *
 * The parameter is `unknown` rather than `string | null | undefined` on purpose:
 * the values it screens come out of `Record<string, unknown>` API payloads, and
 * narrowing them with an `as` cast at each call site would be an unsound
 * promise about data this function exists precisely to distrust. The `typeof`
 * check below is the real narrowing.
 *
 * @param value - Candidate image URL, from API/database content
 * @returns `true` when the value is safe to emit as an image `src`
 */
export function isRenderableImageUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();
    if (trimmed === '') return false;

    // Root-relative and protocol-relative paths are served by this origin (or
    // the same scheme) and always resolve correctly from any route.
    if (trimmed.startsWith('/')) return true;

    try {
        const { protocol } = new URL(trimmed);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Narrows a candidate image URL to a renderable one, or `undefined`.
 *
 * Convenience wrapper over {@link isRenderableImageUrl} for the common
 * "render it or render nothing" call site. Returns the TRIMMED value so
 * callers never emit a `src` with stray whitespace.
 *
 * @param value - Candidate image URL, from API/database content
 * @returns The trimmed URL when renderable, otherwise `undefined`
 */
export function toRenderableImageUrl(value: unknown): string | undefined {
    return typeof value === 'string' && isRenderableImageUrl(value) ? value.trim() : undefined;
}

interface MediaImage {
    readonly url?: string;
    readonly caption?: string;
    readonly description?: string;
    readonly attribution?: {
        readonly photographer: string;
        readonly sourceUrl: string;
        readonly license: string;
        readonly provider: 'unsplash' | 'pexels';
    };
}

interface MediaObject {
    readonly featuredImage?: MediaImage | string;
    readonly gallery?: readonly MediaImage[];
    readonly videos?: readonly { readonly url?: string }[];
}

/**
 * A gallery item carrying the transformed image URL plus any caption and
 * description metadata attached to it on the API side.
 *
 * Produced by {@link extractGalleryItems}. Components that render captions
 * (e.g. the full photo page, lightbox integrations) should consume this shape;
 * components that only need the URL list can keep using {@link extractGalleryUrls}.
 */
export interface GalleryItem {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
}

/**
 * Options bag for {@link extractFeaturedImageUrl} and {@link extractFeaturedImage}.
 *
 * Allows callers to express fallback and preset as a named-argument object
 * instead of positional parameters.  When `options.fallback` is provided it
 * takes precedence over the positional `fallback` parameter, enabling call
 * sites to opt into the options pattern incrementally (GAP-078-061 follow-up
 * from SPEC-078-GAPS T-042 / T-049).
 */
export interface ExtractFeaturedImageOptions {
    /** Fallback URL returned when no image field is found on the item. */
    readonly fallback?: string;
    /** Named Cloudinary preset to apply. */
    readonly preset?: MediaPreset;
}

/**
 * The rich shape returned by {@link extractFeaturedImage}.
 *
 * Carries both the Cloudinary-transformed URL and the optional caption
 * metadata from the API response, so components can use the caption as
 * accessible `alt` text (falling back to the entity name when absent).
 */
export interface FeaturedImageResult {
    /** Cloudinary-transformed (or passthrough) image URL. */
    readonly url: string;
    /**
     * Optional caption text sourced from `media.featuredImage.caption`.
     * Present only when the API returns a structured `{ url, caption }` object
     * (not a plain string) and the caption is a non-empty string.
     */
    readonly caption?: string;
    /**
     * Optional attribution for stock images from Unsplash/Pexels.
     * Present only when the image was imported via the stock image import flow.
     */
    readonly attribution?: {
        readonly photographer: string;
        readonly sourceUrl: string;
        readonly license: string;
        readonly provider: 'unsplash' | 'pexels';
    };
}

/**
 * Extracts the featured image URL **and caption** from an API response item,
 * applying a Cloudinary transform preset via `getMediaUrl()`.
 *
 * The returned `caption` field is populated only when the API stores the
 * featured image as a structured `{ url, caption }` object (not a plain
 * string) and the caption is a non-empty string.  Components should use
 * `caption ?? entityName ?? ''` as the `alt` attribute so that API-provided
 * captions are preferred over synthetic entity-name fallbacks.
 *
 * Lookup order:
 * 1. `item.media.featuredImage` (object with `url` + optional `caption`, or plain string)
 * 2. `item.featuredImage` (plain string)
 * 3. `item.heroImage` (plain string)
 * 4. `item.image` (plain string)
 * 5. `options.fallback` → `fallback` → `DEFAULT_PLACEHOLDER`
 *
 * @param item - API response item (destination, accommodation, event, post, etc.)
 * @param options - Optional overrides for `fallback` URL and Cloudinary `preset`
 * @returns `{ url, caption? }` — transformed URL and optional caption string
 */
export function extractFeaturedImage(
    item: Record<string, unknown>,
    options?: ExtractFeaturedImageOptions
): FeaturedImageResult {
    const resolvedFallback = options?.fallback ?? DEFAULT_PLACEHOLDER;
    const resolvedPreset = options?.preset ?? 'card';

    const media = item.media as MediaObject | undefined;
    if (media?.featuredImage) {
        if (typeof media.featuredImage === 'string') {
            return { url: getMediaUrl(media.featuredImage, { preset: resolvedPreset }) };
        }
        if (typeof media.featuredImage === 'object' && media.featuredImage.url) {
            const result: {
                url: string;
                caption?: string;
                attribution?: {
                    photographer: string;
                    sourceUrl: string;
                    license: string;
                    provider: 'unsplash' | 'pexels';
                };
            } = {
                url: getMediaUrl(media.featuredImage.url, { preset: resolvedPreset })
            };
            if (
                typeof media.featuredImage.caption === 'string' &&
                media.featuredImage.caption.length > 0
            ) {
                result.caption = media.featuredImage.caption;
            }
            // Extract attribution if present (SPEC-274 stock images)
            const attr = media.featuredImage.attribution as Record<string, unknown> | undefined;
            if (attr?.photographer && attr?.sourceUrl && attr?.license && attr?.provider) {
                result.attribution = {
                    photographer: String(attr.photographer),
                    sourceUrl: String(attr.sourceUrl),
                    license: String(attr.license),
                    provider: attr.provider as 'unsplash' | 'pexels'
                };
            }
            return result;
        }
    }

    if (typeof item.featuredImage === 'string' && item.featuredImage) {
        return { url: getMediaUrl(item.featuredImage, { preset: resolvedPreset }) };
    }

    if (typeof item.heroImage === 'string' && item.heroImage) {
        return { url: getMediaUrl(item.heroImage, { preset: resolvedPreset }) };
    }

    if (typeof item.image === 'string' && item.image) {
        return { url: getMediaUrl(item.image, { preset: resolvedPreset }) };
    }

    return { url: resolvedFallback };
}

/**
 * Extracts the featured image URL from an API response item and applies
 * a Cloudinary transform preset via `getMediaUrl()`.
 *
 * Handles both nested media objects and flat string values.
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * The positional `fallback` and `preset` parameters are preserved for
 * backward compatibility.  When `options.fallback` or `options.preset` are
 * provided they take precedence over the positional equivalents.
 *
 * @deprecated Use {@link extractFeaturedImage} instead, which returns the
 * full `{ url, caption? }` shape enabling caption-as-alt accessibility.
 * This wrapper will remain indefinitely for backward compatibility but new
 * callers MUST NOT use it.
 *
 * @param item - API response item (destination, accommodation, event, post, etc.)
 * @param fallback - Fallback URL if no image is found (default: `'/images/placeholder.svg'`)
 * @param preset - Named Cloudinary preset to apply (default: `'card'`)
 * @param options - Optional named-argument overrides for `fallback` and `preset`
 * @returns The transformed image URL string
 */
export function extractFeaturedImageUrl(
    item: Record<string, unknown>,
    fallback = DEFAULT_PLACEHOLDER,
    preset: MediaPreset = 'card',
    options?: ExtractFeaturedImageOptions
): string {
    return extractFeaturedImage(item, {
        fallback: options?.fallback ?? fallback,
        preset: options?.preset ?? preset
    }).url;
}

/**
 * Extracts gallery image URLs from an API response item and applies
 * a Cloudinary transform preset via `getMediaUrl()` to each URL.
 *
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * @param item - API response item
 * @param preset - Named Cloudinary preset to apply (default: `'gallery'`)
 * @returns Array of transformed image URL strings
 */
export function extractGalleryUrls(
    item: Record<string, unknown>,
    preset: MediaPreset = 'gallery'
): readonly string[] {
    const media = item.media as MediaObject | undefined;
    if (!media?.gallery || !Array.isArray(media.gallery)) {
        return [];
    }

    return media.gallery
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .map((url) => getMediaUrl(url, { preset }));
}

/**
 * Extracts gallery items (url + caption + description) from an API response
 * item and applies a Cloudinary transform preset to each URL.
 *
 * Unlike {@link extractGalleryUrls}, this function preserves the `caption` and
 * `description` metadata attached to each gallery entry on the API side.
 * Consumers that need to surface captions (for example lightbox integrations
 * on the full photo page) should use this helper.
 *
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * @param item - API response item
 * @param preset - Named Cloudinary preset to apply (default: `'gallery'`)
 * @returns Array of gallery items with transformed URLs and preserved metadata
 */
export function extractGalleryItems(
    item: Record<string, unknown>,
    preset: MediaPreset = 'gallery'
): readonly GalleryItem[] {
    const media = item.media as MediaObject | undefined;
    if (!media?.gallery || !Array.isArray(media.gallery)) {
        return [];
    }

    return media.gallery
        .map((entry) => {
            if (typeof entry === 'string') {
                return entry ? { url: getMediaUrl(entry, { preset }) } : null;
            }
            if (!entry || typeof entry.url !== 'string' || entry.url.length === 0) {
                return null;
            }
            const item: {
                url: string;
                caption?: string;
                description?: string;
            } = { url: getMediaUrl(entry.url, { preset }) };
            if (typeof entry.caption === 'string' && entry.caption.length > 0) {
                item.caption = entry.caption;
            }
            if (typeof entry.description === 'string' && entry.description.length > 0) {
                item.description = entry.description;
            }
            return item;
        })
        .filter((item): item is GalleryItem => item !== null);
}
