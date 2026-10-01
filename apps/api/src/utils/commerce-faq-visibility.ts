/**
 * Public-tier FAQ visibility for the commerce verticals (HOS-1263).
 *
 * `gastronomies` and `experiences` carry an owner-controlled
 * `isVisibleOnListing` flag on each FAQ (HOS-400). The dedicated
 * `GET .../:id/faqs` routes filter it, but the listing page reads the FAQs
 * EMBEDDED in `getBySlug` / `getById`, because the services load `faqs: true`
 * as a default relation. Filtering only the dedicated route left the embedded
 * path publishing FAQs the owner had marked private.
 *
 * The filter runs server-side so a hidden FAQ never enters the payload; hiding
 * it in the Astro component would still ship it in the page HTML.
 *
 * A guard test (`commerce-faq-visibility.guard.test.ts`) requires every public
 * commerce route that returns a whole listing to go through this helper.
 *
 * @module utils/commerce-faq-visibility
 */

/** Minimal FAQ shape this helper needs. */
export interface FaqVisibilityColumns {
    readonly isVisibleOnListing?: boolean | null;
    readonly lifecycleState?: string | null;
    readonly deletedAt?: Date | string | null;
}

/**
 * Keeps the FAQs a public reader may see: ACTIVE, not soft-deleted, and not
 * hidden by the owner. This is the same predicate accommodation applies in SQL.
 * It is needed here because the commerce services load FAQs through a
 * `with: { faqs: true }` relation, which filters neither soft-deleted nor
 * non-ACTIVE rows, and deleting a commerce FAQ is a soft delete. A missing
 * `isVisibleOnListing` (pre-migration data) reads as visible, matching the
 * column's `DEFAULT true`.
 *
 * @param faqs - FAQ rows as loaded by the service.
 * @returns Only the publicly visible rows.
 */
export const filterPublicFaqs = <T extends FaqVisibilityColumns>(faqs: ReadonlyArray<T>): T[] =>
    faqs.filter(
        (faq) =>
            faq.deletedAt == null &&
            faq.lifecycleState === 'ACTIVE' &&
            faq.isVisibleOnListing !== false
    );

/**
 * Returns `entity` with its embedded `faqs` reduced by {@link filterPublicFaqs}.
 * An entity without a `faqs` array is returned unchanged.
 *
 * @param entity - A listing row that may carry an embedded `faqs` array.
 * @returns The same listing with non-public FAQs removed.
 */
export const withPublicVisibleFaqs = <
    T extends { readonly faqs?: ReadonlyArray<FaqVisibilityColumns> | null }
>(
    entity: T
): T => {
    if (!Array.isArray(entity.faqs)) return entity;
    return { ...entity, faqs: filterPublicFaqs(entity.faqs) };
};
