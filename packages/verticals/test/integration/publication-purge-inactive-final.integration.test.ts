// TEST:V9b:8 AC:V9b:8
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    domainEvent,
    emailOutbox,
    eq,
    listingContractModel,
    listingPublicationModel
} from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { createListingInverse } from '../../src/publication/listing-inverse';
import type {
    PublicationAfterCommit,
    PublicationVertical,
    PurgeAfterCommit
} from '../../src/publication/publication-types';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
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
const limits = { value: 2 };
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

function publicationAfterCommit(): PublicationAfterCommit {
    return {
        emitCoverageChanged: vi.fn(async () => {}),
        invalidateUser: vi.fn(async () => {}),
        revalidate: vi.fn(async () => {})
    };
}

function purgeAfterCommit(
    emitListingPurged: (event: { listingId: string }) => Promise<void>
): PurgeAfterCommit {
    return {
        ...publicationAfterCommit(),
        emitListingPurged: vi.fn(emitListingPurged),
        deleteRemoteMedia: vi.fn(async () => {}),
        revokeCalendarConnection: vi.fn(async () => {})
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
    afterCommit: PurgeAfterCommit;
}) {
    return {
        ...args.adapter,
        clock,
        afterCommit: args.afterCommit,
        vertical: args.vertical,
        listingId: args.listingId,
        ownerId: args.userId,
        correlationId: randomUUID(),
        // Pasa posterior para que coverageLostAt null no sea tratada como FIRST_PASS.
        previousPassStartedAt: new Date(at)
    };
}

describe.each([...verticals])('TEST:V9b:8 post-commit inverse %s', (vertical) => {
    it('pushes after commit, then the independent inverse read sees PURGED', async () => {
        const { userId, destinationId } = await fixtures.owner();
        ownersWithOutbox.add(userId);
        const listing = await archivedFixture(vertical, userId, destinationId);
        const inverse = createListingInverse({
            reader: {
                findListingsById: ({ listingId }) =>
                    listingContractModel.findListingsById({ listingId, tx: db })
            }
        });
        await expect(inverse.listingPurged({ listingId: listing.id })).resolves.toEqual({
            purged: false
        });
        const pushed: { listingId: string }[] = [];
        let stateAtPush: Status | undefined;
        let inverseAtPush: { purged: boolean } | undefined;
        const afterCommit = purgeAfterCommit(async (event) => {
            pushed.push(event);
            stateAtPush = await db.transaction(async (tx) => {
                await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
                await tx.execute(sql`SET LOCAL statement_timeout = '2s'`);
                return (
                    await listingPublicationModel.readListing({
                        tx,
                        vertical,
                        listingId: listing.id
                    })
                )?.publicationStatus;
            });
            inverseAtPush = await inverse.listingPurged({ listingId: listing.id });
        });
        const adapter = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        const result = await purgeInactiveListing(
            purgeArgs({ vertical, userId, listingId: listing.id, adapter, afterCommit })
        );
        expect(result).toMatchObject({ purged: true, warnings: [] });
        expect(afterCommit.emitListingPurged).toHaveBeenCalledTimes(1);
        expect(pushed).toEqual([{ listingId: listing.id }]);
        expect(stateAtPush).toBe(Status.PURGED);
        expect(inverseAtPush).toEqual({ purged: true });
        const second = await purgeInactiveListing(
            purgeArgs({ vertical, userId, listingId: listing.id, adapter, afterCommit })
        );
        expect(second).toEqual({ purged: false, reason: 'NOT_ARCHIVED' });
        expect(afterCommit.emitListingPurged).toHaveBeenCalledTimes(1);
    });
});

describe('TEST:V9b:8 failure, cap and source-state integration', () => {
    it('keeps PURGED after a failed billing push and reports its warning', async () => {
        const { userId, destinationId } = await fixtures.owner();
        ownersWithOutbox.add(userId);
        const listing = await archivedFixture(VerticalEnum.ACCOMMODATION, userId, destinationId);
        const afterCommit = purgeAfterCommit(async () => {
            throw new Error('billing unavailable');
        });
        const adapter = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        const result = await purgeInactiveListing(
            purgeArgs({
                vertical: VerticalEnum.ACCOMMODATION,
                userId,
                listingId: listing.id,
                adapter,
                afterCommit
            })
        );
        expect(result).toMatchObject({ purged: true, warnings: ['PURGE_NOTICE_FAILED'] });
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: listing.id
                })
            )?.publicationStatus
        ).toBe(Status.PURGED);
    });

    it('does not count the purged public-origin listing against PB3/PB7 capacity', async () => {
        const { userId, destinationId } = await fixtures.owner();
        ownersWithOutbox.add(userId);
        const archived = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const returning = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(at.getTime() - 300 * day)} WHERE id = ${archived.id}`
        );
        const prep = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        const archivedResult = await archiveInactiveListing({
            ...prep,
            clock,
            afterCommit: publicationAfterCommit(),
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: archived.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(archivedResult).toMatchObject({ archived: true, transition: 'PB4' });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(at.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(at.getTime() - day)} WHERE id = ${archived.id}`
        );
        const purgeAdapter = createPublicationTestAdapter({
            db,
            covered: noCoverage,
            limit: limits
        });
        const afterCommit = purgeAfterCommit(async () => {});
        expect(
            await purgeInactiveListing(
                purgeArgs({
                    vertical: VerticalEnum.ACCOMMODATION,
                    userId,
                    listingId: archived.id,
                    adapter: purgeAdapter,
                    afterCommit
                })
            )
        ).toMatchObject({ purged: true });
        const coverageAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        await recalculateCoverage({
            ...coverageAdapter,
            clock,
            afterCommit: publicationAfterCommit(),
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            correlationId: randomUUID()
        });
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: returning.id
                })
            )?.publicationStatus
        ).toBe(Status.PUBLISHED);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: archived.id
                })
            )?.publicationStatus
        ).toBe(Status.PURGED);
        expect(
            await listingPublicationModel.countPublished({
                tx: db,
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: userId
            })
        ).toBe(1);
        const events = await db
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, archived.id));
        expect(
            events.some(({ changes }) => changes.some((change) => change.old === Status.PURGED))
        ).toBe(false);
        await db.execute(
            sql`UPDATE accommodations SET publication_status = ${Status.UNPUBLISHED_BY_BILLING} WHERE id = ${returning.id}`
        );
    });

    it.each([
        Status.DRAFT,
        Status.PUBLISHED,
        Status.UNPUBLISHED_BY_BILLING,
        Status.MODERATED,
        Status.PURGED
    ] as const)('PB9 returns NOT_ARCHIVED and leaves every %s row field unchanged', async (status) => {
        const { userId, destinationId } = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(at.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(at.getTime() - day)} WHERE id = ${listing.id}`
        );
        const before = await db.execute(sql`SELECT * FROM accommodations WHERE id = ${listing.id}`);
        const eventsBefore = await db
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        const afterCommit = purgeAfterCommit(async () => {});
        const adapter = createPublicationTestAdapter({ db, covered: noCoverage, limit: limits });
        const result = await purgeInactiveListing(
            purgeArgs({
                vertical: VerticalEnum.ACCOMMODATION,
                userId,
                listingId: listing.id,
                adapter,
                afterCommit
            })
        );
        const after = await db.execute(sql`SELECT * FROM accommodations WHERE id = ${listing.id}`);
        expect(result).toEqual({ purged: false, reason: 'NOT_ARCHIVED' });
        expect(after.rows).toEqual(before.rows);
        expect(
            await db.select().from(domainEvent).where(eq(domainEvent.entityId, listing.id))
        ).toEqual(eventsBefore);
        expect(
            await db.select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId))
        ).toEqual([]);
        expect(afterCommit.emitListingPurged).not.toHaveBeenCalled();
        expect(afterCommit.deleteRemoteMedia).not.toHaveBeenCalled();
        expect(afterCommit.revokeCalendarConnection).not.toHaveBeenCalled();
    });
});
