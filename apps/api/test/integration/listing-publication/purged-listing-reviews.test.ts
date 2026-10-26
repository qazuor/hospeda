import { randomUUID } from 'node:crypto';
import { accommodationReviews, experienceReviews, gastronomyReviews, getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
    createVerticalListing
} from './publication-routes.helpers';

const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
type Vertical = (typeof verticals)[number];
const listingTables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const reviewTables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodation_reviews',
    [VerticalEnum.VENUE]: 'gastronomy_reviews',
    [VerticalEnum.EXPERIENCE]: 'experience_reviews'
};
const reviewListingColumns: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodation_id',
    [VerticalEnum.VENUE]: 'gastronomy_id',
    [VerticalEnum.EXPERIENCE]: 'experience_id'
};
const reviewPaths: Readonly<Record<Vertical, (id: string) => string>> = {
    [VerticalEnum.ACCOMMODATION]: (id) => `/api/v1/public/accommodations/${id}/reviews`,
    [VerticalEnum.VENUE]: (id) => `/api/v1/public/gastronomies/${id}/reviews`,
    [VerticalEnum.EXPERIENCE]: (id) => `/api/v1/public/experiences/${id}/reviews`
};
const MATRIX_NOW = new Date('2026-10-10T12:00:00.000Z');
const DAY = 86_400_000;
const app = initApp({ clock: { now: () => MATRIX_NOW } });
const fixtures: {
    vertical: Vertical;
    ownerId: string;
    reviewerId: string;
    destinationId: string;
    listingId: string;
}[] = [];

async function publicReviewBody(path: string): Promise<{ status: number; serialized: string }> {
    const response = await app.request(path, {
        headers: { 'user-agent': 'hospeda-integration-test' }
    });
    const body = await response.json();
    return { status: response.status, serialized: JSON.stringify(body) };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(reviewTables[fixture.vertical])}
                WHERE ${sql.identifier(reviewListingColumns[fixture.vertical])} = ${fixture.listingId}::uuid`
        );
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(listingTables[fixture.vertical])} WHERE id = ${fixture.listingId}::uuid`
        );
        await getDb().execute(
            sql`DELETE FROM destinations WHERE id = ${fixture.destinationId}::uuid`
        );
        await getDb().execute(
            sql`DELETE FROM users WHERE id IN (${fixture.ownerId}::uuid, ${fixture.reviewerId}::uuid)`
        );
    }
});

afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V9b:3 AC:V9b:3 reseñas de terceros — %s', (vertical) => {
    it('conserva la reseña de un tercero y la lista pública la muestra antes de PB9', async () => {
        const owner = await createOwner();
        const reviewer = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED,
                      complete: false
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED,
                      complete: false
                  });
        const fixture = {
            vertical,
            ownerId: owner.id,
            reviewerId: reviewer.id,
            destinationId,
            listingId
        };
        fixtures.push(fixture);

        await getDb().execute(
            sql`UPDATE ${sql.identifier(listingTables[vertical])}
                SET publication_status = 'ARCHIVED',
                    inactive_since = ${new Date(MATRIX_NOW.getTime() - 200 * DAY)},
                    deadlines_version = 1,
                    deletion_announced_at = ${new Date(MATRIX_NOW.getTime() - DAY)}
                WHERE id = ${listingId}::uuid`
        );

        const reviewText = `Third-party review ${vertical} ${randomUUID()}`;
        let reviewId: string;
        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [review] = await getDb()
                .insert(accommodationReviews)
                .values({
                    accommodationId: listingId,
                    userId: reviewer.id,
                    title: 'Third-party title',
                    content: reviewText,
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    },
                    moderationState: 'APPROVED',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!review) throw new Error('Accommodation review fixture insert failed');
            reviewId = review.id;
        } else if (vertical === VerticalEnum.VENUE) {
            const [review] = await getDb()
                .insert(gastronomyReviews)
                .values({
                    gastronomyId: listingId,
                    userId: reviewer.id,
                    title: 'Third-party title',
                    content: reviewText,
                    rating: { food: 5, service: 5, ambiance: 5, value: 5 },
                    overallRating: 5,
                    moderationState: 'APPROVED',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!review) throw new Error('Gastronomy review fixture insert failed');
            reviewId = review.id;
        } else {
            const [review] = await getDb()
                .insert(experienceReviews)
                .values({
                    experienceId: listingId,
                    userId: reviewer.id,
                    title: 'Third-party title',
                    content: reviewText,
                    rating: { food: 5, service: 5, ambiance: 5, value: 5 },
                    overallRating: 5,
                    moderationState: 'APPROVED',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!review) throw new Error('Experience review fixture insert failed');
            reviewId = review.id;
        }

        const before = await getDb().execute(
            sql`SELECT * FROM ${sql.identifier(reviewTables[vertical])} WHERE id = ${reviewId}::uuid`
        );
        expect(before.rows).toHaveLength(1);
        const beforeResponse = await publicReviewBody(reviewPaths[vertical](listingId));
        expect(beforeResponse.status, beforeResponse.serialized).toBe(200);
        expect(beforeResponse.serialized).toContain(reviewText);
        expect(beforeResponse.serialized).toContain(reviewId);

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
            vertical,
            listingId,
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

        const after = await getDb().execute(
            sql`SELECT * FROM ${sql.identifier(reviewTables[vertical])} WHERE id = ${reviewId}::uuid`
        );
        expect(after.rows).toEqual(before.rows);

        clearCache();
        const afterResponse = await publicReviewBody(reviewPaths[vertical](listingId));
        expect(afterResponse.status).toBe(200);
        expect(afterResponse.serialized).not.toContain(reviewText);
        expect(afterResponse.serialized).not.toContain(reviewId);
    });
});
