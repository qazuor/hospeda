/**
 * @file commerce-editor-detail.ts
 * @description Readers that turn one loaded commerce listing into the shapes the
 * editor's pages need (HOS-1080).
 *
 * `CommerceListingDetail` is a `gastronomy | experience` union, and the editor
 * reads heterogeneous fields off it by key — something the union type cannot
 * express, which is why the pre-split page carried a double-cast bridge to a
 * loose record plus inline extraction in its frontmatter. With eleven pages
 * instead of one, that bridge had to stop being copy-paste: these functions are
 * the single place the loose read happens, so a field is parsed the same way for
 * the hub's status line and for the page that edits it.
 *
 * Every reader degrades rather than throws. A listing saved before a column
 * existed, or a payload whose optional block is absent, must render an editor —
 * not a 500 on a page whose whole purpose is to fix incomplete data.
 */

import type { CommerceListingCompletenessListing, Image } from '@repo/schemas';
import type { CommerceFaq } from '@/components/commerce/CommerceFaqManager.client';
import type { CommerceListingDetail } from '@/lib/commerce/owner-listings';

/** The loose record view of a listing detail. */
function asRecord(detail: CommerceListingDetail): Record<string, unknown> {
    // TYPE-WORKAROUND: the detail is a gastronomy|experience union; the editor
    // reads heterogeneous operational fields by key, which the union cannot
    // express.
    return detail as unknown as Record<string, unknown>;
}

/**
 * Reads the FAQs stored for a listing.
 *
 * The protected detail includes them when available; anything else collapses to
 * an empty list. Preserved from the pre-split page so `CommerceFaqManager`
 * paints real data on first paint instead of flashing empty and filling in.
 *
 * @param params - The loaded listing detail.
 * @returns The FAQs, in the order the API returned them.
 */
export function readCommerceListingFaqs({
    detail
}: {
    readonly detail: CommerceListingDetail;
}): readonly CommerceFaq[] {
    const raw = asRecord(detail).faqs;
    if (!Array.isArray(raw)) return [];

    return (raw as Array<Record<string, unknown>>).map((faq) => ({
        id: typeof faq.id === 'string' ? faq.id : '',
        question: typeof faq.question === 'string' ? faq.question : '',
        answer: typeof faq.answer === 'string' ? faq.answer : '',
        category: typeof faq.category === 'string' ? faq.category : null,
        displayOrder: typeof faq.displayOrder === 'number' ? faq.displayOrder : null
    }));
}

/**
 * Reads the media block's first-paint placeholders.
 *
 * These feed `MediaSection`'s SSR placeholders only. It hydrates its own state
 * from the relational media endpoints and persists every operation there
 * (HOS-372), so nothing read here is ever written back.
 *
 * @param params - The loaded listing detail.
 * @returns The featured image (or `null`) and the gallery.
 */
export function readCommerceListingMedia({ detail }: { readonly detail: CommerceListingDetail }): {
    readonly featuredImage: Image | null;
    readonly gallery: readonly Image[];
} {
    const media = (asRecord(detail).media ?? {}) as Record<string, unknown>;

    return {
        featuredImage: (media.featuredImage as Image | undefined) ?? null,
        gallery: (media.gallery as Image[] | undefined) ?? []
    };
}

/** What the commerce editor hub needs to describe each section. */
export interface CommerceEditorHubFacts {
    /** The listing in the shape `resolveListingCompleteness` evaluates. */
    readonly listing: CommerceListingCompletenessListing;
    /** Photos already uploaded, featured image included. */
    readonly photoCount: number;
    /** FAQs already stored. */
    readonly faqCount: number;
    /** Amenities plus features currently ticked. */
    readonly selectedCatalogCount: number;
}

/**
 * Gathers everything the hub's status lines are derived from.
 *
 * The `listing` member is passed to `resolveListingCompleteness` UNCHANGED, so
 * the hub and the publish path reach the same verdict by running the same code
 * rather than two similar-looking copies of it — the rule H-101 established on
 * the accommodation side after the hub warned about what did not block and
 * stayed silent about what did.
 *
 * @param params - The loaded listing detail.
 * @returns The facts, all counts zero-safe.
 */
export function readCommerceEditorHubFacts({
    detail
}: {
    readonly detail: CommerceListingDetail;
}): CommerceEditorHubFacts {
    const data = asRecord(detail);
    const media = readCommerceListingMedia({ detail });

    const amenityIds = Array.isArray(data.amenityIds) ? data.amenityIds.length : 0;
    const featureIds = Array.isArray(data.featureIds) ? data.featureIds.length : 0;

    return {
        // TYPE-WORKAROUND: the completeness input is a structural subset of both
        // vertical detail shapes, but the union does not declare it, so the two
        // cannot be related without restating every field.
        listing: detail as unknown as CommerceListingCompletenessListing,
        photoCount: media.gallery.length + (media.featuredImage ? 1 : 0),
        faqCount: readCommerceListingFaqs({ detail }).length,
        selectedCatalogCount: amenityIds + featureIds
    };
}
