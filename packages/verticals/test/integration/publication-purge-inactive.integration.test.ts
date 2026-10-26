import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, emailOutbox, eq, trials, users } from '@repo/db';
import { PublicationStatusEnum as Status, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const ownersWithOutbox = new Set<string>();
const amenityIds = new Set<string>();
const markedMediaFixtures: { table: string; id: string }[] = [];
afterEach(async () => {
    for (const ownerId of ownersWithOutbox) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    }
    ownersWithOutbox.clear();
    for (const media of markedMediaFixtures)
        await db.execute(
            sql`UPDATE ${sql.raw(media.table)} SET remote_deletion_pending_at = NULL WHERE id = ${media.id}`
        );
    markedMediaFixtures.length = 0;
    for (const id of amenityIds) await db.execute(sql`DELETE FROM amenities WHERE id = ${id}`);
    amenityIds.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());
const day = 86_400_000;
const t0 = new Date('2026-01-01T12:00:00.000Z');
const noCoverage = { value: false };
const limits = { value: 2 };
const afterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {},
    revalidate: async () => {}
};
const retentionAfterCommit = {
    emitListingPurged: async () => {},
    deleteRemoteMedia: async () => {},
    revokeCalendarConnection: async () => {}
};

describe.each([
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const)('TEST:V9b:1 AC:V9b:1 %s', (vertical) => {
    it('purges only an expired archived row and preserves the owner and a second listing', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const archived = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.ARCHIVED
        });
        const otherVertical =
            vertical === VerticalEnum.ACCOMMODATION
                ? VerticalEnum.VENUE
                : VerticalEnum.ACCOMMODATION;
        const amenityId = randomUUID();
        const amenityRelation =
            vertical === VerticalEnum.ACCOMMODATION
                ? 'r_accommodation_amenity'
                : vertical === VerticalEnum.VENUE
                  ? 'r_gastronomy_amenity'
                  : 'r_experience_amenity';
        const otherAmenityRelation =
            otherVertical === VerticalEnum.ACCOMMODATION
                ? 'r_accommodation_amenity'
                : otherVertical === VerticalEnum.VENUE
                  ? 'r_gastronomy_amenity'
                  : 'r_experience_amenity';
        await db.execute(
            sql`INSERT INTO amenities (id, slug, type, applicable_verticals) VALUES (${amenityId}, ${`pb9-${amenityId}`}, 'GENERAL_APPLIANCES', ARRAY[${vertical}]::text[])`
        );
        amenityIds.add(amenityId);
        const other = await fixtures.listing({
            vertical: otherVertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        await db.execute(
            sql`INSERT INTO ${sql.raw(amenityRelation)} (${sql.raw(`${vertical}_id`)}, amenity_id) VALUES (${archived.id}, ${amenityId})`
        );
        await db.execute(
            sql`INSERT INTO ${sql.raw(otherAmenityRelation)} (${sql.raw(`${otherVertical}_id`)}, amenity_id) VALUES (${other.id}, ${amenityId})`
        );
        const otherAmenityBefore = await db.execute(
            sql`SELECT * FROM ${sql.raw(otherAmenityRelation)} WHERE ${sql.raw(`${otherVertical}_id`)} = ${other.id}`
        );
        const listingTable = vertical === VerticalEnum.VENUE ? 'gastronomies' : `${vertical}s`;
        await db.execute(
            vertical === VerticalEnum.VENUE
                ? sql`UPDATE ${sql.raw(listingTable)} SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)}, description = 'private purge text', summary = 'private summary', opening_hours = '{"monday":{"open":"09:00","close":"17:00"}}'::jsonb WHERE id = ${archived.id}`
                : sql`UPDATE ${sql.raw(listingTable)} SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)}, description = 'private purge text', summary = 'private summary' WHERE id = ${archived.id}`
        );
        const faqTable =
            vertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_faqs'
                : vertical === VerticalEnum.VENUE
                  ? 'gastronomy_faqs'
                  : 'experience_faqs';
        const mediaTable =
            vertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_media'
                : vertical === VerticalEnum.VENUE
                  ? 'gastronomy_media'
                  : 'experience_media';
        const fk =
            vertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_id'
                : vertical === VerticalEnum.VENUE
                  ? 'gastronomy_id'
                  : 'experience_id';
        const otherFaqTable =
            otherVertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_faqs'
                : otherVertical === VerticalEnum.VENUE
                  ? 'gastronomy_faqs'
                  : 'experience_faqs';
        const otherMediaTable =
            otherVertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_media'
                : otherVertical === VerticalEnum.VENUE
                  ? 'gastronomy_media'
                  : 'experience_media';
        const otherFk =
            otherVertical === VerticalEnum.ACCOMMODATION
                ? 'accommodation_id'
                : otherVertical === VerticalEnum.VENUE
                  ? 'gastronomy_id'
                  : 'experience_id';
        await db.execute(
            sql`INSERT INTO ${sql.raw(otherFaqTable)} (${sql.raw(otherFk)}, question, answer) VALUES (${other.id}, 'preserved question', 'preserved answer')`
        );
        const otherMediaResult = await db.execute(
            sql`INSERT INTO ${sql.raw(otherMediaTable)} (${sql.raw(otherFk)}, url, public_id, sort_order) VALUES (${other.id}, 'https://example.test/other-photo.jpg', 'listing/other-photo', 0) RETURNING id`
        );
        const otherMediaId = String(otherMediaResult.rows[0]?.id);
        const otherFaqBefore = await db.execute(
            sql`SELECT * FROM ${sql.raw(otherFaqTable)} WHERE ${sql.raw(otherFk)} = ${other.id}`
        );
        const otherMediaBefore = await db.execute(
            sql`SELECT * FROM ${sql.raw(otherMediaTable)} WHERE id = ${otherMediaId}`
        );
        await db.execute(
            sql`INSERT INTO ${sql.raw(faqTable)} (${sql.raw(fk)}, question, answer) VALUES (${archived.id}, 'private question', 'private answer')`
        );
        const mediaResult = await db.execute(
            sql`INSERT INTO ${sql.raw(mediaTable)} (${sql.raw(fk)}, url, public_id, sort_order) VALUES (${archived.id}, 'https://example.test/photo.jpg', 'listing/private-photo', 0) RETURNING id`
        );
        const mediaId = String(mediaResult.rows[0]?.id);
        markedMediaFixtures.push({ table: mediaTable, id: mediaId });
        const mediaBefore = await db.execute(
            sql`SELECT * FROM ${sql.raw(mediaTable)} WHERE id = ${mediaId}`
        );
        await db
            .update(users)
            .set({
                displayName: 'PB9 Person',
                settings: {
                    notifications: {
                        enabled: false,
                        allowEmails: true,
                        allowSms: false,
                        allowPush: false
                    }
                }
            })
            .where(eq(users.id, userId));
        const pseudonym = randomUUID().replace(/-/g, '').repeat(2);
        await db.insert(trials).values({
            userId,
            vertical,
            status: TrialStatusEnum.TRIAL_EXPIRED,
            emailPseudonym: pseudonym,
            deadlinesVersion: 1
        });
        const subscriptionId = randomUUID();
        const subscriptionEventId = randomUUID();
        await db.insert(domainEvent).values({
            eventType: 'subscription.provider_cancellation_decided',
            entityType: 'subscription',
            entityId: subscriptionId,
            actorType: 'job',
            correlationId: subscriptionEventId,
            changes: []
        });
        await db.insert(emailOutbox).values({
            recipientUserId: userId,
            recipientEmail: `pb9-${userId}@example.test`,
            template: 'test.owner-record',
            payload: { marker: 'preserve' },
            dedupKey: `pb9-owner-${userId}`
        });
        ownersWithOutbox.add(userId);
        const ownerBefore = await db.select().from(users).where(eq(users.id, userId));
        const trialBefore = await db.select().from(trials).where(eq(trials.userId, userId));
        const subscriptionEventsBefore = await db
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, subscriptionId));
        const ownerOutboxBefore = await db
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, userId));
        const otherListingTable =
            otherVertical === VerticalEnum.VENUE ? 'gastronomies' : `${otherVertical}s`;
        const otherBefore = await db.execute(
            sql`SELECT * FROM ${sql.raw(otherListingTable)} WHERE id = ${other.id}`
        );
        const corr = randomUUID();
        const adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            billing: {
                coverage: async ({ vertical: queriedVertical }) => ({
                    covered: queriedVertical === otherVertical,
                    sources: []
                })
            }
        });
        const result = await purgeInactiveListing({
            ...adapter,
            clock: { now: () => t0 },
            previousPassStartedAt: t0,
            vertical,
            listingId: archived.id,
            ownerId: userId,
            correlationId: corr,
            afterCommit: retentionAfterCommit
        });
        expect(result).toMatchObject({ purged: true });
        const after = await db.execute(
            sql`SELECT id, publication_status, deleted_at, name, description, summary${vertical === VerticalEnum.VENUE || vertical === VerticalEnum.EXPERIENCE ? sql`, opening_hours` : sql``} FROM ${sql.raw(listingTable)} WHERE id = ${archived.id}`
        );
        expect(after.rows).toHaveLength(1);
        expect(after.rows[0]).toMatchObject({
            publication_status: 'PURGED',
            deleted_at: null,
            name: 'Publication fixture',
            description: '',
            summary: ''
        });
        if (vertical === VerticalEnum.VENUE || vertical === VerticalEnum.EXPERIENCE) {
            expect(after.rows[0]).toMatchObject({ opening_hours: null });
        }
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(faqTable)} WHERE ${sql.raw(fk)} = ${archived.id}`
                )
            ).rows
        ).toEqual([]);
        const mediaAfter = await db.execute(
            sql`SELECT * FROM ${sql.raw(mediaTable)} WHERE id = ${mediaId}`
        );
        const beforeMedia = mediaBefore.rows[0] as Record<string, unknown>;
        const afterMedia = mediaAfter.rows[0] as Record<string, unknown>;
        expect(new Date(String(afterMedia.remote_deletion_pending_at))).toEqual(t0);
        const expectedMedia = {
            ...beforeMedia,
            remote_deletion_pending_at: afterMedia.remote_deletion_pending_at,
            updated_at: afterMedia.updated_at
        };
        expect(mediaAfter.rows).toEqual([expectedMedia]);
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(amenityRelation)} WHERE ${sql.raw(`${vertical}_id`)} = ${archived.id}`
                )
            ).rows
        ).toEqual([]);
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(otherAmenityRelation)} WHERE ${sql.raw(`${otherVertical}_id`)} = ${other.id}`
                )
            ).rows
        ).toEqual(otherAmenityBefore.rows);
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(otherFaqTable)} WHERE ${sql.raw(otherFk)} = ${other.id}`
                )
            ).rows
        ).toEqual(otherFaqBefore.rows);
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(otherMediaTable)} WHERE id = ${otherMediaId}`
                )
            ).rows
        ).toEqual(otherMediaBefore.rows);
        expect((await db.select().from(users).where(eq(users.id, userId)))[0]).toEqual(
            ownerBefore[0]
        );
        expect(await db.select().from(trials).where(eq(trials.userId, userId))).toEqual(
            trialBefore
        );
        expect(
            await db.select().from(domainEvent).where(eq(domainEvent.entityId, subscriptionId))
        ).toEqual(subscriptionEventsBefore);
        expect(
            await db.select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId))
        ).toEqual(ownerOutboxBefore);
        expect(
            (
                await db.execute(
                    sql`SELECT * FROM ${sql.raw(otherListingTable)} WHERE id = ${other.id}`
                )
            ).rows
        ).toEqual(otherBefore.rows);
        const event = await db
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.correlationId, corr));
        expect(event).toContainEqual(
            expect.objectContaining({
                eventType: 'listing.status_changed',
                actorType: 'job',
                changes: [{ field: 'publicationStatus', old: 'ARCHIVED', new: 'PURGED' }]
            })
        );
        expect(
            await db.select().from(emailOutbox).where(eq(emailOutbox.correlationId, corr))
        ).toEqual([]);
    });
});

describe('TEST:V9b:7 AC:V9b:7', () => {
    it('keeps a late archived listing until the announced day, including the exact boundary', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${t0}, deadlines_version = 1 WHERE id = ${listing.id}`
        );
        const adapter = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        const archivedAt = new Date(t0.getTime() + 120 * day);
        const archived = await archiveInactiveListing({
            ...adapter,
            clock: { now: () => archivedAt },
            afterCommit,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(archived).toMatchObject({ archived: true, transition: 'PB4' });
        const rows = await db.execute(
            sql`SELECT deletion_announced_at FROM accommodations WHERE id = ${listing.id}`
        );
        const announcedAt = new Date(
            (rows.rows[0] as { deletion_announced_at: Date }).deletion_announced_at
        );
        expect(announcedAt).toEqual(new Date(t0.getTime() + 210 * day));
        const tryPurge = (now: Date) =>
            purgeInactiveListing({
                ...adapter,
                clock: { now: () => now },
                previousPassStartedAt: now,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                ownerId: userId,
                correlationId: randomUUID(),
                afterCommit: retentionAfterCommit
            });
        expect(await tryPurge(new Date(t0.getTime() + 180 * day))).toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(await tryPurge(new Date(t0.getTime() + 180 * day + 60 * 60 * 1000))).toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(await tryPurge(new Date(announcedAt.getTime() - 1))).toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(await tryPurge(announcedAt)).toMatchObject({ purged: true, dueAt: announcedAt });
    });

    it('uses the later pause and coverage-loss dates', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.ARCHIVED
        });
        const pauseEndedAt = new Date(t0.getTime() + 10 * day);
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${t0}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)} WHERE id = ${listing.id}`
        );
        const adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            retention: { stopped: false, pauseEndedAt }
        });
        const attempt = (now: Date) =>
            purgeInactiveListing({
                ...adapter,
                clock: { now: () => now },
                previousPassStartedAt: now,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                ownerId: userId,
                correlationId: randomUUID(),
                afterCommit: retentionAfterCommit
            });
        expect(await attempt(new Date(t0.getTime() + 180 * day))).toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(await attempt(new Date(pauseEndedAt.getTime() + 180 * day))).toMatchObject({
            purged: true
        });
        const second = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.ARCHIVED
        });
        const coverageLostAt = new Date(t0.getTime() + 20 * day);
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${t0}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)} WHERE id = ${second.id}`
        );
        const coverageAdapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            retention: { stopped: false, pauseEndedAt: null, coverageLostAt }
        });
        const coverageAttempt = (now: Date) =>
            purgeInactiveListing({
                ...coverageAdapter,
                clock: { now: () => now },
                previousPassStartedAt: now,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: second.id,
                ownerId: userId,
                correlationId: randomUUID(),
                afterCommit: retentionAfterCommit
            });
        expect(await coverageAttempt(new Date(t0.getTime() + 180 * day))).toEqual({
            purged: false,
            reason: 'NOT_DUE'
        });
        expect(await coverageAttempt(new Date(coverageLostAt.getTime() + 180 * day))).toMatchObject(
            { purged: true }
        );
    });

    it('does not purge a due PUBLISHED listing', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1 WHERE id = ${listing.id}`
        );
        const adapter = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        await expect(
            purgeInactiveListing({
                ...adapter,
                clock: { now: () => t0 },
                previousPassStartedAt: t0,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                ownerId: userId,
                correlationId: randomUUID(),
                afterCommit: retentionAfterCommit
            })
        ).resolves.toEqual({ purged: false, reason: 'NOT_ARCHIVED' });
    });
});
