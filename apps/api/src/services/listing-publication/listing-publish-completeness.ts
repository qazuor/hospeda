import { accommodationModel, experienceModel, venueModel } from '@repo/db';
import {
    type Accommodation,
    type Experience,
    type Media,
    resolveListingCompleteness,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { loadListingMedia } from '../listing-media';

type ListingInput =
    | {
          readonly vertical: typeof VerticalEnum.ACCOMMODATION;
          readonly listing: Accommodation;
          readonly media: Media;
      }
    | {
          readonly vertical: typeof VerticalEnum.VENUE;
          readonly listing: Venue;
          readonly media: Media;
      }
    | {
          readonly vertical: typeof VerticalEnum.EXPERIENCE;
          readonly listing: Experience;
          readonly media: Media;
      };

/** Evaluates the exact publish-completeness rules shared by PB1 and HOS-1744 PB3. */
export function evaluateListingPublishCompleteness(
    args: Extract<ListingInput, { vertical: typeof VerticalEnum.ACCOMMODATION }>
): Promise<{
    readonly complete: boolean;
    readonly missing: Awaited<
        ReturnType<AccommodationService['readPublishCompleteness']>
    >['missing'];
}>;
export function evaluateListingPublishCompleteness(
    args: Exclude<ListingInput, { vertical: typeof VerticalEnum.ACCOMMODATION }>
): Promise<{
    readonly complete: boolean;
    readonly missing: readonly string[];
}>;
export async function evaluateListingPublishCompleteness(
    args: ListingInput
): Promise<{ readonly complete: boolean; readonly missing: readonly string[] }> {
    if (args.vertical === VerticalEnum.ACCOMMODATION)
        return new AccommodationService({}).readPublishCompleteness({
            accommodation: args.listing
        });
    const result = resolveListingCompleteness({
        entityType: args.vertical,
        listing: { ...args.listing, media: args.media }
    });
    return { complete: result.complete, missing: result.missing };
}

/** Reads candidates without an actor and applies the same evaluator as the publish button. */
export async function readIncompleteListingIds(args: {
    readonly vertical: PublicationVertical;
    readonly listingIds: readonly string[];
}): Promise<ReadonlyMap<string, readonly string[]>> {
    const incomplete = new Map<string, readonly string[]>();
    switch (args.vertical) {
        case VerticalEnum.ACCOMMODATION: {
            const listings = await accommodationModel.findByIds(args.listingIds);
            for (const listing of listings) {
                const result = await evaluateListingPublishCompleteness({
                    vertical: args.vertical,
                    listing,
                    media: {}
                });
                if (!result.complete) incomplete.set(listing.id, result.missing);
            }
            break;
        }
        case VerticalEnum.VENUE: {
            const listings = await venueModel.findByIds(args.listingIds);
            for (const listing of listings) {
                const media = await loadListingMedia({
                    entityType: args.vertical,
                    entityId: listing.id
                });
                const result = await evaluateListingPublishCompleteness({
                    vertical: args.vertical,
                    listing,
                    media
                });
                if (!result.complete) incomplete.set(listing.id, result.missing);
            }
            break;
        }
        case VerticalEnum.EXPERIENCE: {
            const listings = await experienceModel.findByIds(args.listingIds);
            for (const listing of listings) {
                const media = await loadListingMedia({
                    entityType: args.vertical,
                    entityId: listing.id
                });
                const result = await evaluateListingPublishCompleteness({
                    vertical: args.vertical,
                    listing,
                    media
                });
                if (!result.complete) incomplete.set(listing.id, result.missing);
            }
            break;
        }
    }
    return incomplete;
}
