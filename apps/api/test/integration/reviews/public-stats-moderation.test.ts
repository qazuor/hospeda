import { randomUUID } from 'node:crypto';
import { accommodationReviews, getDb, sql, users } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

const MATRIX_NOW = new Date('2026-10-10T12:00:00.000Z');
const app = initApp({ clock: { now: () => MATRIX_NOW } });

async function readPublic(path: string): Promise<Record<string, unknown>> {
    clearCache();
    const response = await app.request(path, {
        headers: { 'user-agent': 'hospeda-integration-test' }
    });
    expect(response.status).toBe(200);
    return (await response.json()) as Record<string, unknown>;
}

function payload(body: Record<string, unknown>): Record<string, unknown> {
    const data = body.data;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : body;
}

async function insertReview(args: {
    listingId: string;
    reviewerId: string;
    rating: number;
    createdAt: Date;
    moderationState?: 'PENDING' | 'APPROVED' | 'REJECTED';
    lifecycleState?: 'ACTIVE' | 'ARCHIVED';
    deletedAt?: Date;
}) {
    const [row] = await getDb()
        .insert(accommodationReviews)
        .values({
            accommodationId: args.listingId,
            userId: args.reviewerId,
            title: `Review ${randomUUID()}`,
            content: 'Public stats moderation fixture',
            rating: {
                cleanliness: args.rating,
                hospitality: args.rating,
                services: args.rating,
                accuracy: args.rating,
                communication: args.rating,
                location: args.rating
            },
            averageRating: args.rating,
            lifecycleState: args.lifecycleState ?? 'ACTIVE',
            moderationState: args.moderationState ?? 'APPROVED',
            createdAt: args.createdAt,
            deletedAt: args.deletedAt
        })
        .returning();
    if (!row) throw new Error('Accommodation review fixture insert failed');
    return row;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

beforeEach(async () => {
    await testDb.clean();
    await ensureAccommodationCatalog();
});

afterAll(async () => testDb.teardown());

describe('TEST:1705:1 AC:1705:1 the public stats count only APPROVED reviews', () => {
    it('uses only active, non-deleted, approved reviews for the average and reviewer avatars', async () => {
        const owner = await createOwner({ email: `owner-${randomUUID()}@example.test` });
        const destinationId = await createVerticalDestination();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED,
            complete: false
        });
        const reviewers = await Promise.all(
            Array.from({ length: 6 }, () =>
                createOwner({ email: `reviewer-${randomUUID()}@example.test` })
            )
        );
        const [reviewerC, reviewerD, reviewerA, reviewerB, reviewerE, reviewerF] = reviewers;
        const images = reviewers.map(({ id }) => `https://cdn.example.test/${id}.png`);
        await Promise.all(
            reviewers.map((reviewer, index) =>
                getDb()
                    .update(users)
                    .set({ image: images[index] })
                    .where(sql`${users.id} = ${reviewer.id}`)
            )
        );
        const ago = (hours: number) => new Date(MATRIX_NOW.getTime() - hours * 60 * 60 * 1000);
        await insertReview({
            listingId,
            reviewerId: reviewerC!.id,
            rating: 1,
            moderationState: 'PENDING',
            createdAt: ago(1)
        });
        await insertReview({
            listingId,
            reviewerId: reviewerD!.id,
            rating: 1,
            moderationState: 'REJECTED',
            createdAt: ago(2)
        });
        await insertReview({ listingId, reviewerId: reviewerA!.id, rating: 5, createdAt: ago(3) });
        await insertReview({ listingId, reviewerId: reviewerB!.id, rating: 3, createdAt: ago(4) });
        await insertReview({
            listingId,
            reviewerId: reviewerE!.id,
            rating: 0,
            lifecycleState: 'ARCHIVED',
            createdAt: ago(5)
        });
        await insertReview({
            listingId,
            reviewerId: reviewerF!.id,
            rating: 0,
            deletedAt: ago(6),
            createdAt: ago(6)
        });

        const stats = payload(await readPublic('/api/v1/public/stats'));

        expect(stats.averageRating).toBe(4);
        expect(stats.recentReviewerAvatars).toEqual([images[2], images[3]]);
        expect(stats.reviews).toBe(2);
    });
});
