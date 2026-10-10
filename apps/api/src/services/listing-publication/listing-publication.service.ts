import { randomUUID } from 'node:crypto';
import { accommodations, getDb, users } from '@repo/db';
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { AccommodationService, computeTrialEmailPseudonym, ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { PUBLICATION_LIMIT_KEYS } from '../../../../../packages/verticals/src/publication/publication-types';
import { getListingPublicationPorts } from '../../utils/listing-publication/ports';

/** Thin API composition for the accommodation publication state machine. */
export class ListingPublicationService {
    private readonly accommodationService = new AccommodationService({});

    /** Publishes an accommodation through PB1 and returns its updated row. */
    async publish(args: { readonly actor: Actor; readonly id: string }) {
        const db = getDb();
        const existing = await this.accommodationService.getById(args.actor, args.id);
        if (existing.error) throw new ServiceError(existing.error.code, existing.error.message);
        if (!existing.data)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        await this.accommodationService.assertPublishCompleteness({ accommodation: existing.data });
        const ownerId = existing.data.ownerId;
        const [owner] = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .innerJoin(accommodations, eq(accommodations.ownerId, users.id))
            .where(eq(accommodations.id, args.id))
            .limit(1);
        if (!owner) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        const email = computeTrialEmailPseudonym({ email: owner.email });
        if (!email.ok)
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid owner email');
        const ports = getListingPublicationPorts();
        const { publishListing } = await import(
            '../../../../../packages/verticals/src/publication/publish-listing'
        );
        const result = await publishListing({
            ...ports,
            userId: ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: args.id,
            event: 'listing_published',
            emailPseudonym: email.pseudonym,
            correlationId: randomUUID()
        });
        if (!result.published) throw mapListingPublishDenial(result.reason);
        const [updated] = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, args.id))
            .limit(1);
        if (!updated) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        return updated;
    }

    /** Unpublishes an accommodation through PB6 and returns its updated row. */
    async unpublish(args: { readonly actor: Actor; readonly id: string }) {
        const { unpublishListing } = await import(
            '../../../../../packages/verticals/src/publication/unpublish-listing'
        );
        const ports = getListingPublicationPorts();
        const [listing] = await getDb()
            .select({ ownerId: accommodations.ownerId })
            .from(accommodations)
            .where(eq(accommodations.id, args.id))
            .limit(1);
        if (!listing) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        const result = await unpublishListing({
            ...ports,
            userId: listing.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: args.id,
            correlationId: randomUUID()
        });
        if (!result.unpublished) {
            if (result.reason === 'LISTING_NOT_FOUND')
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
            throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
        }
        const [updated] = await getDb()
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, args.id))
            .limit(1);
        if (!updated) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        return updated;
    }
}

/** Maps PB1's closed decision outcomes to the HTTP contract. */
export function mapListingPublishDenial(reason: string): ServiceError {
    if (reason === 'LIMIT_REACHED')
        return new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Listing limit reached', {
            limitKey: PUBLICATION_LIMIT_KEYS[VerticalEnum.ACCOMMODATION]
        });
    if (reason === 'COVERED_USE_PB3' || reason === 'STATE_CHANGED' || reason === 'INVALID_FROM')
        return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
    if (reason === 'LISTING_NOT_FOUND' || reason === 'NOT_OWNER')
        return new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
    return new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
}
