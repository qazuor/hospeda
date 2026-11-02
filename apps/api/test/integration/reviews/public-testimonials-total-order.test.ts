import { randomUUID } from 'node:crypto';
import { accommodationReviews, getDb } from '@repo/db';
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
    moderationState: 'PENDING' | 'APPROVED';
}) {
    const [row] = await getDb()
        .insert(accommodationReviews)
        .values({
            accommodationId: args.listingId,
            userId: args.reviewerId,
            title: `Public testimonial ${randomUUID()}`,
            content: 'Public testimonial ordering fixture',
            rating: {
                cleanliness: args.rating,
                hospitality: args.rating,
                services: args.rating,
                accuracy: args.rating,
                communication: args.rating,
                location: args.rating
            },
            averageRating: args.rating,
            lifecycleState: 'ACTIVE',
            moderationState: args.moderationState,
            createdAt: args.createdAt
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

describe('TEST:1705:2 AC:1705:2 AC:1705:3 the public testimonials report the real total', () => {
    it('returns the exact approved total and newest approved testimonials in deterministic order', async () => {
        const owner = await createOwner({ email: `owner-${randomUUID()}@example.test` });
        const destinationId = await createVerticalDestination();
        const publishedListingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED,
            complete: false
        });
        const purgedListingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PURGED,
            complete: false
        });
        const reviewers = await Promise.all(
            Array.from({ length: 4 }, () =>
                createOwner({ email: `reviewer-${randomUUID()}@example.test` })
            )
        );
        const ago = (hours: number) => new Date(MATRIX_NOW.getTime() - hours * 60 * 60 * 1000);
        await insertReview({
            listingId: publishedListingId,
            reviewerId: reviewers[0]!.id,
            rating: 1,
            moderationState: 'PENDING',
            createdAt: ago(1)
        });
        const [t1, t2, t3] = await Promise.all([
            insertReview({
                listingId: publishedListingId,
                reviewerId: reviewers[1]!.id,
                rating: 5,
                moderationState: 'APPROVED',
                createdAt: ago(2)
            }),
            insertReview({
                listingId: publishedListingId,
                reviewerId: reviewers[2]!.id,
                rating: 4,
                moderationState: 'APPROVED',
                createdAt: ago(3)
            }),
            insertReview({
                listingId: publishedListingId,
                reviewerId: reviewers[3]!.id,
                rating: 3,
                moderationState: 'APPROVED',
                createdAt: ago(4)
            })
        ]);
        await insertReview({
            listingId: purgedListingId,
            reviewerId: owner.id,
            rating: 1,
            moderationState: 'APPROVED',
            createdAt: ago(0.5)
        });

        const twoItemPage = payload(await readPublic('/api/v1/public/testimonials?pageSize=2')) as {
            items: Array<{ id: string }>;
            pagination: { total: number };
        };
        expect(twoItemPage.pagination.total).toBe(3);
        expect(twoItemPage.items.map(({ id }) => id)).toEqual([t1!.id]);

        const fullPage = payload(await readPublic('/api/v1/public/testimonials?pageSize=6')) as {
            items: Array<{ id: string }>;
            pagination: { total: number };
        };
        expect(fullPage.pagination.total).toBe(3);
        expect(fullPage.items.map(({ id }) => id)).toEqual([t1!.id, t2!.id, t3!.id]);
    });
});
