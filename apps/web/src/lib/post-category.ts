/**
 * @file post-category.ts
 * @description Utilities for mapping between PostCategoryEnum values and their
 * URL-safe lowercase slugs. Provides a single source of truth derived from the
 * enum itself so the slug map never drifts from the schema definition.
 *
 * The canonical slug for any enum value is its lowercase form:
 *   `PostCategoryEnum.CULTURE` → `'culture'`
 *   `PostCategoryEnum.NIGHTLIFE` → `'nightlife'`
 */

import { PostCategoryEnum } from '@repo/schemas';

/**
 * Mapping from lowercase URL slug to the corresponding PostCategoryEnum value.
 * Derived directly from PostCategoryEnum so it is always complete and
 * never diverges from the schema.
 *
 * @example
 * ```ts
 * POST_CATEGORY_SLUG_MAP['culture']  // PostCategoryEnum.CULTURE
 * POST_CATEGORY_SLUG_MAP['general']  // PostCategoryEnum.GENERAL
 * ```
 */
export const POST_CATEGORY_SLUG_MAP: Readonly<Record<string, PostCategoryEnum>> = Object.freeze(
    Object.fromEntries(
        Object.values(PostCategoryEnum).map((value) => [value.toLowerCase(), value])
    ) as Record<string, PostCategoryEnum>
);

/**
 * Resolve a URL slug (or raw enum value) to its PostCategoryEnum counterpart.
 *
 * The lookup is intentionally case-insensitive so both lowercase slugs used in
 * URLs (`/publicaciones/categoria/culture/`) and uppercase enum strings that
 * may arrive via old links or query-string params (`CULTURE`) resolve correctly.
 *
 * Returns `undefined` when the slug does not match any known category.
 *
 * @param params - Object containing the raw `slug` from the URL or query string.
 * @returns The matching `PostCategoryEnum` value, or `undefined` if not found.
 *
 * @example
 * ```ts
 * resolvePostCategorySlug({ slug: 'culture' })   // PostCategoryEnum.CULTURE
 * resolvePostCategorySlug({ slug: 'CULTURE' })   // PostCategoryEnum.CULTURE
 * resolvePostCategorySlug({ slug: 'unknown' })   // undefined
 * resolvePostCategorySlug({ slug: undefined })   // undefined
 * ```
 */
export function resolvePostCategorySlug({
    slug
}: {
    readonly slug: string | undefined;
}): PostCategoryEnum | undefined {
    if (!slug) return undefined;
    return POST_CATEGORY_SLUG_MAP[slug.toLowerCase()];
}
