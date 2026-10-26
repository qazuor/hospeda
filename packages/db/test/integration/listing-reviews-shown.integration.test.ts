import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PublicationStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodationReviewModel } from '../../src/models/accommodation/accommodationReview.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { listingReviewsShownCondition } from '../../src/models/listing/listing-reviews-shown.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { accommodationReviews } from '../../src/schemas/accommodation/accommodation_review.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { experienceReviews } from '../../src/schemas/experience/experience_review.dbschema.ts';
import { experiences } from '../../src/schemas/experience/experiences.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { gastronomies } from '../../src/schemas/venue/venue.dbschema.ts';
import { gastronomyReviews } from '../../src/schemas/venue/venue_review.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:1686:1 AC:1686:1 AC:1686:4 listingReviewsShownCondition', () => {
    it('shows a seeded review in every non-PURGED publication state for all verticals', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const reviewer = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, reviewer]);
            await tx.insert(destinations).values(destination);
            const common = {
                ownerId: owner.id,
                destinationId: destination.id,
                summary: 'summary',
                description: 'description'
            };
            const accommodation = await new AccommodationModel().create(
                {
                    ...common,
                    name: `Review visibility ${crypto.randomUUID()}`,
                    slug: `review-${crypto.randomUUID()}`,
                    type: 'CABIN'
                } as never,
                tx
            );
            const venue = await new VenueModel().create(
                {
                    ...common,
                    name: `Review visibility ${crypto.randomUUID()}`,
                    slug: `review-${crypto.randomUUID()}`,
                    type: 'RESTAURANT'
                } as never,
                tx
            );
            const experience = await new ExperienceModel().create(
                {
                    ...common,
                    name: `Review visibility ${crypto.randomUUID()}`,
                    slug: `review-${crypto.randomUUID()}`,
                    type: 'EXCURSION'
                } as never,
                tx
            );

            const fixtures = [
                {
                    vertical: VerticalEnum.ACCOMMODATION,
                    table: accommodations,
                    reviewTable: accommodationReviews,
                    fk: accommodationReviews.accommodationId,
                    listing: accommodation,
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    }
                },
                {
                    vertical: VerticalEnum.VENUE,
                    table: gastronomies,
                    reviewTable: gastronomyReviews,
                    fk: gastronomyReviews.gastronomyId,
                    listing: venue,
                    rating: { food: 5, service: 5, ambiance: 5, value: 5 }
                },
                {
                    vertical: VerticalEnum.EXPERIENCE,
                    table: experiences,
                    reviewTable: experienceReviews,
                    fk: experienceReviews.experienceId,
                    listing: experience,
                    rating: { service: 5, value: 5, guide: 5, overall: 5 }
                }
            ] as const;

            for (const fixture of fixtures) {
                for (const status of Object.values(PublicationStatusEnum)) {
                    await tx
                        .update(fixture.table)
                        .set({ publicationStatus: status })
                        .where(sql`${fixture.table.id} = ${fixture.listing.id}`);
                    const reviewValues =
                        fixture.vertical === VerticalEnum.ACCOMMODATION
                            ? {
                                  accommodationId: fixture.listing.id,
                                  userId: reviewer.id,
                                  rating: fixture.rating
                              }
                            : fixture.vertical === VerticalEnum.VENUE
                              ? {
                                    gastronomyId: fixture.listing.id,
                                    userId: reviewer.id,
                                    rating: fixture.rating,
                                    overallRating: 5
                                }
                              : {
                                    experienceId: fixture.listing.id,
                                    userId: reviewer.id,
                                    rating: fixture.rating,
                                    overallRating: 5
                                };
                    const inserted = await tx
                        .insert(fixture.reviewTable)
                        .values({
                            ...reviewValues,
                            lifecycleState: LifecycleStatusEnum.ACTIVE,
                            moderationState: ModerationStatusEnum.APPROVED
                        } as never)
                        .returning({ id: fixture.reviewTable.id });
                    const review = inserted[0];
                    if (!review) throw new Error('Review fixture insert failed');
                    const result = await tx.execute(sql<{ id: string }>`
                        SELECT id FROM ${fixture.reviewTable}
                        WHERE ${fixture.fk} = ${fixture.listing.id}
                          AND ${listingReviewsShownCondition({ vertical: fixture.vertical })}`);
                    expect
                        .soft(
                            result.rows.map((row) => row.id),
                            `${fixture.vertical} ${status}`
                        )
                        .toEqual(status === PublicationStatusEnum.PURGED ? [] : [review.id]);
                    await tx
                        .delete(fixture.reviewTable)
                        .where(sql`${fixture.reviewTable.id} = ${review.id}`);
                }
            }

            const purged = await new AccommodationModel().create(
                {
                    ...common,
                    name: `PURGED testimony ${crypto.randomUUID()}`,
                    slug: `purged-${crypto.randomUUID()}`,
                    type: 'CABIN'
                } as never,
                tx
            );
            const published = await new AccommodationModel().create(
                {
                    ...common,
                    name: `Published testimony ${crypto.randomUUID()}`,
                    slug: `published-${crypto.randomUUID()}`,
                    type: 'CABIN'
                } as never,
                tx
            );
            await tx
                .update(accommodations)
                .set({ publicationStatus: PublicationStatusEnum.PURGED })
                .where(sql`${accommodations.id} = ${purged.id}`);
            const [purgedReview] = await tx
                .insert(accommodationReviews)
                .values({
                    accommodationId: purged.id,
                    userId: reviewer.id,
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    }
                })
                .returning();
            await tx.insert(accommodationReviews).values({
                accommodationId: published.id,
                userId: owner.id,
                rating: {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                }
            });
            if (!purgedReview) throw new Error('PURGED review fixture insert failed');
            const condition = listingReviewsShownCondition({
                vertical: VerticalEnum.ACCOMMODATION
            });
            const paged = await accommodationReviewModel.findAllWithUser(
                { accommodationId: purged.id },
                { page: 1, pageSize: 10 },
                tx,
                [condition]
            );
            expect.soft(paged).toMatchObject({ items: [], total: 0 });
            const unpaged = await accommodationReviewModel.findAllWithUser(
                { accommodationId: purged.id },
                undefined,
                tx,
                [condition]
            );
            expect.soft(unpaged).toMatchObject({ items: [], total: 0 });
            expect
                .soft(
                    await accommodationReviewModel.findAllWithUser(
                        { accommodationId: published.id },
                        { page: 1, pageSize: 10 },
                        tx,
                        [condition]
                    )
                )
                .toMatchObject({ items: [expect.anything()], total: 1 });
            expect
                .soft(
                    await accommodationReviewModel.findAllWithUser(
                        { accommodationId: published.id },
                        undefined,
                        tx,
                        [condition]
                    )
                )
                .toMatchObject({ items: [expect.anything()], total: 1 });
            expect
                .soft(
                    await accommodationReviewModel.findAllWithUser(
                        { accommodationId: purged.id },
                        undefined,
                        tx
                    )
                )
                .toMatchObject({
                    items: [expect.objectContaining({ id: purgedReview.id })],
                    total: 1
                });
        });
    });
});
