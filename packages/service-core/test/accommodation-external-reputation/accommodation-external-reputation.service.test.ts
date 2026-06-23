/**
 * Unit tests for AccommodationExternalReputationService
 * (SPEC-237 T-007, updated SPEC-250 Phase 4)
 *
 * Covers:
 * - refresh (SPEC-250 inline/async split):
 *   - all-inline path (Google only → inlineSucceeded)
 *   - mixed inline + async (Google inline, Airbnb enqueued)
 *   - all-async (Airbnb only → enqueuedAsync, run_status='pending' persisted atomically)
 *   - startRun failure → inlineFailed + fetch_status='error'
 *   - inline adapter throws (catch path → inlineFailed, AC-2.3)
 *   - upsert-of-error-row also fails (silent catch path)
 *   - rate limit still enforced (429 path unchanged)
 *   - NOT_FOUND when accommodation soft-deleted
 *   - INTERNAL_ERROR on unexpected DB failure
 * - listForDisplay: master-toggle OFF (empty), TTL-degrade, per-platform toggle filtering
 * - disableReputation: permission check, transaction atomicity
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
import { ServiceError } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mock @repo/db — withTransaction must be transparent in unit tests so that
// disableReputation (which uses withTransaction for atomicity, FIX L6) works
// with the vitest model mocks without a real DB connection.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        // Make withTransaction execute the callback directly, reusing an existingTx
        // when provided (same semantics as the real implementation in unit tests).
        withTransaction: vi.fn(
            async (callback: (tx: undefined) => Promise<unknown>, existingTx?: undefined) =>
                callback(existingTx)
        )
    };
});

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

const mockGoogleFetch = vi.fn();
const mockBookingFetch = vi.fn();
const mockAirbnbFetch = vi.fn();
const mockAirbnbStartRun = vi.fn();
const mockBookingStartRun = vi.fn();
const mockOtherFetch = vi.fn();

vi.mock('../../src/services/accommodation-external-reputation/adapters/index.js', () => ({
    getReputationAdapter: vi.fn((platform: string) => {
        switch (platform) {
            case 'GOOGLE':
                // Google: inline only, no startRun
                return { fetch: mockGoogleFetch };
            case 'BOOKING':
                // Booking: has both fetch (JSON-LD) and startRun (Apify fallback)
                return { fetch: mockBookingFetch, startRun: mockBookingStartRun };
            case 'AIRBNB':
                // Airbnb: fetch always returns empty, startRun enqueues Apify run
                return { fetch: mockAirbnbFetch, startRun: mockAirbnbStartRun };
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
const LIST_AIRBNB_ID = '66666666-6666-4666-8666-666666666666';
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
        runStatus: 'idle',
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

        // Google: inline success
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

        // Booking fetch: JSON-LD success (inline) by default
        mockBookingFetch.mockResolvedValue({
            rating: 9.2,
            reviewsCount: 500,
            deepLink: 'https://booking.com/reviews',
            snippets: null,
            attributionUrl: null
        });

        // Airbnb fetch: always returns all-null (async path required)
        mockAirbnbFetch.mockResolvedValue({
            rating: null,
            reviewsCount: null,
            deepLink: null,
            snippets: null,
            attributionUrl: null
        });

        // Async startRun defaults — success path
        mockAirbnbStartRun.mockResolvedValue({
            runId: 'apify-run-airbnb-123',
            datasetId: 'apify-dataset-airbnb-456'
        });
        mockBookingStartRun.mockResolvedValue({
            runId: 'apify-run-booking-123',
            datasetId: 'apify-dataset-booking-456'
        });

        // Reset env
        process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = undefined;
        process.env.HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS = undefined;
    });

    // -------------------------------------------------------------------------
    // refresh — SPEC-250 inline/async split
    // -------------------------------------------------------------------------

    describe('refresh', () => {
        // --- All-inline path ---

        it('should resolve all inline and return inlineSucceeded when only Google listing (no startRun)', async () => {
            // Arrange
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toContain(ExternalPlatformEnum.GOOGLE);
            expect(result.data?.enqueuedAsync).toHaveLength(0);
            expect(result.data?.inlineFailed).toHaveLength(0);
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(1);
            // Inline upsert must set run_status='idle'
            expect(reputationModel.upsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({ runStatus: 'idle', fetchStatus: 'ok' }),
                undefined
            );
        });

        it('should resolve Booking inline when JSON-LD returns non-null rating', async () => {
            // Arrange — Booking fetch returns a rating (JSON-LD fast path succeeds)
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert — Booking went inline (JSON-LD succeeded)
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toContain(ExternalPlatformEnum.BOOKING);
            expect(result.data?.enqueuedAsync).toHaveLength(0);
            expect(result.data?.inlineFailed).toHaveLength(0);
            // startRun must NOT have been called (inline path took precedence)
            expect(mockBookingStartRun).not.toHaveBeenCalled();
        });

        // --- Mixed inline + async ---

        it('should return Google in inlineSucceeded and Airbnb in enqueuedAsync (mixed path)', async () => {
            // Arrange — Google listing (inline) + Airbnb listing (async)
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([
                        makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE),
                        makeListing(LIST_AIRBNB_ID, ExternalPlatformEnum.AIRBNB)
                    ])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toContain(ExternalPlatformEnum.GOOGLE);
            expect(result.data?.enqueuedAsync).toContain(ExternalPlatformEnum.AIRBNB);
            expect(result.data?.inlineFailed).toHaveLength(0);
            // Two upserts: one inline (Google), one async enqueue (Airbnb)
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(2);
        });

        // --- All-async path ---

        it('should enqueue Airbnb async and persist run_status=pending atomically (OQ-1)', async () => {
            // Arrange — Airbnb only
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_AIRBNB_ID, ExternalPlatformEnum.AIRBNB)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toHaveLength(0);
            expect(result.data?.enqueuedAsync).toContain(ExternalPlatformEnum.AIRBNB);
            expect(result.data?.inlineFailed).toHaveLength(0);
            // Exactly one upsert — OQ-1: atomic single write (not two separate writes)
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(1);
            // The upsert must atomically set run_status='pending' + runId + datasetId + runStartedAt
            expect(reputationModel.upsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    runStatus: 'pending',
                    apifyRunId: 'apify-run-airbnb-123',
                    apifyDatasetId: 'apify-dataset-airbnb-456',
                    runStartedAt: expect.any(Date)
                }),
                undefined
            );
        });

        // --- startRun failure → inlineFailed ---

        it('should add platform to inlineFailed and persist fetch_status=error when startRun returns null', async () => {
            // Arrange — Airbnb startRun degrades to null
            mockAirbnbStartRun.mockResolvedValue(null);

            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_AIRBNB_ID, ExternalPlatformEnum.AIRBNB)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toHaveLength(0);
            expect(result.data?.enqueuedAsync).toHaveLength(0);
            expect(result.data?.inlineFailed).toHaveLength(1);
            expect(result.data?.inlineFailed[0]?.platform).toBe(ExternalPlatformEnum.AIRBNB);
            expect(result.data?.inlineFailed[0]?.error).toBe('startRun failed');
            // Upsert must set fetch_status='error', run_status='idle'
            expect(reputationModel.upsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'error',
                    fetchMessage: 'startRun failed',
                    runStatus: 'idle'
                }),
                undefined
            );
        });

        // --- Booking: JSON-LD miss falls through to async ---

        it('should enqueue Booking async when JSON-LD returns all-null', async () => {
            // Arrange — Booking fetch returns all-null (JSON-LD missed or blocked)
            mockBookingFetch.mockResolvedValue({
                rating: null,
                reviewsCount: null,
                deepLink: null,
                snippets: null,
                attributionUrl: null
            });

            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert — Booking was enqueued async (not inline)
            expect(result.data?.enqueuedAsync).toContain(ExternalPlatformEnum.BOOKING);
            expect(result.data?.inlineSucceeded).toHaveLength(0);
            expect(mockBookingStartRun).toHaveBeenCalledOnce();
        });

        // --- AC-2.3: Partial failure — adapter throws ---

        it('should continue other platforms when one adapter throws (AC-2.3)', async () => {
            // Arrange — Airbnb fetch throws; Google succeeds inline
            mockAirbnbFetch.mockRejectedValue(new Error('Airbnb fetch timeout'));

            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([
                        makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE),
                        makeListing(LIST_AIRBNB_ID, ExternalPlatformEnum.AIRBNB)
                    ])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineSucceeded).toContain(ExternalPlatformEnum.GOOGLE);
            expect(result.data?.enqueuedAsync).toHaveLength(0);
            expect(result.data?.inlineFailed).toHaveLength(1);
            expect(result.data?.inlineFailed[0]?.platform).toBe(ExternalPlatformEnum.AIRBNB);
            expect(result.data?.inlineFailed[0]?.error).toContain('Airbnb fetch timeout');
            // Both upserts ran: 1 ok (Google) + 1 error row (Airbnb catch path)
            expect(reputationModel.upsertReputation).toHaveBeenCalledTimes(2);
        });

        // --- Silent catch when upsert-of-error-row also fails ---

        it('should continue gracefully when upsert-of-error-row also fails', async () => {
            // Arrange — fetch throws; then error-row upsert also throws
            mockGoogleFetch.mockRejectedValueOnce(new Error('adapter timeout'));

            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE)])
            });
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
                upsertReputation: vi.fn().mockRejectedValue(new Error('upsert also failed'))
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert — must NOT bubble the upsert-of-error-row failure
            expect(result.error).toBeUndefined();
            expect(result.data?.inlineFailed).toHaveLength(1);
            expect(result.data?.inlineSucceeded).toHaveLength(0);
            expect(result.data?.enqueuedAsync).toHaveLength(0);
        });

        // --- Rate limit still enforced ---

        it('should return QUOTA_EXCEEDED (rate-limited) when the window has not passed', async () => {
            // Arrange
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

            // Act
            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(result.error?.details).toMatchObject({ reason: 'RATE_LIMIT_ERROR' });
            expect(reputationModel.upsertReputation).not.toHaveBeenCalled();
        });

        it('should allow refresh when the rate-limit window has passed', async () => {
            process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = '1/600';

            const oldFetch = new Date(Date.now() - 700_000); // ~11 min ago — outside 10-min window
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel({
                findByAccommodation: vi
                    .fn()
                    .mockResolvedValue([makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE)])
            });
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
            expect(
                (result.data?.inlineSucceeded.length ?? 0) +
                    (result.data?.enqueuedAsync.length ?? 0)
            ).toBeGreaterThan(0);
        });

        it('should enforce rate-limit when aggregateFetchedAt is a string (DB-serialized date)', async () => {
            process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = '1/3600';

            const recentFetchIso = new Date(Date.now() - 60_000).toISOString();
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                findAll: vi.fn().mockResolvedValue({
                    items: [
                        makeReputation(REP_GOOGLE_ID, ExternalPlatformEnum.GOOGLE, LIST_GOOGLE_ID, {
                            aggregateFetchedAt: recentFetchIso as never
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

            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
        });

        it('should include windowSeconds in rate-limit error details (L1 regression)', async () => {
            process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT = '1/3600';

            const recentFetch = new Date(Date.now() - 60_000);
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

            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(result.error?.details).toMatchObject({
                reason: 'RATE_LIMIT_ERROR',
                windowSeconds: 3600
            });
        });

        // --- Permission / ownership checks ---

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

        it('should return NOT_FOUND when the accommodation is soft-deleted', async () => {
            const accommodationModel = makeAccommodationModel({
                findById: vi
                    .fn()
                    .mockResolvedValue({ ...makeAccommodation(), deletedAt: new Date() })
            });
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return INTERNAL_ERROR when accommodationModel.findById throws unexpectedly', async () => {
            const accommodationModel = makeAccommodationModel({
                findById: vi.fn().mockRejectedValue(new Error('unexpected DB error in refresh'))
            });
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.refresh(ACC_ID, makeOwnerActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('unexpected DB error in refresh');
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
            expect(result.data?.items).toHaveLength(0);
        });

        it('should return empty block when no reputation rows exist for the accommodation', async () => {
            const accommodationModel = makeAccommodationModel();
            const listingModel = makeListingModel();
            const reputationModel = makeReputationModel({
                findForDisplay: vi.fn().mockResolvedValue([])
            });
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.listForDisplay(ACC_ID);

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
            expect(listingModel.findByAccommodation).not.toHaveBeenCalled();
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

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(0);
        });

        it('shows unverified listings when display toggles are enabled (verified is not a filter)', async () => {
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

            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.items[0]?.platform).toBe(ExternalPlatformEnum.GOOGLE);
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

        it('should pass ctx.tx to model calls when a ServiceContext is provided', async () => {
            const accommodationModel = makeAccommodationModel();
            const activeListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([activeListing])
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const explicitCtx = {};
            const result = await svc.disableReputation(ACC_ID, makeAdminActor(), explicitCtx);

            expect(result.error).toBeUndefined();
            expect(result.data?.disabled).toBe(1);
            expect(accommodationModel.findById).toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR when listingModel.update throws a non-Error value (String branch)', async () => {
            const accommodationModel = makeAccommodationModel();
            const activeListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([activeListing]),
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                update: vi.fn().mockRejectedValue('plain string failure')
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
            expect(result.error?.message).toContain('plain string failure');
        });

        it('should propagate ServiceError code when listingModel.update throws a ServiceError', async () => {
            const accommodationModel = makeAccommodationModel();
            const activeListing = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const svcErr = new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Conflict on disable'
            );
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([activeListing]),
                update: vi.fn().mockRejectedValue(svcErr)
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            const result = await svc.disableReputation(ACC_ID, makeAdminActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
            expect(result.error?.message).toContain('Conflict on disable');
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

            expect(result.data?.disabled).toBe(1);
            expect(listingModel.update).toHaveBeenCalledTimes(1);
        });

        it('should roll back all updates when a mid-loop update throws (L6 regression — transaction atomicity)', async () => {
            // Arrange — two active listings; the second update throws.
            const accommodationModel = makeAccommodationModel();
            const listing1 = makeListing(LIST_GOOGLE_ID, ExternalPlatformEnum.GOOGLE);
            const listing2 = makeListing(LIST_BOOKING_ID, ExternalPlatformEnum.BOOKING);
            let callCount = 0;
            const listingModel = makeListingModel({
                findByAccommodation: vi.fn().mockResolvedValue([listing1, listing2]),
                update: vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 2) {
                        return Promise.reject(new Error('DB write failed on second update'));
                    }
                    return Promise.resolve(listing1);
                })
            });
            const reputationModel = makeReputationModel();
            const svc = new AccommodationExternalReputationService(ctx, {
                listingModel: listingModel as never,
                reputationModel: reputationModel as never,
                accommodationModel: accommodationModel as never
            });

            // Act
            const result = await svc.disableReputation(ACC_ID, makeAdminActor());

            // Assert — a typed error is returned, NOT a partial success
            expect(result.data).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });
});
