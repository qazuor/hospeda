import { randomUUID } from 'node:crypto';
import { accommodationReviews, getDb, sql, users } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    ensureAccommodationCatalog
} from './publication-routes.helpers';

const MATRIX_NOW = new Date('2026-10-10T12:00:00.000Z');
const DAY = 86_400_000;
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
    averageRating: number;
    text: string;
}) {
    const [row] = await getDb()
        .insert(accommodationReviews)
        .values({
            accommodationId: args.listingId,
            userId: args.reviewerId,
            title: args.text,
            content: args.text,
            rating: {
                cleanliness: args.averageRating,
                hospitality: args.averageRating,
                services: args.averageRating,
                accuracy: args.averageRating,
                communication: args.averageRating,
                location: args.averageRating
            },
            averageRating: args.averageRating,
            lifecycleState: 'ACTIVE',
            moderationState: 'APPROVED'
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

describe('TEST:1686:2 TEST:1686:3 TEST:1686:4 AC:1686:2 AC:1686:3 AC:1686:4 public review surfaces hide only PURGED listings', () => {
    it('removes only the purged accommodation review from testimonials and public aggregates while retaining its row', async () => {
        const owner = await createOwner();
        const reviewers = await Promise.all([createOwner(), createOwner(), createOwner()]);
        const imageUrls = reviewers.map(({ id }) => `https://cdn.example.test/${id}.png`);
        for (const [index, reviewer] of reviewers.entries()) {
            await getDb()
                .update(users)
                .set({ image: imageUrls[index] })
                .where(sql`${users.id} = ${reviewer.id}`);
        }

        const destinationIds = await Promise.all([
            createVerticalDestination(),
            createVerticalDestination(),
            createVerticalDestination()
        ]);
        const listingIds = await Promise.all([
            createListing({
                ownerId: owner.id,
                destinationId: destinationIds[0]!,
                status: PublicationStatusEnum.PUBLISHED,
                complete: false
            }),
            createListing({
                ownerId: owner.id,
                destinationId: destinationIds[1]!,
                status: PublicationStatusEnum.ARCHIVED,
                complete: false
            }),
            createListing({
                ownerId: owner.id,
                destinationId: destinationIds[2]!,
                status: PublicationStatusEnum.ARCHIVED,
                complete: false
            })
        ]);
        await getDb().execute(sql`
            UPDATE accommodations SET
                average_rating = CASE id
                    WHEN ${listingIds[0]}::uuid THEN 5
                    WHEN ${listingIds[1]}::uuid THEN 4
                    WHEN ${listingIds[2]}::uuid THEN 1
                END,
                reviews_count = 1
            WHERE id IN (${listingIds[0]}::uuid, ${listingIds[1]}::uuid, ${listingIds[2]}::uuid)
        `);
        await getDb().execute(sql`
            UPDATE accommodations
            SET inactive_since = ${new Date(MATRIX_NOW.getTime() - 200 * DAY)},
                deadlines_version = 1,
                deletion_announced_at = ${new Date(MATRIX_NOW.getTime() - DAY)}
            WHERE id = ${listingIds[2]}::uuid
        `);

        const reviewTexts = [
            `Published review ${randomUUID()}`,
            `Archived review ${randomUUID()}`,
            `Purged review ${randomUUID()}`
        ];
        const reviewRows = await Promise.all(
            listingIds.map((listingId, index) =>
                insertReview({
                    listingId,
                    reviewerId: reviewers[index]!.id,
                    averageRating: [5, 4, 1][index]!,
                    text: reviewTexts[index]!
                })
            )
        );
        const purgedReview = reviewRows[2]!;
        const beforeRow = await getDb().execute(
            sql`SELECT * FROM accommodation_reviews WHERE id = ${purgedReview.id}::uuid`
        );
        expect(beforeRow.rows).toHaveLength(1);

        const beforeTestimonials = payload(
            await readPublic('/api/v1/public/testimonials?pageSize=20')
        );
        const beforeTestimonialsText = JSON.stringify(beforeTestimonials);
        for (const row of reviewRows) expect(beforeTestimonialsText).toContain(row.id);
        for (const reviewText of reviewTexts) expect(beforeTestimonialsText).toContain(reviewText);

        const beforeStats = payload(await readPublic('/api/v1/public/stats'));
        expect(beforeStats.reviews).toBe(3);
        expect(beforeStats.averageRating).toBe(3.33);
        expect(beforeStats.recentReviewerAvatars).toEqual(expect.arrayContaining(imageUrls));

        const purge = await purgeInactiveListing({
            ...getListingPublicationPorts(),
            billing: {
                coverage: async () => ({ covered: false, sources: [] }),
                retentionStopped: async () => ({
                    stopped: false,
                    pauseEndedAt: null,
                    coverageLostAt: null
                })
            },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listingIds[2]!,
            ownerId: owner.id,
            correlationId: randomUUID(),
            clock: { now: () => MATRIX_NOW },
            previousPassStartedAt: MATRIX_NOW,
            afterCommit: {
                emitListingPurged: async () => {},
                deleteRemoteMedia: async () => {},
                revokeCalendarConnection: async () => {}
            }
        });
        expect(purge.purged).toBe(true);

        const afterRow = await getDb().execute(
            sql`SELECT * FROM accommodation_reviews WHERE id = ${purgedReview.id}::uuid`
        );
        expect(afterRow.rows).toEqual(beforeRow.rows);

        const afterTestimonials = payload(
            await readPublic('/api/v1/public/testimonials?pageSize=20')
        );
        const afterTestimonialsText = JSON.stringify(afterTestimonials);
        expect(afterTestimonialsText).toContain(reviewRows[0]!.id);
        expect(afterTestimonialsText).toContain(reviewRows[1]!.id);
        expect(afterTestimonialsText).toContain(reviewTexts[0]);
        expect(afterTestimonialsText).toContain(reviewTexts[1]);
        expect(afterTestimonialsText).not.toContain(purgedReview.id);
        expect(afterTestimonialsText).not.toContain(reviewTexts[2]);

        const afterStats = payload(await readPublic('/api/v1/public/stats'));
        expect(afterStats.reviews).toBe(2);
        expect(afterStats.averageRating).toBe(4.5);
        expect(afterStats.recentReviewerAvatars).toEqual(
            expect.arrayContaining([imageUrls[0], imageUrls[1]])
        );
        expect(afterStats.recentReviewerAvatars).not.toContain(imageUrls[2]);
        expect(afterTestimonialsText).toContain(reviewRows[1]!.id);
    });
});
