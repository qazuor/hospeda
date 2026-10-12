import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { listingPurgeModel } from '../../src/models/listing/listing-purge.model.ts';
import { accommodationReviews } from '../../src/schemas/accommodation/accommodation_review.dbschema.ts';
import { accommodationCalendarSync } from '../../src/schemas/accommodation/accommodationCalendarSync.dbschema.ts';
import { touristPriceAlerts } from '../../src/schemas/alert/tourist_price_alerts.dbschema.ts';
import { conversations } from '../../src/schemas/conversation/conversations.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { entityViews } from '../../src/schemas/entity-view/entity_view.dbschema.ts';
import { fixRequests } from '../../src/schemas/listing/fix_request.dbschema.ts';
import { revalidationConfig } from '../../src/schemas/revalidation/revalidation-config.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { userBookmarks } from '../../src/schemas/user/user_bookmark.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function createListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: `Purge fixture ${crypto.randomUUID()}`,
        slug: `purge-${crypto.randomUUID()}`,
        summary: 'private summary',
        description: 'private description',
        ownerId,
        destinationId
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe.each([
    'accommodation',
    'gastronomy',
    'experience'
] as const)('TEST:V6:13 listing purge model %s', (vertical) => {
    it('TEST:V6:13 blanks only its listing and closes an open fix request', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const admin = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, admin]);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, vertical, owner.id, destination.id);
            const otherListing = await createListing(tx, vertical, owner.id, destination.id);
            const mediaTables = {
                accommodation: { table: 'accommodation_media', fk: 'accommodation_id' },
                gastronomy: { table: 'gastronomy_media', fk: 'gastronomy_id' },
                experience: { table: 'experience_media', fk: 'experience_id' }
            } as const;
            const mediaTable = mediaTables[vertical];
            const faqTables = {
                accommodation: { table: 'accommodation_faqs', fk: 'accommodation_id' },
                gastronomy: { table: 'gastronomy_faqs', fk: 'gastronomy_id' },
                experience: { table: 'experience_faqs', fk: 'experience_id' }
            } as const;
            const faqTable = faqTables[vertical];
            const faq = await tx.execute(sql<{ id: string }>`
                    INSERT INTO ${sql.identifier(faqTable.table)} (${sql.identifier(faqTable.fk)}, question, answer)
                    VALUES (${listing.id}, 'Private question', 'Private answer') RETURNING id`);
            const uploaded = await tx.execute(sql<{ id: string }>`
                    INSERT INTO ${sql.identifier(mediaTable.table)} (${sql.identifier(mediaTable.fk)}, url, public_id, sort_order)
                    VALUES (${listing.id}, 'https://cdn.example.test/a.jpg', 'remote/a', 0) RETURNING id`);
            const external = await tx.execute(sql<{ id: string }>`
                    INSERT INTO ${sql.identifier(mediaTable.table)} (${sql.identifier(mediaTable.fk)}, url, public_id, sort_order)
                    VALUES (${listing.id}, 'https://cdn.example.test/b.jpg', NULL, 1) RETURNING id`);
            const otherMedia = await tx.execute(sql<{ id: string }>`
                    INSERT INTO ${sql.identifier(mediaTable.table)} (${sql.identifier(mediaTable.fk)}, url, public_id, sort_order)
                    VALUES (${otherListing.id}, 'https://cdn.example.test/other.jpg', 'remote/other', 0) RETURNING id`);
            const [openRequest] = await tx
                .insert(fixRequests)
                .values({
                    entityType: vertical,
                    entityId: listing.id,
                    reason: 'Needs a correction',
                    openedById: admin.id
                })
                .returning({ id: fixRequests.id });
            const at = new Date('2026-10-12T12:00:00.000Z');

            const result = await listingPurgeModel.purgeListingContent({
                tx,
                vertical,
                listingId: listing.id,
                at
            });

            expect(result).toMatchObject({
                markedMedia: [
                    { mediaId: uploaded.rows[0]?.id, publicId: 'remote/a' },
                    { mediaId: external.rows[0]?.id, publicId: null }
                ],
                markedCalendar: [],
                closedAlerts: [],
                closedFixRequestId: openRequest?.id
            });
            const tableByVertical = {
                accommodation: 'accommodations',
                gastronomy: 'gastronomies',
                experience: 'experiences'
            } as const;
            const stored = await tx.execute(sql<{
                id: string;
                owner_id: string;
                name: string;
                summary: string;
                description: string;
                deleted_at: Date | null;
            }>`
                    SELECT id, owner_id, name, summary, description, deleted_at
                    FROM ${sql.identifier(tableByVertical[vertical])} WHERE id = ${listing.id}`);
            expect(stored.rows[0]).toMatchObject({
                id: listing.id,
                owner_id: owner.id,
                name: listing.name,
                summary: '',
                description: '',
                deleted_at: null
            });
            const [closed] = await tx
                .select()
                .from(fixRequests)
                .where(eq(fixRequests.id, openRequest!.id));
            expect(closed).toMatchObject({ closedAt: at, closedById: null });
            const remainingFaq = await tx.execute(
                sql`SELECT id FROM ${sql.identifier(faqTable.table)} WHERE id = ${faq.rows[0]?.id}`
            );
            expect(remainingFaq.rows).toHaveLength(0);
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical,
                    mediaId: String(uploaded.rows[0]?.id)
                })
            ).toBe(true);
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical,
                    mediaId: String(uploaded.rows[0]?.id)
                })
            ).toBe(false);
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical,
                    mediaId: String(external.rows[0]?.id)
                })
            ).toBe(true);
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical,
                    mediaId: String(otherMedia.rows[0]?.id)
                })
            ).toBe(false);
            const otherMediaRow = await tx.execute(
                sql`SELECT id FROM ${sql.identifier(mediaTable.table)} WHERE id = ${otherMedia.rows[0]?.id}`
            );
            expect(otherMediaRow.rows).toHaveLength(1);
        });
    });

    it('TEST:V6:13 preserves personal data and closes only active accommodation alerts', async () => {
        if (vertical !== 'accommodation') return;
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const tourist = testData.user();
            const inactiveTourist = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, tourist, inactiveTourist]);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, vertical, owner.id, destination.id);
            const [calendar] = await tx
                .insert(accommodationCalendarSync)
                .values({
                    accommodationId: listing.id,
                    provider: 'GOOGLE_CALENDAR',
                    accessTokenCiphertext: 'fixture-ciphertext',
                    accessTokenIv: 'fixture-iv',
                    accessTokenAuthTag: 'fixture-tag',
                    createdById: owner.id
                })
                .returning({ id: accommodationCalendarSync.id });
            const [activeAlert] = await tx
                .insert(touristPriceAlerts)
                .values({
                    userId: tourist.id,
                    accommodationId: listing.id,
                    basePriceSnapshot: 10000
                })
                .returning({ id: touristPriceAlerts.id });
            const [inactiveAlert] = await tx
                .insert(touristPriceAlerts)
                .values({
                    userId: inactiveTourist.id,
                    accommodationId: listing.id,
                    basePriceSnapshot: 10000,
                    isActive: false
                })
                .returning({ id: touristPriceAlerts.id });
            const [conversation] = await tx
                .insert(conversations)
                .values({ accommodationId: listing.id, userId: tourist.id })
                .returning({
                    id: conversations.id,
                    accommodationId: conversations.accommodationId
                });
            const [bookmark] = await tx
                .insert(userBookmarks)
                .values({ userId: tourist.id, entityId: listing.id, entityType: 'ACCOMMODATION' })
                .returning({ id: userBookmarks.id, deletedAt: userBookmarks.deletedAt });
            const [review] = await tx
                .insert(accommodationReviews)
                .values({
                    accommodationId: listing.id,
                    userId: tourist.id,
                    rating: {
                        cleanliness: 5,
                        accuracy: 5,
                        checkIn: 5,
                        communication: 5,
                        location: 5,
                        value: 5
                    }
                })
                .returning({ id: accommodationReviews.id, content: accommodationReviews.content });
            const [view] = await tx
                .insert(entityViews)
                .values({
                    entityType: 'ACCOMMODATION',
                    entityId: listing.id,
                    visitorHash: `purge-${crypto.randomUUID()}`
                })
                .returning();
            const [revalidation] = await tx
                .insert(revalidationConfig)
                .values({ entityType: `purge-${crypto.randomUUID()}` })
                .returning();
            const rollup = await tx.execute(sql<{ id: string }>`
                INSERT INTO entity_view_monthly_rollups (entity_type, entity_id, month, total, unique_visitors)
                VALUES ('ACCOMMODATION', ${listing.id}, '2026-10-01', 7, 3)
                RETURNING id`);

            const result = await listingPurgeModel.purgeListingContent({
                tx,
                vertical,
                listingId: listing.id,
                at: new Date('2026-10-12T12:00:00.000Z')
            });

            expect(result.markedCalendar).toEqual([
                { connectionId: calendar!.id, provider: 'GOOGLE_CALENDAR' }
            ]);
            expect(result.closedAlerts).toEqual([
                { alertId: activeAlert!.id, touristUserId: tourist.id }
            ]);
            const storedCalendar = await tx
                .select()
                .from(accommodationCalendarSync)
                .where(eq(accommodationCalendarSync.id, calendar!.id));
            expect(storedCalendar[0]).toMatchObject({
                isActive: false,
                remoteDeletionPendingAt: new Date('2026-10-12T12:00:00.000Z')
            });
            const storedAlerts = await tx
                .select()
                .from(touristPriceAlerts)
                .where(eq(touristPriceAlerts.accommodationId, listing.id));
            expect(storedAlerts.find((alert) => alert.id === activeAlert!.id)?.isActive).toBe(
                false
            );
            expect(storedAlerts.find((alert) => alert.id === inactiveAlert!.id)?.isActive).toBe(
                false
            );
            expect(
                await tx.select().from(conversations).where(eq(conversations.id, conversation!.id))
            ).toMatchObject([{ accommodationId: listing.id }]);
            expect(
                await tx.select().from(userBookmarks).where(eq(userBookmarks.id, bookmark!.id))
            ).toMatchObject([{ entityId: listing.id, deletedAt: null }]);
            expect(
                await tx
                    .select()
                    .from(accommodationReviews)
                    .where(eq(accommodationReviews.id, review!.id))
            ).toMatchObject([{ content: review!.content }]);
            expect(
                await tx.select().from(entityViews).where(eq(entityViews.id, view!.id))
            ).toMatchObject([{ entityId: listing.id, visitorHash: view!.visitorHash }]);
            expect(
                await tx
                    .select()
                    .from(revalidationConfig)
                    .where(eq(revalidationConfig.id, revalidation!.id))
            ).toEqual([revalidation]);
            expect(
                await tx.execute(
                    sql`SELECT id FROM entity_view_monthly_rollups WHERE id = ${rollup.rows[0]?.id}`
                )
            ).toMatchObject({ rows: [] });
        });
    });
});
