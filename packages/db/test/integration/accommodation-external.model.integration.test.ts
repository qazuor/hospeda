/**
 * Integration tests for AccommodationExternalListingModel and
 * AccommodationExternalReputationModel (SPEC-237 T-004 / T-005).
 *
 * Each test wraps DB writes in `withTestTransaction` so they are always
 * rolled back — no TRUNCATE overhead, parallel-safe via MVCC isolation.
 *
 * Test coverage:
 *  - AccommodationExternalListingModel.findByAccommodation
 *  - AccommodationExternalReputationModel.upsertReputation (idempotency)
 *  - AccommodationExternalReputationModel.findForDisplay (toggle filtering)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { AccommodationExternalListingModel } from '../../src/models/accommodationExternal/accommodation-external-listing.model.ts';
import { AccommodationExternalReputationModel } from '../../src/models/accommodationExternal/accommodation-external-reputation.model.ts';
import { accommodationExternalListings } from '../../src/schemas/accommodation-external/accommodation_external_listings.dbschema.ts';
import { accommodationExternalReputation } from '../../src/schemas/accommodation-external/accommodation_external_reputation.dbschema.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal accommodation row that satisfies all NOT NULL constraints.
 * Every test that needs an accommodation should call this inside a transaction
 * after inserting the user and destination prerequisites.
 */
function accommodationFixture(
    ownerId: string,
    destinationId: string,
    overrides: Partial<typeof accommodations.$inferInsert> = {}
): typeof accommodations.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `ext-test-${uid}`,
        name: 'External Test Accommodation',
        summary: 'Short summary',
        type: 'HOTEL' as const,
        description: 'Test description',
        ownerId,
        destinationId,
        ...overrides
    };
}

/**
 * Minimal external listing row for a given accommodation + platform.
 */
function listingFixture(
    accommodationId: string,
    platform: 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER' = 'GOOGLE',
    overrides: Partial<typeof accommodationExternalListings.$inferInsert> = {}
): typeof accommodationExternalListings.$inferInsert {
    return {
        id: crypto.randomUUID(),
        accommodationId,
        platform,
        url: `https://example.com/${platform.toLowerCase()}`,
        showLink: false,
        showReviews: false,
        verified: false,
        ...overrides
    };
}

/**
 * Minimal reputation row for a given accommodation + platform + listing.
 */
function reputationFixture(
    accommodationId: string,
    platform: 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER',
    listingId: string,
    overrides: Partial<typeof accommodationExternalReputation.$inferInsert> = {}
): typeof accommodationExternalReputation.$inferInsert {
    return {
        id: crypto.randomUUID(),
        accommodationId,
        platform,
        listingId,
        fetchStatus: 'ok' as const,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

// ---------------------------------------------------------------------------
// AccommodationExternalListingModel tests
// ---------------------------------------------------------------------------

describe('AccommodationExternalListingModel.findByAccommodation', () => {
    const listingModel = new AccommodationExternalListingModel();

    it('returns listings for the specified accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const listingGoogle = listingFixture(accommodation.id, 'GOOGLE');
            const listingBooking = listingFixture(accommodation.id, 'BOOKING');
            await tx.insert(accommodationExternalListings).values(listingGoogle);
            await tx.insert(accommodationExternalListings).values(listingBooking);

            const results = await listingModel.findByAccommodation(accommodation.id, tx);

            const resultIds = results.map((r) => r.id);
            expect(resultIds).toContain(listingGoogle.id);
            expect(resultIds).toContain(listingBooking.id);
            expect(results).toHaveLength(2);
        });
    });

    it('does not return listings from a different accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation1 = accommodationFixture(user.id, dest.id);
            const accommodation2 = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation1);
            await tx.insert(accommodations).values(accommodation2);

            const listing1 = listingFixture(accommodation1.id, 'GOOGLE');
            const listing2 = listingFixture(accommodation2.id, 'AIRBNB');
            await tx.insert(accommodationExternalListings).values(listing1);
            await tx.insert(accommodationExternalListings).values(listing2);

            const results = await listingModel.findByAccommodation(accommodation1.id, tx);

            const resultIds = results.map((r) => r.id);
            expect(resultIds).toContain(listing1.id);
            expect(resultIds).not.toContain(listing2.id);
            expect(results).toHaveLength(1);
        });
    });

    it('excludes soft-deleted listings (deletedAt IS NOT NULL)', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const live = listingFixture(accommodation.id, 'GOOGLE');
            const deleted = listingFixture(accommodation.id, 'BOOKING', {
                deletedAt: new Date()
            });
            await tx.insert(accommodationExternalListings).values(live);
            await tx.insert(accommodationExternalListings).values(deleted);

            const results = await listingModel.findByAccommodation(accommodation.id, tx);

            const resultIds = results.map((r) => r.id);
            expect(resultIds).toContain(live.id);
            expect(resultIds).not.toContain(deleted.id);
            expect(results).toHaveLength(1);
        });
    });

    it('returns empty array when accommodation has no listings', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const results = await listingModel.findByAccommodation(accommodation.id, tx);
            expect(results).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// AccommodationExternalReputationModel.upsertReputation tests
// ---------------------------------------------------------------------------

describe('AccommodationExternalReputationModel.upsertReputation', () => {
    const reputationModel = new AccommodationExternalReputationModel();

    it('inserts a new reputation row on first call', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const listing = listingFixture(accommodation.id, 'GOOGLE');
            await tx.insert(accommodationExternalListings).values(listing);

            const data = reputationFixture(accommodation.id, 'GOOGLE', listing.id, {
                rating: 4.5,
                reviewsCount: 120,
                fetchStatus: 'ok' as const
            });

            const result = await reputationModel.upsertReputation(data, tx);

            expect(result.id).toBeDefined();
            expect(result.accommodationId).toBe(accommodation.id);
            expect(result.platform).toBe('GOOGLE');
            expect(Number(result.rating)).toBeCloseTo(4.5, 1);
            expect(result.reviewsCount).toBe(120);
            expect(result.fetchStatus).toBe('ok');
        });
    });

    it('updates the existing row on conflict (idempotent upsert)', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const listing = listingFixture(accommodation.id, 'GOOGLE');
            await tx.insert(accommodationExternalListings).values(listing);

            // First upsert — baseline row
            const initialData = reputationFixture(accommodation.id, 'GOOGLE', listing.id, {
                rating: 4.0,
                reviewsCount: 50,
                fetchStatus: 'ok' as const
            });
            const firstResult = await reputationModel.upsertReputation(initialData, tx);

            // Second upsert — same (accommodationId, platform), updated values
            const updatedData = reputationFixture(accommodation.id, 'GOOGLE', listing.id, {
                rating: 4.7,
                reviewsCount: 85,
                fetchStatus: 'ok' as const,
                fetchMessage: 'Refreshed on demand'
            });
            const secondResult = await reputationModel.upsertReputation(updatedData, tx);

            // Must be the same row (PK stays the same across an upsert)
            expect(secondResult.id).toBe(firstResult.id);

            // Values must reflect the second call's payload
            expect(Number(secondResult.rating)).toBeCloseTo(4.7, 1);
            expect(secondResult.reviewsCount).toBe(85);
            expect(secondResult.fetchMessage).toBe('Refreshed on demand');
        });
    });

    it('records a non-ok fetch status', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const listing = listingFixture(accommodation.id, 'AIRBNB');
            await tx.insert(accommodationExternalListings).values(listing);

            const data = reputationFixture(accommodation.id, 'AIRBNB', listing.id, {
                fetchStatus: 'blocked' as const,
                fetchMessage: '403 rate-limited by platform'
            });

            const result = await reputationModel.upsertReputation(data, tx);

            expect(result.fetchStatus).toBe('blocked');
            expect(result.fetchMessage).toBe('403 rate-limited by platform');
        });
    });
});

// ---------------------------------------------------------------------------
// AccommodationExternalReputationModel.findForDisplay tests
// ---------------------------------------------------------------------------

describe('AccommodationExternalReputationModel.findForDisplay', () => {
    const reputationModel = new AccommodationExternalReputationModel();

    it('returns only reputation rows whose listing has showReviews OR showLink = true', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            // Listing A — showReviews=true: should appear
            const listingA = listingFixture(accommodation.id, 'GOOGLE', { showReviews: true });
            // Listing B — showLink=true: should appear
            const listingB = listingFixture(accommodation.id, 'BOOKING', { showLink: true });
            // Listing C — both false: must NOT appear
            const listingC = listingFixture(accommodation.id, 'AIRBNB', {
                showReviews: false,
                showLink: false
            });

            await tx.insert(accommodationExternalListings).values(listingA);
            await tx.insert(accommodationExternalListings).values(listingB);
            await tx.insert(accommodationExternalListings).values(listingC);

            const repA = reputationFixture(accommodation.id, 'GOOGLE', listingA.id, {
                rating: 4.8,
                reviewsCount: 200
            });
            const repB = reputationFixture(accommodation.id, 'BOOKING', listingB.id, {
                rating: 4.5,
                reviewsCount: 150
            });
            const repC = reputationFixture(accommodation.id, 'AIRBNB', listingC.id, {
                rating: 3.9,
                reviewsCount: 50
            });

            await tx.insert(accommodationExternalReputation).values(repA);
            await tx.insert(accommodationExternalReputation).values(repB);
            await tx.insert(accommodationExternalReputation).values(repC);

            const results = await reputationModel.findForDisplay(accommodation.id, tx);
            const resultIds = results.map((r) => r.id);

            expect(resultIds).toContain(repA.id);
            expect(resultIds).toContain(repB.id);
            expect(resultIds).not.toContain(repC.id);
            expect(results).toHaveLength(2);
        });
    });

    it('returns empty array when no listings have showReviews or showLink', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const listing = listingFixture(accommodation.id, 'GOOGLE', {
                showReviews: false,
                showLink: false
            });
            await tx.insert(accommodationExternalListings).values(listing);

            const rep = reputationFixture(accommodation.id, 'GOOGLE', listing.id);
            await tx.insert(accommodationExternalReputation).values(rep);

            const results = await reputationModel.findForDisplay(accommodation.id, tx);
            expect(results).toEqual([]);
        });
    });

    it('returns empty array for accommodation with no reputation rows', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const results = await reputationModel.findForDisplay(accommodation.id, tx);
            expect(results).toEqual([]);
        });
    });

    it('does not return display rows for a different accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const dest = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(dest);

            const accommodation1 = accommodationFixture(user.id, dest.id);
            const accommodation2 = accommodationFixture(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation1);
            await tx.insert(accommodations).values(accommodation2);

            const listing1 = listingFixture(accommodation1.id, 'GOOGLE', { showReviews: true });
            const listing2 = listingFixture(accommodation2.id, 'GOOGLE', { showReviews: true });
            await tx.insert(accommodationExternalListings).values(listing1);
            await tx.insert(accommodationExternalListings).values(listing2);

            const rep1 = reputationFixture(accommodation1.id, 'GOOGLE', listing1.id);
            const rep2 = reputationFixture(accommodation2.id, 'GOOGLE', listing2.id);
            await tx.insert(accommodationExternalReputation).values(rep1);
            await tx.insert(accommodationExternalReputation).values(rep2);

            const results = await reputationModel.findForDisplay(accommodation1.id, tx);
            const resultIds = results.map((r) => r.id);

            expect(resultIds).toContain(rep1.id);
            expect(resultIds).not.toContain(rep2.id);
            expect(results).toHaveLength(1);
        });
    });
});
