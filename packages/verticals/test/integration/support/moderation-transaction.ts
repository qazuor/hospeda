import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, emailOutbox, eq, listingPublicationModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../../src/publication/archive-inactive-listing';
import { liftModeration } from '../../../src/publication/lift-moderation';
import { takeDownListing } from '../../../src/publication/moderate-listing';
import { createPublicationFixtureTracker } from './publication-fixtures';
import { createPublicationTestAdapter } from './publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
afterEach(async () => fixtures.cleanup());
const now = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const vertical = VerticalEnum.ACCOMMODATION;
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
afterAll(async () => pool.end());

describe('TEST:V6:11 PB13 queue and archived origins against PostgreSQL', () => {
    async function liftWithQuota(limit: number) {
        const { userId, destinationId } = await fixtures.owner();
        const admin = await fixtures.owner();
        const returning = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const other = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const otherClock = new Date('2026-07-01T12:00:00.000Z');
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${otherClock} WHERE id = ${other.id}`
        );
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: limit }
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: returning.id,
            reason: 'review',
            correlationId: randomUUID()
        });
        const correlationId = randomUUID();
        const result = await liftModeration({
            ...adapter,
            billing: { coverage: async () => ({ covered: true, sources: [] }) },
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: returning.id,
            reason: 'review cleared',
            correlationId,
            keepFixRequest: false
        });
        const notices = await db
            .select({ template: emailOutbox.template, payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        const otherEvents = await db
            .select({ id: domainEvent.id })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.entityId, other.id),
                    eq(domainEvent.correlationId, correlationId)
                )
            );
        const otherAfter = await listingPublicationModel.readListing({
            tx: db,
            vertical,
            listingId: other.id
        });
        const otherInactive = await db.execute(
            sql`SELECT inactive_since FROM accommodations WHERE id = ${other.id}`
        );
        return {
            result,
            notices,
            otherEvents,
            otherStatus: otherAfter?.publicationStatus,
            otherInactiveSince: new Date(String(otherInactive.rows[0]?.inactive_since)),
            otherClock
        };
    }

    it('TEST:V6:11 PB13 with a full quota leaves the lifted listing unpublished and touches no other listing (HOS-1997)', async () => {
        const out = await liftWithQuota(1);
        expect(out.result).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.UNPUBLISHED_BY_BILLING,
            lowered: []
        });
        expect(out.otherStatus).toBe(Status.PUBLISHED);
        expect(out.otherEvents).toEqual([]);
        expect(out.otherInactiveSince).toEqual(out.otherClock);
        expect(out.notices).toHaveLength(1);
        expect(out.notices[0]).toMatchObject({
            template: 'verticals.listing-moderation-lifted',
            payload: { returnedTo: Status.UNPUBLISHED_BY_BILLING, quotaFull: true }
        });
    });

    it('TEST:V6:11 PB13 with a free slot publishes the lifted listing with the normal notice (HOS-1997)', async () => {
        const out = await liftWithQuota(2);
        expect(out.result).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.PUBLISHED,
            lowered: []
        });
        expect(out.otherStatus).toBe(Status.PUBLISHED);
        expect(out.otherInactiveSince).toEqual(out.otherClock);
        expect(out.notices[0]?.payload).toMatchObject({ returnedTo: Status.PUBLISHED });
        expect(out.notices[0]?.payload).not.toHaveProperty('quotaFull');
    });

    it('TEST:V6:11 lifts ARCHIVED listings by the PB5 and PB4 origins', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const admin = await fixtures.owner();
        const draftArchive = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const publishedArchive = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const archiveAdapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 }
        });
        for (const listing of [draftArchive, publishedArchive]) {
            await db.execute(
                sql`UPDATE accommodations SET inactive_since = ${new Date('2026-01-01T00:00:00.000Z')} WHERE id = ${listing.id}`
            );
            const result = await archiveInactiveListing({
                ...archiveAdapter,
                afterCommit,
                clock,
                vertical,
                listingId: listing.id,
                ownerId: userId,
                correlationId: randomUUID()
            });
            expect(result.archived).toBe(true);
            const moderationAdapter = createPublicationTestAdapter({
                db,
                covered: { value: true },
                limit: { value: 2 }
            });
            expect(
                (
                    await takeDownListing({
                        ...moderationAdapter,
                        clock,
                        afterCommit,
                        adminId: admin.userId,
                        ownerId: userId,
                        vertical,
                        listingId: listing.id,
                        reason: 'review',
                        correlationId: randomUUID()
                    })
                ).ok
            ).toBe(true);
        }
        const liftAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 2 }
        });
        const billing = { coverage: async () => ({ covered: true, sources: [] }) };
        const pb11 = await liftModeration({
            ...liftAdapter,
            billing,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: draftArchive.id,
            reason: 'cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        const pb13 = await liftModeration({
            ...liftAdapter,
            billing,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: publishedArchive.id,
            reason: 'cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        expect(pb11).toMatchObject({
            ok: true,
            transition: 'PB11',
            publicationStatus: Status.DRAFT
        });
        expect(pb13).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.PUBLISHED
        });
    });

    it('TEST:V6:11 lifts a covered UNPUBLISHED_BY_BILLING origin through PB13', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const admin = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'review',
            correlationId: randomUUID()
        });
        const result = await liftModeration({
            ...adapter,
            billing: { coverage: async () => ({ covered: true, sources: [] }) },
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        expect(result).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.PUBLISHED
        });
    });
});
