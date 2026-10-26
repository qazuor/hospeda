import { randomUUID } from 'node:crypto';
import { accommodations, getDb, users } from '@repo/db';
import {
    buildPublishRequirementsReason,
    NO_PLANS_AVAILABLE_MESSAGE,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import {
    AccommodationService,
    computeTrialEmailPseudonym,
    ExperienceService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { eq } from 'drizzle-orm';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { PUBLICATION_LIMIT_KEYS } from '../../../../../packages/verticals/src/publication/publication-types';
import { emitTrialAnalyticsFact } from '../../utils/analytics/analytics-facts';
import { getClock } from '../../utils/clock';
import { getListingPublicationPorts } from '../../utils/listing-publication/ports';
import { loadListingMedia } from '../listing-media';
import { evaluateListingPublishCompleteness } from './listing-publish-completeness';
import { resolveSubscribeDestinationForUser } from './subscribe-destination.service';

const accommodationService = new AccommodationService({});
const gastronomyService = new VenueService({});
const experienceService = new ExperienceService({});

/** API composition shared by the three listing verticals for PB1 and PB6. */
export class ListingPublicationService {
    /** Publishes a listing through PB1 and returns its updated protected projection. */
    async publish(args: {
        readonly actor: Actor;
        readonly id: string;
        readonly vertical?: PublicationVertical;
    }) {
        const db = getDb();
        const vertical = args.vertical ?? VerticalEnum.ACCOMMODATION;
        let ownerId: string;

        switch (vertical) {
            case VerticalEnum.ACCOMMODATION: {
                const existing = await accommodationService.getById(args.actor, args.id);
                if (existing.error)
                    throw new ServiceError(existing.error.code, existing.error.message);
                if (!existing.data)
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                const completeness = await evaluateListingPublishCompleteness({
                    vertical,
                    listing: existing.data,
                    media: {}
                });
                if (!completeness.complete)
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Cannot publish accommodation: missing ${completeness.missing.join(', ')}`,
                        undefined,
                        buildPublishRequirementsReason({ missing: completeness.missing })
                    );
                ownerId = existing.data.ownerId;
                break;
            }
            case VerticalEnum.VENUE: {
                const existing = await gastronomyService.getById(args.actor, args.id);
                if (existing.error)
                    throw new ServiceError(existing.error.code, existing.error.message);
                if (!existing.data)
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
                const media = await loadListingMedia({ entityType: vertical, entityId: args.id });
                const completeness = await evaluateListingPublishCompleteness({
                    vertical,
                    listing: existing.data,
                    media
                });
                if (!completeness.complete)
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Listing incomplete: ${completeness.missing.join(', ')}`
                    );
                ownerId = existing.data.ownerId;
                break;
            }
            case VerticalEnum.EXPERIENCE: {
                const existing = await experienceService.getById(args.actor, args.id);
                if (existing.error)
                    throw new ServiceError(existing.error.code, existing.error.message);
                if (!existing.data)
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found');
                const media = await loadListingMedia({ entityType: vertical, entityId: args.id });
                const completeness = await evaluateListingPublishCompleteness({
                    vertical,
                    listing: existing.data,
                    media
                });
                if (!completeness.complete)
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Listing incomplete: ${completeness.missing.join(', ')}`
                    );
                ownerId = existing.data.ownerId;
                break;
            }
            default: {
                const exhaustiveCheck: never = vertical;
                throw new Error(`Unsupported publication vertical: ${exhaustiveCheck}`);
            }
        }

        const [owner] = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.id, ownerId))
            .limit(1);
        if (!owner) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing owner not found');
        const email = computeTrialEmailPseudonym({ email: owner.email });
        if (!email.ok)
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid owner email');

        const { publishListing } = await import(
            '../../../../../packages/verticals/src/publication/publish-listing'
        );
        const result = await publishListing({
            ...getListingPublicationPorts(),
            userId: ownerId,
            vertical,
            listingId: args.id,
            event: 'listing_published',
            emailPseudonym: email.pseudonym,
            correlationId: randomUUID()
        });
        if (!result.published) {
            if (isTrialStartDeniedReason(result.reason)) {
                const destination = await resolveSubscribeDestinationForUser({
                    userId: ownerId,
                    vertical
                });
                if (destination.destination === 'NO_PLANS_AVAILABLE')
                    throw new ServiceError(ServiceErrorCode.FORBIDDEN, NO_PLANS_AVAILABLE_MESSAGE);
            }
            throw mapListingPublishDenial(result.reason, vertical);
        }

        if (result.trialStarted)
            emitTrialAnalyticsFact({
                kind: 'TRIAL_STARTED',
                userId: ownerId,
                vertical,
                actorKind: 'USER',
                trialId: `${ownerId}:${vertical}`,
                activationEvent: 'listing_published',
                occurredAt: getClock().clock.now()
            });

        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [updated] = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, args.id))
                .limit(1);
            if (!updated)
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
            return updated;
        }
        return this.readProtectedProjection(args.actor, args.id, vertical);
    }

    /** Unpublishes a listing through PB6 and returns its updated protected projection. */
    async unpublish(args: {
        readonly actor: Actor;
        readonly id: string;
        readonly vertical?: PublicationVertical;
    }) {
        const vertical = args.vertical ?? VerticalEnum.ACCOMMODATION;
        const listing = await this.readListing(args.actor, args.id, vertical);
        if (!listing) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const { unpublishListing } = await import(
            '../../../../../packages/verticals/src/publication/unpublish-listing'
        );
        const result = await unpublishListing({
            ...getListingPublicationPorts(),
            userId: listing.ownerId,
            vertical,
            listingId: args.id,
            correlationId: randomUUID()
        });
        if (!result.unpublished) {
            if (result.reason === 'LISTING_NOT_FOUND')
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
            throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
        }
        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [updated] = await getDb()
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, args.id))
                .limit(1);
            if (!updated)
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
            return updated;
        }
        return this.readProtectedProjection(args.actor, args.id, vertical);
    }

    /** Reactivates an archived listing through PB8 and returns its protected projection. */
    async reactivate(args: {
        readonly actor: Actor;
        readonly id: string;
        readonly vertical?: PublicationVertical;
    }) {
        const vertical = args.vertical ?? VerticalEnum.ACCOMMODATION;
        const listing = await this.readListing(args.actor, args.id, vertical);
        if (!listing) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const { reactivateListing } = await import(
            '../../../../../packages/verticals/src/publication/reactivate-listing'
        );
        const result = await reactivateListing({
            ...getListingPublicationPorts(),
            userId: listing.ownerId,
            vertical,
            listingId: args.id,
            correlationId: randomUUID()
        });
        if (!result.reactivated) {
            if (result.reason === 'LISTING_NOT_FOUND' || result.reason === 'NOT_OWNER')
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
            throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
        }
        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [updated] = await getDb()
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, args.id))
                .limit(1);
            if (!updated)
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
            return updated;
        }
        return this.readProtectedProjection(args.actor, args.id, vertical);
    }

    private async readListing(
        actor: Actor,
        id: string,
        vertical: PublicationVertical
    ): Promise<{ readonly ownerId: string } | null> {
        switch (vertical) {
            case VerticalEnum.ACCOMMODATION: {
                const result = await accommodationService.getById(actor, id);
                if (result.error) throw new ServiceError(result.error.code, result.error.message);
                return result.data ? { ownerId: result.data.ownerId } : null;
            }
            case VerticalEnum.VENUE: {
                const result = await gastronomyService.getById(actor, id);
                if (result.error) throw new ServiceError(result.error.code, result.error.message);
                return result.data ? { ownerId: result.data.ownerId } : null;
            }
            case VerticalEnum.EXPERIENCE: {
                const result = await experienceService.getById(actor, id);
                if (result.error) throw new ServiceError(result.error.code, result.error.message);
                return result.data ? { ownerId: result.data.ownerId } : null;
            }
            default: {
                const exhaustiveCheck: never = vertical;
                throw new Error(`Unsupported publication vertical: ${exhaustiveCheck}`);
            }
        }
    }

    private async readProtectedProjection(
        actor: Actor,
        id: string,
        vertical: Exclude<PublicationVertical, typeof VerticalEnum.ACCOMMODATION>
    ) {
        if (vertical === VerticalEnum.VENUE) {
            const result = await gastronomyService.getById(actor, id);
            if (result.error) throw new ServiceError(result.error.code, result.error.message);
            if (!result.data)
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
            const { amenityIds, featureIds } = await gastronomyService.loadJunctionIds(id);
            return { ...result.data, amenityIds, featureIds };
        }
        const result = await experienceService.getById(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        if (!result.data)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found');
        const { amenityIds, featureIds } = await experienceService.loadJunctionIds(id);
        return { ...result.data, amenityIds, featureIds, meetingPointDirectionsEnabled: true };
    }
}

/** Maps PB1's closed decision outcomes to the HTTP contract for every vertical. */
export function mapListingPublishDenial(
    reason: string,
    vertical: PublicationVertical = VerticalEnum.ACCOMMODATION
): ServiceError {
    if (reason === 'LIMIT_REACHED')
        return new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Listing limit reached', {
            limitKey: PUBLICATION_LIMIT_KEYS[vertical]
        });
    if (reason === 'COVERED_USE_PB3' || reason === 'STATE_CHANGED' || reason === 'INVALID_FROM')
        return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
    if (reason === 'LISTING_NOT_FOUND' || reason === 'NOT_OWNER')
        return new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    return new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
}

function isTrialStartDeniedReason(reason: string): boolean {
    return [
        'EVENT_NOT_DECLARED_BY_VERTICAL',
        'TRIAL_DAYS_NOT_POSITIVE',
        'ALREADY_COVERED',
        'NO_SELLABLE_CURRENT_VERSION',
        'USER_ALREADY_HAS_TRIAL_ROW',
        'EMAIL_PSEUDONYM_ALREADY_USED'
    ].includes(reason);
}
