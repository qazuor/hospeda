/**
 * Public-tier "featured" resolution (HOS-929; extended to the gastronomy and experience
 * verticals by HOS-1286).
 *
 * The module keeps its accommodation-era filename because the helper is
 * imported at fifteen sites and the rename would be noise, but its subject is
 * now every listing that carries the two columns — `accommodations`,
 * `gastronomies` and `experiences`. `FeaturedSourceColumns` was already
 * structural rather than tied to `Accommodation`, so nothing here had to change
 * for the other two to use it.
 *
 * Each listing table carries ONE featuring column, `featuredByEntitlement`
 * (billing-derived — set by the sync primitives in
 * `accommodation.sync-featured-by-entitlement.ts`). Until HOS-1419 a second,
 * admin-curated `is_featured` column was OR'd with it here; that column was
 * dropped with the old billing, so the public `isFeatured` value is now the
 * entitlement flag alone. The 2026-08-29 owner decision still holds: holding
 * the entitlement features the listing on every PUBLIC-facing read, with no
 * owner-facing toggle.
 *
 * This derivation is applied ONLY on public/* routes — never in the generic
 * service (shared with admin/protected) and never in the DB ordering resolver
 * (`accommodation.model.ts`, which orders by the column directly). Admin and
 * protected responses show `featuredByEntitlement` under its own name.
 *
 * @module utils/accommodation-featured
 */

/**
 * Minimal shape this helper needs: the featuring source column as it comes
 * off a listing entity or a raw DB row.
 */
export interface FeaturedSourceColumns {
    readonly featuredByEntitlement?: boolean | null;
}

/**
 * Resolves the PUBLIC-facing `isFeatured` value: true when the billing-derived
 * entitlement flag is true (the only featuring source since HOS-1419).
 *
 * @param input - The listing's featuring source column.
 * @returns The boolean to serialize as `isFeatured` on a public response.
 */
export const resolvePublicIsFeatured = (input: FeaturedSourceColumns): boolean =>
    Boolean(input.featuredByEntitlement);

/**
 * Returns `entity` with its PUBLIC `isFeatured` resolved (HOS-1286).
 *
 * The accommodation routes had a natural place to apply
 * {@link resolvePublicIsFeatured}, because each already built its response
 * object for other reasons. The gastronomy and experience routes do not: `getById` and both
 * `getByDestination` handlers return what the service handed them, untouched.
 * Introducing four hand-written spreads there is four chances to derive it
 * one way in one file and another way in the next, so the spread lives here
 * once.
 *
 * @param entity - Any row carrying the featuring source column.
 * @returns A shallow copy whose `isFeatured` is resolved.
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
