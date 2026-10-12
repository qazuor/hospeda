import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, eq, listingPublicationModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { liftModeration } from '../../src/publication/lift-moderation';
import { takeDownListing } from '../../src/publication/moderate-listing';
import type { PurgeAfterCommit } from '../../src/publication/publication-types';
import { purgeListing } from '../../src/publication/purge-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
afterEach(async () => fixtures.cleanup());
const vertical = VerticalEnum.ACCOMMODATION;
const clock = { now: () => new Date('2026-10-12T12:00:00.000Z') };
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
const purgeAfterCommit: PurgeAfterCommit = {
    ...afterCommit,
    emitListingPurged: vi.fn(async () => {}),
    deleteRemoteMedia: vi.fn(async () => {}),
    revokeCalendarConnection: vi.fn(async () => {})
};
afterAll(async () => pool.end());

function gate() {
    let release: () => void = () => {};
    let acquired: () => void = () => {};
    return {
        wait: new Promise<void>((resolve) => {
            release = resolve;
        }),
        locked: new Promise<void>((resolve) => {
            acquired = resolve;
        }),
        release: () => release(),
        acquired: () => acquired()
    };
}

describe('TEST:V6:3 PB12 lock pairs', () => {
    it('TEST:V6:3 serializes PB12 with PB3 and rereads after the shared owner lock', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        const barrier = gate();
        let pb3Acquired = false;
        const ownerAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                barrier.acquired();
                await barrier.wait;
            }
        });
        const jobAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                pb3Acquired = true;
            }
        });
        const pb12 = purgeListing({
            ...ownerAdapter,
            clock,
            afterCommit: purgeAfterCommit,
            actor: { kind: 'owner', userId },
            vertical,
            listingId: listing.id,
            correlationId: randomUUID()
        });
        await barrier.locked;
        const pb3 = recalculateCoverage({
            ...jobAdapter,
            billing: jobAdapter.billing,
            clock,
            afterCommit,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb3Acquired).toBe(false);
        barrier.release();
        await Promise.all([pb12, pb3]);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(Status.PURGED);
        const events = await db
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        const publishedAfterPurge = events.some(({ changes }) =>
            changes.some(
                (change) =>
                    change.field === 'publicationStatus' &&
                    change.old === Status.PURGED &&
                    change.new === Status.PUBLISHED
            )
        );
        expect(publishedAfterPurge).toBe(false);
    });

    it('TEST:V6:3 lets PB3 win first and PB12 reread PUBLISHED under the same lock', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        const barrier = gate();
        let pb12Acquired = false;
        const pb3Adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                barrier.acquired();
                await barrier.wait;
            }
        });
        const pb12Adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                pb12Acquired = true;
            }
        });
        const pb3 = recalculateCoverage({
            ...pb3Adapter,
            billing: pb3Adapter.billing,
            clock,
            afterCommit,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        await barrier.locked;
        const pb12 = purgeListing({
            ...pb12Adapter,
            clock,
            afterCommit: purgeAfterCommit,
            actor: { kind: 'owner', userId },
            vertical,
            listingId: listing.id,
            correlationId: randomUUID()
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb12Acquired).toBe(false);
        barrier.release();
        const [, result] = await Promise.all([pb3, pb12]);
        expect(result).toMatchObject({ purged: true, from: Status.PUBLISHED });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(Status.PURGED);
    });

    it('TEST:V6:3 serializes PB11 with PB12 on MODERATED and never lifts after PURGED', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const admin = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const prep = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        await takeDownListing({
            ...prep,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'review',
            correlationId: randomUUID()
        });
        const barrier = gate();
        let pb11Acquired = false;
        const purgeAdapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 },
            onLocked: async () => {
                barrier.acquired();
                await barrier.wait;
            }
        });
        const liftAdapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 },
            onLocked: async () => {
                pb11Acquired = true;
            }
        });
        const pb12 = purgeListing({
            ...purgeAdapter,
            clock,
            afterCommit: purgeAfterCommit,
            actor: { kind: 'owner', userId },
            vertical,
            listingId: listing.id,
            correlationId: randomUUID()
        });
        await barrier.locked;
        const pb11 = liftModeration({
            ...liftAdapter,
            billing: liftAdapter.billing,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'reviewed',
            correlationId: randomUUID(),
            keepFixRequest: true
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb11Acquired).toBe(false);
        barrier.release();
        await Promise.all([pb12, pb11]);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(Status.PURGED);
        const events = await db
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        const liftedToDraft = events.filter(({ changes }) =>
            changes.some(
                (change) =>
                    change.field === 'publicationStatus' &&
                    change.old === Status.MODERATED &&
                    change.new === Status.DRAFT
            )
        );
        expect(liftedToDraft).toHaveLength(0);
    });
});
