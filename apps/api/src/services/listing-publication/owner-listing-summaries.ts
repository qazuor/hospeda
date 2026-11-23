/**
 * @file owner-listing-summaries.ts
 * @description Builds the owner-listing summaries of `GET /{venues|experiences}/mine`
 * (SPEC-249), with each unpublished listing's unmet publish requirements read
 * in ONE batch per vertical (HOS-2484).
 *
 * The web listing index used to fetch every unpublished listing's detail to
 * compute its checklist, one request per listing (the N+1 of HOS-2484). The
 * requirements now travel in the list payload, from
 * `evaluateListingsPublishCompleteness` — the same rules the publish button and
 * the owner summary use, over one media query.
 *
 * A failed evaluation never invents a checklist: the field is left out and the
 * card reads its state as unknown.
 */

import {
    type Experience,
    type OwnerListingSummary,
    ProductDomainEnum,
    PublicationStatusEnum,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import { apiLogger } from '../../utils/logger';
import { evaluateListingsPublishCompleteness } from './listing-publish-completeness-batch';

/** The owner's stored listings of one vertical. */
export type OwnerListingRows =
    | { readonly vertical: typeof VerticalEnum.VENUE; readonly listings: readonly Venue[] }
    | {
          readonly vertical: typeof VerticalEnum.EXPERIENCE;
          readonly listings: readonly Experience[];
      };

/** Which listings carry a checklist: every state that is neither public nor deleted. */
function needsChecklist(status: PublicationStatusEnum): boolean {
    return status !== PublicationStatusEnum.PUBLISHED && status !== PublicationStatusEnum.PURGED;
}

/**
 * Reads the unmet publish requirements of the listings that need a checklist.
 *
 * @param input - The vertical and its stored listings
 * @returns Listing id → unmet requirements (only incomplete ones present), or
 *   `null` when the evaluation failed.
 */
async function readMissingRequirements(
    input: OwnerListingRows
): Promise<ReadonlyMap<string, readonly string[]> | null> {
    try {
        if (input.vertical === VerticalEnum.VENUE) {
            return await evaluateListingsPublishCompleteness({
                vertical: VerticalEnum.VENUE,
                listings: input.listings.filter((row) => needsChecklist(row.publicationStatus))
            });
        }
        return await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.EXPERIENCE,
            listings: input.listings.filter((row) => needsChecklist(row.publicationStatus))
        });
    } catch (error) {
        apiLogger.warn(
            {
                vertical: input.vertical,
                error: error instanceof Error ? error.message : String(error)
            },
            'owner listing summaries: publish requirements read failed'
        );
        return null;
    }
}

/**
 * Maps the owner's stored listings of one vertical to index summaries.
 *
 * @param input - The vertical and its stored listings
 * @returns The summaries, in the stored order. An unpublished, non-deleted
 *   listing carries `missingRequirements` (empty when complete) unless the
 *   evaluation failed.
 */
export async function buildOwnerListingSummaries(
    input: OwnerListingRows
): Promise<OwnerListingSummary[]> {
    const missing = await readMissingRequirements(input);
    const vertical =
        input.vertical === VerticalEnum.VENUE
            ? ProductDomainEnum.VENUE
            : ProductDomainEnum.EXPERIENCE;
    return input.listings.map((listing) => {
        // V6.9b (HOS-1641): both flags read the single publication state. Only
        // a PUBLISHED listing is public and has a public page; every protected
        // route that prints something for a listing answers 404 for any other
        // state, so a card must not offer those downloads.
        const published = listing.publicationStatus === PublicationStatusEnum.PUBLISHED;
        const summary: OwnerListingSummary = {
            id: listing.id,
            vertical,
            name: listing.name,
            slug: listing.slug,
            type: listing.type,
            isPublic: published,
            hasPublicPage: published,
            publicationStatus: listing.publicationStatus
        };
        if (missing === null || !needsChecklist(listing.publicationStatus)) return summary;
        return { ...summary, missingRequirements: [...(missing.get(listing.id) ?? [])] };
    });
}
