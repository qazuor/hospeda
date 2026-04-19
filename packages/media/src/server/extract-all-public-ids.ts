/**
 * Utility to collect every Cloudinary publicId referenced by an entity's
 * `media` payload.
 *
 * Traverses `media.featuredImage`, `media.gallery[]`, and `media.videos[]`.
 * For each asset, prefers the stored `publicId` field when present, and
 * falls back to parsing `url` via {@link extractPublicId}. Non-Cloudinary
 * URLs (and malformed entries) are silently skipped.
 *
 * Lives under `/server` because the bulk-delete and migration flows that
 * need it are strictly server-side; the helper itself has no Node-only
 * dependencies, but keeping it here keeps the browser barrel minimal.
 *
 * Related GAP: GAP-078-082.
 */

import { extractPublicId } from '../extract-public-id.js';

/**
 * Minimal asset shape accepted by the traversal. Both `publicId` and `url`
 * are optional to accommodate partially-populated rows from the DB.
 */
export interface MediaAssetLike {
    readonly publicId?: string | null;
    readonly url?: string | null;
}

/**
 * Minimal `media` payload shape accepted by the traversal.
 */
export interface MediaLike {
    readonly featuredImage?: MediaAssetLike | null;
    readonly gallery?: readonly MediaAssetLike[] | null;
    readonly videos?: readonly MediaAssetLike[] | null;
}

/**
 * Entity wrapper — only the `media` key is consulted.
 */
export interface EntityWithMedia {
    readonly media?: MediaLike | null;
}

/**
 * Options for {@link extractAllMediaPublicIds}.
 */
export interface ExtractAllMediaPublicIdsOptions {
    /**
     * When true (default), duplicate publicIds across fields are collapsed.
     * Pass `false` to preserve the raw, order-preserving list.
     */
    readonly unique?: boolean;
}

/**
 * Collects every Cloudinary publicId referenced by `entity.media`.
 *
 * Iteration order: `featuredImage` → `gallery[]` (in order) → `videos[]`
 * (in order). Assets missing both `publicId` and a parseable `url` are
 * skipped silently.
 *
 * @param entity - Object that may expose a `media` payload
 * @param opts - Optional tuning knobs (see {@link ExtractAllMediaPublicIdsOptions})
 * @returns Array of resolved publicIds, optionally deduped
 *
 * @example
 * ```ts
 * const ids = extractAllMediaPublicIds({
 *   media: {
 *     featuredImage: { publicId: 'hospeda/prod/a/featured' },
 *     gallery: [
 *       { url: 'https://res.cloudinary.com/x/image/upload/v1/hospeda/prod/a/g1.jpg' },
 *       { publicId: 'hospeda/prod/a/g2' }
 *     ]
 *   }
 * });
 * // => ['hospeda/prod/a/featured', 'hospeda/prod/a/g1', 'hospeda/prod/a/g2']
 * ```
 */
export function extractAllMediaPublicIds(
    entity: EntityWithMedia | null | undefined,
    opts: ExtractAllMediaPublicIdsOptions = {}
): string[] {
    const { unique = true } = opts;

    if (!entity?.media) {
        return [];
    }

    const media = entity.media;
    const results: string[] = [];

    const push = (asset: MediaAssetLike | null | undefined): void => {
        if (!asset) return;
        if (typeof asset.publicId === 'string' && asset.publicId.length > 0) {
            results.push(asset.publicId);
            return;
        }
        if (typeof asset.url === 'string' && asset.url.length > 0) {
            const extracted = extractPublicId(asset.url);
            if (extracted) {
                results.push(extracted);
            }
        }
    };

    push(media.featuredImage);

    if (media.gallery) {
        for (const item of media.gallery) {
            push(item);
        }
    }

    if (media.videos) {
        for (const item of media.videos) {
            push(item);
        }
    }

    if (!unique) {
        return results;
    }

    return Array.from(new Set(results));
}
