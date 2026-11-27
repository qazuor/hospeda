import { type AnyColumn, asc, isNull, type SQL, sql } from 'drizzle-orm';

/**
 * The columns of a listing FAQ table (`venue_faqs`, `experience_faqs`) that
 * the FAQ relation config reads.
 */
interface ListingFaqFields {
    readonly deletedAt: AnyColumn;
    readonly displayOrder: AnyColumn;
    readonly createdAt: AnyColumn;
}

/**
 * Drizzle relational `with` config for a listing's `faqs` relation (HOS-2670).
 *
 * Skips soft-deleted rows and orders by `display_order ASC NULLS LAST,
 * created_at ASC` (SPEC-177 T-012), the same contract
 * `AccommodationModel.findWithRelations` applies to `accommodation_faqs`.
 * Visibility (`isVisibleOnListing`, `lifecycleState`) is NOT filtered here,
 * matching that accommodation contract.
 */
export const LISTING_FAQS_RELATION = {
    where: (fields: ListingFaqFields): SQL => isNull(fields.deletedAt),
    orderBy: (fields: ListingFaqFields): SQL[] => [
        sql`${fields.displayOrder} ASC NULLS LAST`,
        asc(fields.createdAt)
    ]
} as const;
