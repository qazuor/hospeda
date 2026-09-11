/**
 * Public-tier "featured" resolution (HOS-929; extended to the commerce
 * verticals by HOS-1286).
 *
 * The module keeps its accommodation-era filename because the helper is
 * imported at fifteen sites and the rename would be noise, but its subject is
 * now every listing that carries the two columns — `accommodations`,
 * `gastronomies` and `experiences`. `FeaturedSourceColumns` was already
 * structural rather than tied to `Accommodation`, so nothing here had to change
 * for the other two to use it.
 *
 * `accommodations` carries TWO deliberately independent boolean columns
 * (SPEC-292, renamed SPEC-309 OQ-3): `isFeatured` (admin-curated) and
 * `featuredByEntitlement` (billing-derived — set by the plan/addon sync
 * primitives in `accommodation.sync-featured-by-entitlement.ts`). The 2026-08-29
 * owner decision is that holding EITHER counts as "featured" for every
 * PUBLIC-facing read, with no owner-facing toggle: an owner who buys the
 * visibility-boost addon (or holds a plan that grants FEATURED_LISTING) sees
 * the badge automatically, for as long as the entitlement lasts.
 *
 * This OR is applied ONLY on public/* routes — never in the generic service
 * (shared with admin/protected) and never in the DB ordering resolver
 * (`accommodation.model.ts`, which already ORs the two columns for sort
 * order only, independently of this read-side helper). Admin and protected
 * responses keep showing the two source columns separately.
 *
 * @module utils/accommodation-featured
 */

/**
 * Minimal shape this helper needs: the two independent "featured" source
 * columns as they come off an `Accommodation` entity or a raw DB row.
 */
export interface FeaturedSourceColumns {
    readonly isFeatured: boolean;
    readonly featuredByEntitlement?: boolean | null;
}

/**
 * Resolves the PUBLIC-facing `isFeatured` value: true when either the
 * admin-curated flag or the billing-derived entitlement flag is true.
 *
 * @param input - The accommodation's two independent featured source columns.
 * @returns The OR'd boolean to serialize as `isFeatured` on a public response.
 */
export const resolvePublicIsFeatured = (input: FeaturedSourceColumns): boolean =>
    input.isFeatured || Boolean(input.featuredByEntitlement);

/**
 * Returns `entity` with its PUBLIC `isFeatured` resolved (HOS-1286).
 *
 * The accommodation routes had a natural place to apply
 * {@link resolvePublicIsFeatured}, because each already built its response
 * object for other reasons. The commerce routes do not: `getById` and both
 * `getByDestination` handlers return what the service handed them, untouched.
 * Introducing four hand-written spreads there is four chances to write the OR
 * one way in one file and another way in the next, so the spread lives here
 * once.
 *
 * @param entity - Any row carrying the two featured source columns.
 * @returns A shallow copy whose `isFeatured` is the disjunction.
 */
export const withPublicIsFeatured = <T extends FeaturedSourceColumns>(
    entity: T
): T & { isFeatured: boolean } => ({
    ...entity,
    isFeatured: resolvePublicIsFeatured(entity)
});

/**
 * List form of {@link withPublicIsFeatured}.
 *
 * @param items - The page of listings to serialize.
 * @returns The same items with each `isFeatured` resolved.
 */
export const withPublicIsFeaturedList = <T extends FeaturedSourceColumns>(
    items: readonly T[]
): (T & { isFeatured: boolean })[] => items.map(withPublicIsFeatured);
