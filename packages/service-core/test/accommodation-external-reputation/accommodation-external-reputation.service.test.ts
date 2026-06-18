/**
 * Unit tests for AccommodationExternalReputationService (SPEC-237 T-007)
 *
 * Covers:
 * - refresh: full success, partial failure (one platform errors), rate-limited
 * - listForDisplay: master-toggle OFF (empty), TTL-degrade (Google snippets stripped
 *   past TTL), per-platform toggle filtering
 * - disableReputation: permission check (ACCOMMODATION_UPDATE_ANY required)
 */

import {
    ExternalPlatformEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AccommodationExternalListing, AccommodationExternalReputation } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationExternalReputationService } from '../../src/services/accommodation-external-reputation/accommodation-external-reputation.service.js';
import type { Actor, ServiceConfig } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

const mockGoogleFetch = vi.fn();
const mockBookingFetch = vi.fn();
const mockAirbnbFetch = vi.fn();
const mockOtherFetch = vi.fn();

vi.mock('../../src/services/accommodation-external-reputation/adapters/index.js', () => ({
    getReputationAdapter: vi.fn((platform: string) => {
        switch (platform) {
            case 'GOOGLE':
                return { fetch: mockGoogleFetch };
            case 'BOOKING':
                return { fetch: mockBookingFetch };
            case 'AIRBNB':
                return { fetch: mockAirbnbFetch };
            default:
                return { fetch: mockOtherFetch };
        }
    })
}));

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------

const ACC_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const LIST_GOOGLE_ID = '22222222-2222-4222-8222-222222222222';
const LIST_BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const REP_GOOGLE_ID = '44444444-4444-4444-8444-444444444444';
const REP_BOOKING_ID = '55555555-5555-4555-8555-555555555555';

function makeAccommodation(overrides: Record<string, unknown> = {}) {
    return {
        id: ACC_ID,
        ownerId: OWNER_ID,
        name: 'Test Accommodation',
        deletedAt: null,
        showExternalReputation: true,
        ...overrides
    };
}

function makeListing(
    id: string,
    platform: ExternalPlatformEnum,
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id,
        accommodationId: ACC_ID,
        platform,
        url: `https://example.com/${platform.toLowerCase()}`,
        externalId: `ext-${platform.toLowerCase()}`,
        showLink: true,
        showReviews: true,
        verified: true,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdById: OWNER_ID,
        updatedById: OWNER_ID,
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        ...overrides
    };
}

function makeReputation(
    id: string,
    platform: ExternalPlatformEnum,
    listingId: string,
    overrides: Partial<AccommodationExternalReputation> = {}
): AccommodationExternalReputation {
    return {
        id,
        accommodationId: ACC_ID,
        platform,
        listingId,
        rating: 4.5,
        reviewsCount: 100,
        deepLink: `https://example.com/${platform.toLowerCase()}/reviews`,
        snippets:
            platform === ExternalPlatformEnum.GOOGLE
                ? [
                      {
                          author: 'Alice',
                          text: 'Great stay!',
                          rating: 5,
                          timeIso: null,
                          authorUrl: null,
                          profilePhoto: null,
                          relativeTime: null
                      }
                  ]
                : null,
        snippetsFetchedAt: new Date(),
        aggregateFetchedAt: new Date(),
        fetchStatus: 'ok',
        fetchMessage: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date(),
        ...overrides
    };
}

function makeOwnerActor(): Actor {
    return {
        id: OWNER_ID,
        role: 'HOST' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    };
}

function makeAdminActor(): Actor {
    return {
        id: ADMIN_ID,
        role: 'ADMIN' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
    };
}

function makeNonOwnerActor(): Actor {
    return {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        role: 'HOST' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    };
}

// ---------------------------------------------------------------------------
// Model mock factories
// ---------------------------------------------------------------------------

function makeAccommodationModel(overrides: Record<string, unknown> = {}) {
    return {
        findById: vi.fn().mockResolvedValue(makeAccommodation()),
        update: vi.fn().mockResolvedValue(makeAccommodation()),
        ...overrides
    };
}

function makeListingModel(overrides: Record<string, unknown> = {}) {
    const googleListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
    const bookingListing = makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING);
    return {
        findByAccommodation: vi.fn().mockResolvedValue([googleListing, bookingListing]),
        findById: vi.fn().mockResolvedValue(googleListing),
        update: vi.fn().mockResolvedValue(googleListing),
        ...overrides
    };
}

function makeReputationModel(overrides: Record<string, unknown> = {}) {
    const googleRep = makeReputation(REP_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, LIST_GOOGLE_ID);
    const bookingRep = makeReputation(
        REP_BOOKING_ID,
        ExternalPlatformEnum.BOOKING,
        LIST_BOOKING_ID
    );
    return {
        findAll: vi.fn().mockResolvedValue({ items: [googleRep, bookingRep], total: 2 }),
        findForDisplay: vi.fn().mockResolvedValue([googleRep, bookingRep]),
        upsertReputation: vi.fn().mockResolvedValue(googleRep),
        ...overrides
    };
}

const ctx: ServiceConfig = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationExternalReputationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGoogleFetch.mockResolvedValue({
            rating: 4.7,
            reviewsCount: 200,
            deepLink: 'https://maps.google.com/?cid=12345#reviews',
            snippets: [
                {
                    author: 'Bob',
                    text: 'Excellent!',
                    rating: 5,
                    timeIso: null,
                    authorUrl: null,
                    profilePhoto: null,
                    relativeTime: null
                }
            ],
            attributionUrl: null
        });
        mockBookingFetch.mockResolvedValue({
            rating: 9.2,
            reviewsCount: 500,
            deepLink: 'https://booking.com/reviews',
            snippets: null,
            attributionUrl: null
        });
        // Reset env
        process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = undefined;
        process.env.HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS = undefined;
    });

    // -------------------------------------------------------------------------
    // refresh — full success
    // -------------------------------------------------------------------------

    describe('refresh', () => {
        it('should fetch both platforms and return all succeeded — happy path', async () => {
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                // Simulate no previous fetch (rate limit not triggered)
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.error).toBeUndefined();
            expect(result.data?.succeeded).toContain(ExternalPlatformEnum.GOOGLE);
            expect(result.data?.succeeded).toContain(ExternalPlatformEnum.BOOKING);
            expect(result.data?.failed).toHaveLength(0);
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(2);
        });

        it('should return FORBIDDEN when actor does not own the accommodation', async () => {
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeNonOwnerActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should continue other platforms when one adapter errors (AC-2.3)', async () => {
            // Google succeeds; Booking throws
            mockBookingFetch.mockRejectedValue(new Error('Booking API timeout'));

            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.error).toBeUndefined();
            expect(result.data?.succeeded).toContain(ExternalPlatformEnum.GOOGLE);
            expect(result.data?.failed).toHaveLength(1);
            expect(result.data?.failed[0]?.platform).toBe(ExternalPlatformEnum.BOOKING);
            expect(result.data?.failed[0]?.error).toContain('Booking API timeout');
            // Both upserts ran: 1 ok (Google) + 1 error row (Booking)
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(2);
        });

        it('should return QUOTA_EXCEEDED (rate-limited) when the window has not passed', async () => {
            // Set a tight rate limit and simulate a recent fetch
            process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = '1/3600';

            const recentFetch = new Date(Date.now() - 60_000); // 1 minute ago — within 1-hour window
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({
                    items: [
                        makeReputation(REP_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, LIST_GOOGLE_ID, {
                            aggregateFetchedAt: recentFetch
                        })
                    ],
                    total: 1
                })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(result.error?.details).toMatchObject({ reason: 'RATE_LIMIT_ERROR' });
            // No fetch calls should have been made
            expect(reputationModel.upsertReputation).not.toHaveBeenCalled();
        });

        it('should allow refresh when the rate-limit window has passed', async () => {
            process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = '1/600';

            const oldFetch = new Date(Date.now() - 700_000); // ~11 min ago — outside 10-min window
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({
                    items: [
                        makeReputation(REP_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, LIST_GOOGLE_ID, {
                            aggregateFetchedAt: oldFetch
                        })
                    ],
                    total: 1
                })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.error).toBeUndefined();
            expect(result.data?.succeeded.length).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // listForDisplay
    // -------------------------------------------------------------------------

    describe('listForDisplay', () => {
        it('should return empty block when master toggle is OFF', async () => {
            const accommodationModel = makeAccommodationModel({
                findById: vi
                    .fn()
                    .mockResolvedValue(makeAccommodation({ showExternalReputation: false }))
            });
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(reputationModel.findForDisplay).not.toHaveBeenCalled();
        });

        it('should return the reputation block for enabled platforms', async () => {
            const accommodationModel = makeAccommodationModel();
            const googleListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, {
                verified: true,
                showLink: true,
                showReviews: true
            });
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([googleListing])
            });
            const googleRep = makeReputation(
                REP_GOOGLE_ID,
                ExternalPlatformEnum.GOOGLE,
                LIST_GOOGLE_ID,
                {
                    snippets: [
                        {
                            author: 'Eve',
                            text: 'Nice!',
                            rating: 5,
                            timeIso: null,
                            authorUrl: null,
                            profilePhoto: null,
                            relativeTime: null
                        }
                    ],
                    snippetsFetchedAt: new Date()
                }
            );
            const reputationModel = makeReputationModel({
                findForDisplay: vi.fn().mockResolvedValue([googleRep])
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            const item = result.data?.items[0];
            expect(item?.platform).toBe(ExternalPlatformEnum.GOOGLE);
            expect(item?.snippets).not.toBeNull();
        });

        it('should strip Google snippets when snippetsFetchedAt is older than the TTL', async () => {
            process.env.HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS = '7';

            // Simulate snippetsFetchedAt = 10 days ago (older than 7-day TTL)
            const oldSnippetFetch = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

            const accommodationModel = makeAccommodationModel();
            const googleListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, {
                verified: true,
                showLink: true,
                showReviews: true
            });
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([googleListing])
            });
            const googleRep = makeReputation(
                REP_GOOGLE_ID,
                ExternalPlatformEnum.GOOGLE,
                LIST_GOOGLE_ID,
                {
                    snippets: [
                        {
                            author: 'Carol',
                            text: 'Amazing!',
                            rating: 5,
                            timeIso: null,
                            authorUrl: null,
                            profilePhoto: null,
                            relativeTime: null
                        }
                    ],
                    snippetsFetchedAt: oldSnippetFetch
                }
            );
            const reputationModel = makeReputationModel({
                findForDisplay: vi.fn().mockResolvedValue([googleRep])
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            // Snippets must be stripped (TTL-degraded per AC-7.2)
            expect(result.data?.items[0]?.snippets).toBeNull();
            // Aggregate is still shown
            expect(result.data?.items[0]?.rating).toBeDefined();
        });

        it('should exclude a platform when showLink and showReviews are both false', async () => {
            const accommodationModel = makeAccommodationModel();
            // Listing with both flags off
            const hiddenListing = makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING, {
                verified: true,
                showLink: false,
                showReviews: false
            });
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([hiddenListing])
            });
            const bookingRep = makeReputation(
                REP_BOOKING_ID,
                ExternalPlatformEnum.BOOKING,
                LIST_BOOKING_ID
            );
            // findForDisplay would normally already exclude this, but we also verify buildExternalReputationBlock
            const reputationModel = makeReputationModel({
                findForDisplay: vi.fn().mockResolvedValue([bookingRep])
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.error).toBeUndefined();
            // The listing has showLink=false + showReviews=false → stripped by buildExternalReputationBlock
            expect(result.data?.items).toHaveLength(0);
        });

        it('should return empty block when accommodationModel.findById throws (graceful degrade)', async () => {
            const accommodationModel = makeAccommodationModel({
                findById: vi.fn().mockRejectedValue(new Error('DB timeout'))
            });
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            // Public read must degrade gracefully — no error, empty items
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
        });

        it('should exclude unverified listings', async () => {
            const accommodationModel = makeAccommodationModel();
            const unverifiedListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, {
                verified: false,
                showLink: true,
                showReviews: true
            });
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([unverifiedListing])
            });
            const googleRep = makeReputation(
                REP_GOOGLE_ID,
                ExternalPlatformEnum.GOOGLE,
                LIST_GOOGLE_ID
            );
            const reputationModel = makeReputationModel({
                findForDisplay: vi.fn().mockResolvedValue([googleRep])
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.data?.items).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // disableReputation
    // -------------------------------------------------------------------------

    describe('disableReputation', () => {
        it('should set showLink=false + showReviews=false for all listings — admin happy path', async () => {
            const accommodationModel = makeAccommodationModel();
            const googleListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const bookingListing = makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING);
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([googleListing, bookingListing])
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation(ACC_ID, makeAdminActor());

            expect(result.error).toBeUndefined();
            expect(result.data?.disabled).toBe(2);
            expect(listingModel.update).toHaveBeenCalledTimes(2);
        });

        it('should return FORBIDDEN when actor lacks ACCOMMODATION_UPDATE_ANY', async () => {
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation(ACC_ID, makeOwnerActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(listingModel.update).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when the accommodation does not exist', async () => {
            const accommodationModel = makeAccommodationModel({
                findById: vi.fn().mockResolvedValue(null)
            });
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation('nonexistent-id', makeAdminActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return INTERNAL_ERROR when listingModel.update throws an unexpected error', async () => {
            const accommodationModel = makeAccommodationModel();
            const activeListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([activeListing]),
                update: vi.fn().mockRejectedValue(new Error('DB write failure'))
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation(ACC_ID, makeAdminActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('DB write failure');
        });

        it('should skip soft-deleted listings and return correct count', async () => {
            const accommodationModel = makeAccommodationModel();
            const activeListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const deletedListing = makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING, {
                deletedAt: new Date()
            });
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([activeListing, deletedListing])
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation(ACC_ID, makeAdminActor());

            expect(result.data?.disabled).toBe(1); // only the active one
            expect(listingModel.update).toHaveBeenCalledTimes(1);
        });
    });
});
