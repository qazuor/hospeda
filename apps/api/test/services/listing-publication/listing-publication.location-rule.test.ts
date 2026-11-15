/**
 * One-address rule at publish time (HOS-1810): a listing cannot be published onto
 * a place another PUBLISHED listing of the SAME owner and the same vertical
 * already occupies. Exceptions and other owners never block.
 */
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getState: vi.fn(),
    findOwnOccupant: vi.fn(),
    accommodationGetById: vi.fn(),
    venueGetById: vi.fn(),
    getDb: vi.fn(),
    publishListing: vi.fn()
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db');
    return {
        ...actual,
        getDb: mocks.getDb,
        users: { id: 'users.id', email: 'users.email' },
        accommodations: { id: 'accommodations.id' },
        listingLocationModel: {
            ...actual.listingLocationModel,
            getState: mocks.getState,
            findOwnOccupant: mocks.findOwnOccupant
        }
    };
});

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { getById: mocks.accommodationGetById };
        }),
        VenueService: vi.fn().mockImplementation(function () {
            return { getById: mocks.venueGetById };
        }),
        ExperienceService: vi.fn().mockImplementation(function () {
            return { getById: vi.fn() };
        }),
        computeTrialEmailPseudonym: () => ({ ok: true, pseudonym: 'pseudonym' })
    };
});

vi.mock('../../../../../packages/verticals/src/publication/publish-listing', () => ({
    publishListing: mocks.publishListing
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: () => ({})
}));
vi.mock('../../../src/services/listing-media', () => ({ loadListingMedia: async () => ({}) }));
vi.mock('../../../src/services/listing-publication/listing-publish-completeness', () => ({
    evaluateListingPublishCompleteness: async () => ({ complete: true, missing: [] })
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { ListingPublicationService } from '../../../src/services/listing-publication/listing-publication.service';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actor = { id: OWNER, role: 'HOST', permissions: [] } as never;
const state = { id: LISTING, ownerId: OWNER, locationKey: 'mitre|1|d', publicationStatus: 'DRAFT' };

/** Sentinel: the flow got past the rule and reached the owner lookup. */
const REACHED = 'REACHED_OWNER_LOOKUP';

describe('ListingPublicationService.publish: one-address rule', () => {
    const service = new ListingPublicationService();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.accommodationGetById.mockResolvedValue({ data: { id: LISTING, ownerId: OWNER } });
        mocks.venueGetById.mockResolvedValue({ data: { id: LISTING, ownerId: OWNER } });
        mocks.getDb.mockReturnValue({
            select: () => {
                throw new Error(REACHED);
            }
        });
    });

    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE
    ] as const)('answers 409 DUPLICATE_LOCATION with the own existing id (%s)', async (vertical) => {
        mocks.getState.mockResolvedValue({ ...state, hasException: false });
        mocks.findOwnOccupant.mockResolvedValue(OTHER);

        await expect(service.publish({ actor, id: LISTING, vertical })).rejects.toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'DUPLICATE_LOCATION',
            details: { reason: 'DUPLICATE_LOCATION', existingListingId: OTHER }
        });
        expect(mocks.findOwnOccupant).toHaveBeenCalledWith(
            expect.objectContaining({ vertical, ownerId: OWNER, excludeId: LISTING })
        );
    });

    it('lets a listing with an admin exception publish without looking for occupants', async () => {
        mocks.getState.mockResolvedValue({ ...state, hasException: true });
        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toThrow(REACHED);
        expect(mocks.findOwnOccupant).not.toHaveBeenCalled();
    });

    it('does not block when the address has no key (s/n, no number)', async () => {
        mocks.getState.mockResolvedValue({ ...state, locationKey: null, hasException: false });
        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.ACCOMMODATION })
        ).rejects.toThrow(REACHED);
        expect(mocks.findOwnOccupant).not.toHaveBeenCalled();
    });

    it('does not block when only ANOTHER owner holds the place (the query is owner-scoped)', async () => {
        mocks.getState.mockResolvedValue({ ...state, hasException: false });
        mocks.findOwnOccupant.mockResolvedValue(null);
        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toThrow(REACHED);
        expect(mocks.findOwnOccupant).toHaveBeenCalledWith(
            expect.objectContaining({ ownerId: OWNER })
        );
    });
});

describe('ListingPublicationService.publish: concurrent publish (HOS-1810)', () => {
    const service = new ListingPublicationService();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.venueGetById.mockResolvedValue({ data: { id: LISTING, ownerId: OWNER } });
        mocks.getState.mockResolvedValue({ ...state, hasException: false });
        mocks.findOwnOccupant.mockResolvedValue(null);
        mocks.getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: async () => [{ id: OWNER, email: 'owner@example.com' }]
                    })
                })
            })
        });
    });

    it('answers 409 DUPLICATE_LOCATION when the unique index refuses the write (23505 in error.cause)', async () => {
        const driver = Object.assign(new Error('duplicate key'), {
            code: '23505',
            constraint: 'venues_ownerId_locationKey_published_uniq'
        });
        mocks.publishListing.mockRejectedValue(
            new Error('Failed query: update', { cause: driver })
        );

        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'DUPLICATE_LOCATION'
        });
    });

    it('rethrows any other failure untouched', async () => {
        const boom = new Error('boom');
        mocks.publishListing.mockRejectedValue(boom);
        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toBe(boom);
    });
});

describe('ListingPublicationService.publish: DUPLICATE_LOCATION wins over LIMIT_REACHED (HOS-1810)', () => {
    const service = new ListingPublicationService();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.venueGetById.mockResolvedValue({ data: { id: LISTING, ownerId: OWNER } });
        mocks.getState.mockResolvedValue({ ...state, hasException: false });
        mocks.getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: async () => [{ id: OWNER, email: 'owner@example.com' }]
                    })
                })
            })
        });
        // The plan cap is full: PB1 would answer LIMIT_REACHED for this owner.
        mocks.publishListing.mockResolvedValue({ published: false, reason: 'LIMIT_REACHED' });
    });

    it('an owner at the plan cap publishing a duplicate gets 409 DUPLICATE_LOCATION', async () => {
        mocks.findOwnOccupant.mockResolvedValue(OTHER);

        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'DUPLICATE_LOCATION',
            details: { existingListingId: OTHER }
        });
        // The cap was never consulted: the duplicate check runs first.
        expect(mocks.publishListing).not.toHaveBeenCalled();
    });

    it('an owner at the plan cap publishing on a free address gets LIMIT_REACHED', async () => {
        mocks.findOwnOccupant.mockResolvedValue(null);

        await expect(
            service.publish({ actor, id: LISTING, vertical: VerticalEnum.VENUE })
        ).rejects.toMatchObject({ code: ServiceErrorCode.LIMIT_REACHED });
        expect(mocks.publishListing).toHaveBeenCalledTimes(1);
    });
});
