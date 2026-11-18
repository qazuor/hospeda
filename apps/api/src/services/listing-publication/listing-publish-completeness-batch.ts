/**
 * @file listing-publish-completeness-batch.ts
 * @description The batch twin of `evaluateListingPublishCompleteness`
 * (`listing-publish-completeness.ts`): the same publish rules over MANY listings
 * of one vertical, with ONE media query instead of one per listing (HOS-2331,
 * the owner summary's "incomplete" and "missing photos" items).
 *
 * The rules are not restated here. Accommodation uses
 * `buildAccommodationPublishReadinessInput` + `resolveMissingPublishRequirements`,
 * the exact pair `AccommodationService.readPublishCompleteness` runs; venue and
 * experience use `resolveListingCompleteness` over the media composed by
 * `loadListingMediaMany`, the batch twin of the loader the publish button uses.
 */

import { accommodationMediaModel } from '@repo/db';
import {
    type Accommodation,
    type Experience,
    resolveListingCompleteness,
    resolveMissingPublishRequirements,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import { buildAccommodationPublishReadinessInput } from '@repo/service-core';
import { loadListingMediaMany } from '../listing-media';

/** The listings of one vertical to evaluate, as stored. */
export type ListingsCompletenessInput =
    | {
          readonly vertical: typeof VerticalEnum.ACCOMMODATION;
          readonly listings: readonly Accommodation[];
      }
    | { readonly vertical: typeof VerticalEnum.VENUE; readonly listings: readonly Venue[] }
    | {
          readonly vertical: typeof VerticalEnum.EXPERIENCE;
          readonly listings: readonly Experience[];
      };

/**
 * Evaluates the publish completeness of many listings of one vertical.
 *
 * @param input - The vertical and its stored listings
 * @returns Map of listing id → the unmet requirements, in the order the rules
 *   report them. Only incomplete listings are present.
 * @throws {Error} Propagates a media read error (an unread gallery must never
 *   be reported as "no photos").
 */
export async function evaluateListingsPublishCompleteness(
    input: ListingsCompletenessInput
): Promise<ReadonlyMap<string, readonly string[]>> {
    const incomplete = new Map<string, readonly string[]>();
    if (input.listings.length === 0) {
        return incomplete;
    }
    const ids = input.listings.map((listing) => listing.id);
    switch (input.vertical) {
        case VerticalEnum.ACCOMMODATION: {
            const rows = await accommodationMediaModel.findByAccommodations({
                accommodationIds: ids
            });
            for (const accommodation of input.listings) {
                const missing = resolveMissingPublishRequirements({
                    input: buildAccommodationPublishReadinessInput({
                        accommodation,
                        mediaRows: rows.get(accommodation.id) ?? []
                    })
                });
                if (missing.length > 0) incomplete.set(accommodation.id, missing);
            }
            return incomplete;
        }
        case VerticalEnum.VENUE:
        case VerticalEnum.EXPERIENCE: {
            const media = await loadListingMediaMany({
                entityType: input.vertical,
                entityIds: ids
            });
            for (const listing of input.listings) {
                const result = resolveListingCompleteness({
                    entityType: input.vertical,
                    listing: { ...listing, media: media.get(listing.id) ?? {} }
                });
                if (!result.complete) incomplete.set(listing.id, result.missing);
            }
            return incomplete;
        }
        default: {
            const exhaustive: never = input;
            throw new Error(`Unsupported vertical ${String(exhaustive)}`);
        }
    }
}
