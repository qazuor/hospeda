/**
 * HOS-25 T-025 — AccommodationReviewService.recalculateStats() real-DB test.
 *
 * Verifies the public wrapper added for the `example` seed's deterministic-id
 * review inserts (which bypass `service.create()` and therefore never run
 * `_afterCreate`'s stats recomputation): after inserting review rows directly
 * via the model — exactly like the seed factory does — calling
 * `recalculateStats()` must still leave the parent accommodation's aggregate
 * columns (`reviewsCount`, `averageRating`, `rating`) correct, and must only
 * count APPROVED, non-deleted reviews (mirroring the public list filter).
 */
import type { DrizzleClient } from '@repo/db';
import { accommodationReviews, accommodations, eq, users } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

interface RatingInput {
    readonly cleanliness: number;
    readonly hospitality: number;
    readonly services: number;
    readonly accuracy: number;
    readonly communication: number;
    readonly location: number;
}

/**
 * Inserts a fresh reviewer user plus an `accommodationReviews` row for the
 * given accommodation, directly via `tx.insert()` — no service call, no
 * `_afterCreate` hook. Mirrors exactly what
 * `packages/seed/src/example/accommodationReviews.seed.ts`'s
 * `deterministicId` model-direct path does at seed time.
 *
 * @param options.moderationState - Defaults to omitted (DB column default `APPROVED`), matching the seed.
 */
async function insertReviewerAndReview(
    tx: DrizzleClient,
    accommodationId: string,
    rating: RatingInput,
    options: { readonly moderationState?: 'PENDING' | 'APPROVED' | 'REJECTED' } = {}
): Promise<string> {
    const userId = crypto.randomUUID();
    const reviewId = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-reviewer-${uid}@example.com`,
        displayName: 'Seed Reviewer',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    const values = Object.values(rating);
    const averageRating =
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;

    await tx.insert(accommodationReviews).values({
        id: reviewId,
        accommodationId,
        userId,
        title: 'Model-direct review',
        content: 'Inserted directly, bypassing AccommodationReviewService.create()',
        rating,
        averageRating,
        ...(options.moderationState ? { moderationState: options.moderationState } : {}),
        lifecycleState: 'ACTIVE'
    } as typeof accommodationReviews.$inferInsert);

    return reviewId;
}

describe('HOS-25 T-025 — AccommodationReviewService.recalculateStats (real DB)', () => {
    let service: AccommodationReviewService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new AccommodationReviewService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'recomputes reviewsCount/averageRating/rating from model-direct-inserted reviews',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                const ctx: ServiceContext = { tx };

                await insertReviewerAndReview(tx, accommodationId, {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 4,
                    accuracy: 5,
                    communication: 5,
                    location: 4
                });
                await insertReviewerAndReview(tx, accommodationId, {
                    cleanliness: 3,
                    hospitality: 4,
                    services: 3,
                    accuracy: 4,
                    communication: 3,
                    location: 4
                });

                // Sanity: model-direct review inserts never touch the parent row —
                // this is exactly the gap `recalculateStats()` closes.
                const beforeRows = await tx
                    .select({ reviewsCount: accommodations.reviewsCount })
                    .from(accommodations)
                    .where(eq(accommodations.id, accommodationId));
                expect(beforeRows[0]?.reviewsCount).toBe(0);

                await service.recalculateStats(accommodationId, ctx);

                const afterRows = await tx
                    .select({
                        reviewsCount: accommodations.reviewsCount,
                        averageRating: accommodations.averageRating,
                        rating: accommodations.rating
                    })
                    .from(accommodations)
                    .where(eq(accommodations.id, accommodationId));

                const row = afterRows[0];
                expect(row).toBeDefined();
                expect(row?.reviewsCount).toBe(2);
                expect(row?.rating).toEqual({
                    cleanliness: 4,
                    hospitality: 4.5,
                    services: 3.5,
                    accuracy: 4.5,
                    communication: 4,
                    location: 4
                });
                // Overall average is the mean of the 6 per-dimension averages above.
                // The `averageRating` column is `numeric(3,2)`, so the DB itself
                // rounds the stored value to 2 decimals — assert against that
                // precision rather than the unrounded JS float.
                const expectedOverall = (4 + 4.5 + 3.5 + 4.5 + 4 + 4) / 6;
                expect(row?.averageRating).toBeCloseTo(expectedOverall, 2);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'excludes non-APPROVED and soft-deleted reviews from the recomputed aggregate',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                const ctx: ServiceContext = { tx };

                // One clean APPROVED (implicit default) review.
                await insertReviewerAndReview(tx, accommodationId, {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                });

                // A PENDING review must not count toward the public aggregate.
                await insertReviewerAndReview(
                    tx,
                    accommodationId,
                    {
                        cleanliness: 1,
                        hospitality: 1,
                        services: 1,
                        accuracy: 1,
                        communication: 1,
                        location: 1
                    },
                    { moderationState: 'PENDING' }
                );

                await service.recalculateStats(accommodationId, ctx);

                const afterRows = await tx
                    .select({
                        reviewsCount: accommodations.reviewsCount,
                        averageRating: accommodations.averageRating
                    })
                    .from(accommodations)
                    .where(eq(accommodations.id, accommodationId));

                expect(afterRows[0]?.reviewsCount).toBe(1);
                expect(afterRows[0]?.averageRating).toBe(5);
            });
        }
    );
});
