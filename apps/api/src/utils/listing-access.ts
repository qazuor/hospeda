import { PublicationStatusEnumSchema } from '@repo/schemas';
import type { ListingAccessFacts } from '@repo/verticals';
import { z } from 'zod';

const listingAccessFactsSchema = z.object({
    ownerId: z.string().nullish(),
    publicationStatus: PublicationStatusEnumSchema.nullish()
});
const listingOwnerSchema = listingAccessFactsSchema.pick({ ownerId: true });

/** Read the raw service row's authorization facts without trusting its domain projection. */
export function readListingAccessFacts(args: {
    readonly entity: unknown;
}): ListingAccessFacts | null {
    if (args.entity === null || typeof args.entity !== 'object') return null;
    const parsed = listingAccessFactsSchema.safeParse(args.entity);
    if (!parsed.success) {
        const owner = listingOwnerSchema.safeParse(args.entity);
        return {
            ownerId: owner.success ? (owner.data.ownerId ?? null) : null,
            publicationStatus: null
        };
    }
    return {
        ownerId: parsed.data.ownerId ?? null,
        publicationStatus: parsed.data.publicationStatus ?? null
    };
}
