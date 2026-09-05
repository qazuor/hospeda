/**
 * Public-tier "featured" resolution (HOS-929).
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
