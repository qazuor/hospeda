import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    accommodationCalendarSync,
    accommodationMedia,
    domainEvent,
    emailOutbox,
    eq,
    fixRequests,
    listingPublicationModel,
    listingPurgeModel,
    touristPriceAlerts
} from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { takeDownListing } from '../../src/publication/moderate-listing';
import type { PurgeAfterCommit } from '../../src/publication/publication-types';
import { purgeListing } from '../../src/publication/purge-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
afterEach(async () => fixtures.cleanup());
const at = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => new Date(at) };
afterAll(async () => pool.end());

describe('TEST:V6:13 PB12 PostgreSQL integration', () => {
    it('TEST:V6:13 purges from all five states, sends owner confirmation, and pushes after commit', async () => {
        const statuses = [
            Status.DRAFT,
            Status.PUBLISHED,
            Status.UNPUBLISHED_BY_BILLING,
            Status.ARCHIVED,
            Status.MODERATED
        ] as const;
        const revalidated: string[] = [];
        for (const status of statuses) {
            const { userId, destinationId } = await fixtures.owner();
            const initial =
                status === Status.ARCHIVED
                    ? Status.PUBLISHED
                    : status === Status.MODERATED
                      ? Status.DRAFT
                      : status;
            const listing = await fixtures.listing({
                vertical: VerticalEnum.ACCOMMODATION,
                userId,
                destinationId,
                status: initial
            });
            const prep = createPublicationTestAdapter({
                db,
                covered: { value: false },
                limit: { value: 2 }
            });
            if (status === Status.ARCHIVED) {
                await db.execute(
                    sql`UPDATE accommodations SET inactive_since = ${new Date(at.getTime() - 120 * 86_400_000)} WHERE id = ${listing.id}`
                );
                const archived = await archiveInactiveListing({
                    ...prep,
                    billing: prep.billing,
                    clock,
                    afterCommit: {
                        emitCoverageChanged: vi.fn(async () => {}),
                        invalidateUser: vi.fn(async () => {}),
                        revalidate: vi.fn(async () => {})
                    },
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: listing.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                });
                expect(archived).toMatchObject({ archived: true, transition: 'PB4' });
            }
            if (status === Status.MODERATED) {
                const admin = await fixtures.owner();
                const moderated = await takeDownListing({
                    ...prep,
                    clock,
                    afterCommit: {
                        emitCoverageChanged: vi.fn(async () => {}),
                        invalidateUser: vi.fn(async () => {}),
                        revalidate: vi.fn(async () => {})
                    },
                    adminId: admin.userId,
                    ownerId: userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: listing.id,
                    reason: 'test moderation',
                    correlationId: randomUUID()
                });
                expect(moderated).toMatchObject({ ok: true });
            }
            const correlationId = randomUUID();
            const adapter = createPublicationTestAdapter({
                db,
                covered: { value: false },
                limit: { value: 2 }
            });
            let pushedState: Status | undefined;
            const afterCommit: PurgeAfterCommit = {
                emitCoverageChanged: vi.fn(async () => {}),
                invalidateUser: vi.fn(async () => {}),
                async revalidate() {
                    revalidated.push(listing.id);
                },
                async emitListingPurged() {
                    pushedState = await db.transaction(async (tx) => {
                        await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
                        await tx.execute(sql`SET LOCAL statement_timeout = '2s'`);
                        return (
                            await listingPublicationModel.readListing({
                                tx,
                                vertical: VerticalEnum.ACCOMMODATION,
                                listingId: listing.id
                            })
                        )?.publicationStatus;
                    });
                },
                async deleteRemoteMedia() {},
                async revokeCalendarConnection() {}
            };

            const result = await purgeListing({
                ...adapter,
                clock,
                afterCommit,
                actor: { kind: 'owner', userId },
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                correlationId
            });

            expect(result).toMatchObject({ purged: true, from: status });
            expect(
                (
                    await listingPublicationModel.readListing({
                        tx: db,
                        vertical: VerticalEnum.ACCOMMODATION,
                        listingId: listing.id
                    })
                )?.publicationStatus
            ).toBe(Status.PURGED);
            expect(pushedState).toBe(Status.PURGED);
            const notices = await db
                .select({ template: emailOutbox.template, payload: emailOutbox.payload })
                .from(emailOutbox)
                .where(eq(emailOutbox.correlationId, correlationId));
            expect(notices).toContainEqual({
                template: 'verticals.listing-purged',
                payload: expect.objectContaining({ bySupport: false })
            });
            const eventRows = await db
                .select({ actorType: domainEvent.actorType })
                .from(domainEvent)
                .where(eq(domainEvent.correlationId, correlationId));
            expect(eventRows).toContainEqual({ actorType: 'owner' });
            const repeated = await purgeListing({
                ...adapter,
                clock,
                afterCommit,
                actor: { kind: 'owner', userId },
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                correlationId: randomUUID()
            });
            expect(repeated).toEqual({ purged: false, reason: 'INVALID_FROM' });
        }
        expect(revalidated).toHaveLength(1);
    });

    it('TEST:V6:13 keeps failed media marked while calendar revocation and tourist notice finish', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const tourist = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const [media] = await db
            .insert(accommodationMedia)
            .values({
                accommodationId: listing.id,
                url: 'https://cdn.example.test/purge.jpg',
                publicId: 'fixture/purge-photo',
                sortOrder: 0
            })
            .returning({ id: accommodationMedia.id });
        const [calendar] = await db
            .insert(accommodationCalendarSync)
            .values({
                accommodationId: listing.id,
                provider: 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'fixture-ciphertext',
                accessTokenIv: 'fixture-iv',
                accessTokenAuthTag: 'fixture-tag',
                createdById: userId
            })
            .returning({ id: accommodationCalendarSync.id });
        const [alert] = await db
            .insert(touristPriceAlerts)
            .values({
                userId: tourist.userId,
                accommodationId: listing.id,
                basePriceSnapshot: 10000
            })
            .returning({ id: touristPriceAlerts.id });
        const storage = new Set(['fixture/purge-photo']);
        const revoked = new Set<string>();
        const correlationId = randomUUID();
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 }
        });
        const afterCommit: PurgeAfterCommit = {
            emitCoverageChanged: vi.fn(async () => {}),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {}),
            async emitListingPurged() {
                expect(
                    (
                        await listingPublicationModel.readListing({
                            tx: db,
                            vertical: VerticalEnum.ACCOMMODATION,
                            listingId: listing.id
                        })
                    )?.publicationStatus
                ).toBe(Status.PURGED);
            },
            async deleteRemoteMedia() {
                throw new Error('controlled storage outage');
            },
            async revokeCalendarConnection(args) {
                revoked.add(args.connectionId);
                await listingPurgeModel.deleteMarkedCalendarConnection({
                    tx: db,
                    connectionId: args.connectionId
                });
            }
        };

        const result = await purgeListing({
            ...adapter,
            clock,
            afterCommit,
            actor: { kind: 'owner', userId },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            correlationId
        });

        expect(result).toMatchObject({
            purged: true,
            markedMedia: 1,
            markedCalendar: 1,
            closedAlerts: 1,
            warnings: ['REMOTE_DELETION_FAILED']
        });
        expect(storage.has('fixture/purge-photo')).toBe(true);
        expect(revoked.has(calendar!.id)).toBe(true);
        const mediaRows = await db
            .select()
            .from(accommodationMedia)
            .where(eq(accommodationMedia.id, media!.id));
        expect(mediaRows[0]?.remoteDeletionPendingAt).toBeInstanceOf(Date);
        expect(
            await db
                .select()
                .from(accommodationCalendarSync)
                .where(eq(accommodationCalendarSync.id, calendar!.id))
        ).toHaveLength(0);
        expect(
            (
                await db
                    .select()
                    .from(touristPriceAlerts)
                    .where(eq(touristPriceAlerts.id, alert!.id))
            )[0]?.isActive
        ).toBe(false);
        const notices = await db
            .select({
                template: emailOutbox.template,
                recipientUserId: emailOutbox.recipientUserId
            })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        expect(notices).toEqual(
            expect.arrayContaining([
                { template: 'verticals.listing-purged', recipientUserId: userId },
                { template: 'verticals.price-alert-closed', recipientUserId: tourist.userId }
            ])
        );
    });

    it('TEST:V6:13 records support reason and uses the same owner confirmation payload', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const admin = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.GASTRONOMY,
            userId,
            destinationId,
            status: Status.MODERATED
        });
        const correlationId = randomUUID();
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const afterCommit: PurgeAfterCommit = {
            emitCoverageChanged: vi.fn(async () => {}),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {}),
            emitListingPurged: vi.fn(async () => {}),
            deleteRemoteMedia: vi.fn(async () => {}),
            revokeCalendarConnection: vi.fn(async () => {})
        };

        const result = await purgeListing({
            ...adapter,
            clock,
            afterCommit,
            actor: {
                kind: 'support',
                adminId: admin.userId,
                ownerId: userId,
                reason: 'Owner requested account erasure'
            },
            vertical: VerticalEnum.GASTRONOMY,
            listingId: listing.id,
            correlationId
        });

        expect(result).toMatchObject({ purged: true, from: Status.MODERATED });
        const [event] = await db
            .select({
                actorType: domainEvent.actorType,
                actorId: domainEvent.actorId,
                reason: domainEvent.reason
            })
            .from(domainEvent)
            .where(eq(domainEvent.correlationId, correlationId));
        expect(event).toMatchObject({
            actorType: 'admin',
            actorId: admin.userId,
            reason: 'Owner requested account erasure'
        });
        const [notice] = await db
            .select({ template: emailOutbox.template, payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        expect(notice).toMatchObject({
            template: 'verticals.listing-purged',
            payload: { bySupport: true }
        });
        expect(notice?.template).not.toBe('verticals.listing-moderation-lifted');
    });

    it('TEST:V6:13 closes an open fix request and records its event', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const [request] = await db
            .insert(fixRequests)
            .values({
                entityType: VerticalEnum.ACCOMMODATION,
                entityId: listing.id,
                reason: 'Correct the listing details',
                openedById: userId
            })
            .returning({ id: fixRequests.id });
        const correlationId = randomUUID();
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const afterCommit: PurgeAfterCommit = {
            emitCoverageChanged: vi.fn(async () => {}),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {}),
            emitListingPurged: vi.fn(async () => {}),
            deleteRemoteMedia: vi.fn(async () => {}),
            revokeCalendarConnection: vi.fn(async () => {})
        };

        await purgeListing({
            ...adapter,
            clock,
            afterCommit,
            actor: { kind: 'owner', userId },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            correlationId
        });

        const [closed] = await db
            .select({ closedAt: fixRequests.closedAt, closedById: fixRequests.closedById })
            .from(fixRequests)
            .where(eq(fixRequests.id, request!.id));
        expect(closed).toMatchObject({ closedAt: at, closedById: null });
        const events = await db
            .select({ eventType: domainEvent.eventType, actorType: domainEvent.actorType })
            .from(domainEvent)
            .where(eq(domainEvent.correlationId, correlationId));
        expect(events).toContainEqual({
            eventType: 'listing.fix_request_closed',
            actorType: 'owner'
        });
        const notices = await db
            .select({ template: emailOutbox.template })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        expect(notices.map(({ template }) => template)).not.toContain(
            'verticals.listing-moderation-lifted'
        );
    });
});
