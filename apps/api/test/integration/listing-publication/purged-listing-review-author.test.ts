import { randomUUID } from 'node:crypto';
import { accommodationReviews, getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    MATRIX_NOW
} from './publication-routes.helpers';

const DAY = 86_400_000;
const app = initApp({ clock: { now: () => MATRIX_NOW } });
const fixtures: { listingId: string; destinationId: string; reviewerId: string }[] = [];

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM accommodation_reviews WHERE accommodation_id = ${fixture.listingId}::uuid`
        );
        await getDb().execute(
            sql`DELETE FROM accommodations WHERE id = ${fixture.listingId}::uuid`
        );
        await getDb().execute(
            sql`DELETE FROM destinations WHERE id = ${fixture.destinationId}::uuid`
        );
        await getDb().execute(sql`DELETE FROM users WHERE id = ${fixture.reviewerId}::uuid`);
    }
});

afterAll(async () => testDb.teardown());

describe('TEST:1686:6 AC:1686:6 the author still sees their review of a PURGED listing (D1)', () => {
    it('keeps the author review and private count while the public per-listing list is empty', async () => {
        const reviewer = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId = await createListing({
            ownerId: reviewer.id,
            destinationId,
            status: PublicationStatusEnum.ARCHIVED,
            complete: false
        });
        fixtures.push({ listingId, destinationId, reviewerId: reviewer.id });

        await getDb().execute(sql`
            UPDATE accommodations
            SET inactive_since = ${new Date(MATRIX_NOW.getTime() - 200 * DAY)},
                deadlines_version = 1,
                deletion_announced_at = ${new Date(MATRIX_NOW.getTime() - DAY)}
            WHERE id = ${listingId}::uuid
        `);
        const reviewText = `Author review ${randomUUID()}`;
        const [review] = await getDb()
            .insert(accommodationReviews)
            .values({
                accommodationId: listingId,
                userId: reviewer.id,
                title: 'Author review title',
                content: reviewText,
                rating: {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                },
                averageRating: 5,
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED'
            })
            .returning();
        if (!review) throw new Error('Author review fixture insert failed');

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
            listingId,
            ownerId: reviewer.id,
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

        const headers = actorHeaders({ id: reviewer.id });
        const reviewsResponse = await app.request(
            '/api/v1/protected/users/me/reviews?type=accommodation',
            { headers }
        );
        expect(reviewsResponse.status).toBe(200);
        const reviewsBody = JSON.stringify(await reviewsResponse.json());
        expect(reviewsBody).toContain(review.id);
        expect(reviewsBody).toContain(reviewText);
        expect(reviewsBody).toContain('"accommodationReviews":1');

        const statsResponse = await app.request('/api/v1/protected/users/me/stats', { headers });
        expect(statsResponse.status).toBe(200);
        const statsBody = (await statsResponse.json()) as {
            data?: { reviewCount?: number };
            reviewCount?: number;
        };
        expect(statsBody.data?.reviewCount ?? statsBody.reviewCount).toBe(1);

        clearCache();
        const publicResponse = await app.request(
            `/api/v1/public/accommodations/${listingId}/reviews`,
            { headers: { 'user-agent': 'hospeda-integration-test' } }
        );
        expect(publicResponse.status).toBe(200);
        const publicBody = JSON.stringify(await publicResponse.json());
        expect(publicBody).not.toContain(review.id);
        expect(publicBody).not.toContain(reviewText);
    });
});
