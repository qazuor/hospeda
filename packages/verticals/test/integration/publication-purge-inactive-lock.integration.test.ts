// TEST:V9b:5 AC:V9b:5
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, emailOutbox, eq, listingPublicationModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type {
    PublicationVertical,
    PurgeAfterCommit
} from '../../src/publication/publication-types';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { reactivateListing } from '../../src/publication/reactivate-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 12 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const ownersWithOutbox = new Set<string>();
afterEach(async () => {
    for (const ownerId of ownersWithOutbox)
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    ownersWithOutbox.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

const day = 86_400_000;
const at = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => new Date(at) };
const noCoverage = { value: false };
const limits = { value: 20 };
const noopAfterCommit: PurgeAfterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {}),
    emitListingPurged: vi.fn(async () => {}),
    deleteRemoteMedia: vi.fn(async () => {}),
    revokeCalendarConnection: vi.fn(async () => {})
};
const noopPublicationAfterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
const verticals: readonly PublicationVertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
];
const tableByVertical: Record<PublicationVertical, string> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};

function gate() {
    let release: () => void = () => {};
    let acquired: () => void = () => {};
    return {
        wait: new Promise<void>((resolve) => (release = resolve)),
        locked: new Promise<void>((resolve) => (acquired = resolve)),
        release: () => release(),
        acquired: () => acquired()
    };
}

async function archivedFixture(
    vertical: PublicationVertical,
    userId: string,
    destinationId: string
) {
    const listing = await fixtures.listing({
        vertical,
        userId,
        destinationId,
        status: Status.ARCHIVED
    });
    await db.execute(sql`UPDATE ${sql.raw(tableByVertical[vertical])}
        SET inactive_since = ${new Date(at.getTime() - 300 * day)}, deadlines_version = 1,
            deletion_announced_at = ${new Date(at.getTime() - day)},
            description = ${`private content ${listing.id}`}, summary = ${`private summary ${listing.id}`}
        WHERE id = ${listing.id}`);
    return listing;
}

function purgeArgs(args: {
    vertical: PublicationVertical;
    userId: string;
    listingId: string;
    adapter: ReturnType<typeof createPublicationTestAdapter>;
    afterCommit?: PurgeAfterCommit;
}) {
    return {
        ...args.adapter,
        clock,
        afterCommit: args.afterCommit ?? noopAfterCommit,
        vertical: args.vertical,
        listingId: args.listingId,
        ownerId: args.userId,
        correlationId: randomUUID(),
        // Fuerza una pasada posterior; una pérdida de cobertura nula no debe activar FIRST_PASS aquí.
        previousPassStartedAt: new Date(at)
    };
}

function reactivateArgs(vertical: PublicationVertical, userId: string, listingId: string) {
    return {
        unitOfWork: createPublicationTestAdapter({ db, covered: noCoverage, limit: limits })
            .unitOfWork,
        clock,
        afterCommit: noopPublicationAfterCommit,
        userId,
        vertical,
        listingId,
        correlationId: randomUUID()
    };
}

describe('TEST:V9b:5 PB9/PB8 owner lock integration', () => {
    it('lets PB9 acquire first and PB8 rereads PURGED under the lock', async () => {
        const { userId, destinationId } = await fixtures.owner();
        ownersWithOutbox.add(userId);
        const listing = await archivedFixture(VerticalEnum.ACCOMMODATION, userId, destinationId);
        const barrier = gate();
        let pb8Acquired = false;
        const pb9Adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            onLocked: async () => {
                barrier.acquired();
                await barrier.wait;
            }
        });
        const pb8Adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            onLocked: async () => {
                pb8Acquired = true;
            }
        });
        const pb9 = purgeInactiveListing(
            purgeArgs({
                vertical: VerticalEnum.ACCOMMODATION,
                userId,
                listingId: listing.id,
                adapter: pb9Adapter
            })
        );
        await barrier.locked;
        const pb8 = reactivateListing({
            ...reactivateArgs(VerticalEnum.ACCOMMODATION, userId, listing.id),
            unitOfWork: pb8Adapter.unitOfWork
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb8Acquired).toBe(false);
        barrier.release();
        const [purgeResult, reactivateResult] = await Promise.all([pb9, pb8]);
        expect(purgeResult).toMatchObject({ purged: true });
        expect(reactivateResult).toEqual({ reactivated: false, reason: 'INVALID_FROM' });
        const row = await listingPublicationModel.readListing({
            tx: db,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id
        });
        expect(row?.publicationStatus).toBe(Status.PURGED);
        expect(
            (await db.execute(sql`SELECT description FROM accommodations WHERE id = ${listing.id}`))
                .rows[0]?.description
        ).toBe('');
        const events = await db
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        expect(
            events.some(({ changes }) => changes.some((change) => change.old === Status.PURGED))
        ).toBe(false);
    });

    it('lets PB8 acquire first and PB9 rereads DRAFT under the lock', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await archivedFixture(VerticalEnum.ACCOMMODATION, userId, destinationId);
        const originalDescription = `private content ${listing.id}`;
        const originalSummary = `private summary ${listing.id}`;
        const barrier = gate();
        let pb9Acquired = false;
        const pb8Adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            onLocked: async () => {
                barrier.acquired();
                await barrier.wait;
            }
        });
        const pb9Adapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits,
            onLocked: async () => {
                pb9Acquired = true;
            }
        });
        const retentionEffects: PurgeAfterCommit = {
            ...noopAfterCommit,
            emitListingPurged: vi.fn(async () => {})
        };
        const pb8 = reactivateListing({
            ...reactivateArgs(VerticalEnum.ACCOMMODATION, userId, listing.id),
            unitOfWork: pb8Adapter.unitOfWork
        });
        await barrier.locked;
        const pb9 = purgeInactiveListing(
            purgeArgs({
                vertical: VerticalEnum.ACCOMMODATION,
                userId,
                listingId: listing.id,
                adapter: pb9Adapter,
                afterCommit: retentionEffects
            })
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb9Acquired).toBe(false);
        barrier.release();
        const [reactivateResult, purgeResult] = await Promise.all([pb8, pb9]);
        expect(reactivateResult).toEqual({ reactivated: true });
        expect(purgeResult).toEqual({ purged: false, reason: 'NOT_ARCHIVED' });
        const row = await listingPublicationModel.readListing({
            tx: db,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id
        });
        expect(row?.publicationStatus).toBe(Status.DRAFT);
        expect(row?.inactiveSince).toEqual(at);
        const details = await db.execute(
            sql`SELECT description, summary FROM accommodations WHERE id = ${listing.id}`
        );
        expect(details.rows[0]).toEqual({
            description: originalDescription,
            summary: originalSummary
        });
        expect(retentionEffects.emitListingPurged).not.toHaveBeenCalled();
        expect(
            await db.execute(
                sql`SELECT id FROM accommodation_media WHERE accommodation_id = ${listing.id} AND remote_deletion_pending_at IS NOT NULL`
            )
        ).toMatchObject({ rows: [] });
        expect(
            await db.execute(
                sql`SELECT id FROM accommodation_calendar_sync WHERE accommodation_id = ${listing.id} AND remote_deletion_pending_at IS NOT NULL`
            )
        ).toMatchObject({ rows: [] });
    });
});

describe.each([...verticals])('TEST:V9b:5 concurrent pair %s', (vertical) => {
    it('never commits DRAFT with blank content when four PB9/PB8 pairs race', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const listings = await Promise.all(
            Array.from({ length: 4 }, () => archivedFixture(vertical, userId, destinationId))
        );
        const adapters = listings.map(() =>
            createPublicationTestAdapter({ db, covered: noCoverage, limit: limits })
        );
        const results = await Promise.all(
            listings.flatMap((listing, index) => [
                purgeInactiveListing(
                    purgeArgs({
                        vertical,
                        userId,
                        listingId: listing.id,
                        adapter: adapters[index]!
                    })
                ),
                reactivateListing({
                    ...reactivateArgs(vertical, userId, listing.id),
                    unitOfWork: adapters[index]!.unitOfWork
                })
            ])
        );
        for (let index = 0; index < listings.length; index += 1) {
            const listing = listings[index]!;
            const purgeResult = results[index * 2];
            const reactivateResult = results[index * 2 + 1];
            const purged = purgeResult && 'purged' in purgeResult && purgeResult.purged;
            const reactivated =
                reactivateResult &&
                'reactivated' in reactivateResult &&
                reactivateResult.reactivated;
            expect(Boolean(purged) !== Boolean(reactivated)).toBe(true);
            const row = (
                await db.execute(
                    sql`SELECT publication_status, description FROM ${sql.raw(tableByVertical[vertical])} WHERE id = ${listing.id}`
                )
            ).rows[0];
            expect(!(row?.publication_status === Status.DRAFT && row.description === '')).toBe(
                true
            );
            if (purged) {
                expect(row).toMatchObject({ publication_status: Status.PURGED, description: '' });
            } else {
                expect(row).toMatchObject({
                    publication_status: Status.DRAFT,
                    description: `private content ${listing.id}`
                });
            }
        }
    });
});
