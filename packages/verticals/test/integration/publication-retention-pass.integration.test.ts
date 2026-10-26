// TEST:V9b:10 AC:V9b:10 · TEST:V9b:13 AC:V9b:14 — runner against test-owned listings and real populations.
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { emailOutbox, eq } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listingRetentionScheduleModel } from '../../../db/src/models/listing/listing-retention-schedule.model';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { LISTING_ARCHIVED_TEMPLATE } from '../../src/publication/archive-notices';
import {
    LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
    LISTING_RETENTION_BEFORE_DELETION_TEMPLATE
} from '../../src/publication/retention-notices';
import { runRetentionPass } from '../../src/publication/retention-pass-run';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

type TestVertical =
    | typeof VerticalEnum.ACCOMMODATION
    | typeof VerticalEnum.VENUE
    | typeof VerticalEnum.EXPERIENCE;
const vertical = VerticalEnum.ACCOMMODATION;
const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 4 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const ownedOutbox = new Set<string>();
const DAY = 86_400_000;
const tables: Readonly<Record<TestVertical, string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};
const afterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {},
    revalidate: async () => {},
    emitListingPurged: async () => {},
    deleteRemoteMedia: async () => {},
    revokeCalendarConnection: async () => {}
};

afterEach(async () => {
    for (const ownerId of ownedOutbox)
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    ownedOutbox.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

async function fixture(args: {
    status: Status;
    inactiveSince: Date;
    vertical?: TestVertical;
    deletionAnnouncedAt?: Date | null;
}) {
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical: args.vertical ?? vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status: args.status
    });
    const actualVertical = args.vertical ?? vertical;
    await db.execute(
        sql`UPDATE ${sql.identifier(tables[actualVertical])} SET publication_status = ${args.status}, inactive_since = ${args.inactiveSince}, deadlines_version = 1, deletion_announced_at = ${args.deletionAnnouncedAt ?? null} WHERE id = ${listing.id}`
    );
    ownedOutbox.add(owner.userId);
    return { ...owner, listing, vertical: actualVertical };
}

function adapter(
    covered = false,
    retention?: { stopped: boolean; pauseEndedAt: Date | null; coverageLostAt?: Date | null }
) {
    return createPublicationTestAdapter({
        db,
        covered: { value: covered },
        limit: { value: 2 },
        retention
    });
}

function pass(args: {
    now: Date;
    mine: Set<string>;
    previousPassStartedAt?: Date | null;
    covered?: boolean;
    retention?: { stopped: boolean; pauseEndedAt: Date | null; coverageLostAt?: Date | null };
}) {
    const ports = adapter(args.covered, args.retention);
    return runRetentionPass({
        ports: {
            ...ports,
            clock: { now: () => args.now },
            afterCommit,
            previousPassStartedAt: args.previousPassStartedAt ?? null,
            population: {
                listNoticeDue: async (input) => {
                    const page = await listingRetentionScheduleModel.listRetentionNoticeCandidates({
                        ...input,
                        tx: db
                    });
                    return {
                        ...page,
                        items: page.items.filter((item) => args.mine.has(item.listingId))
                    };
                },
                listPurgeDue: async (input) => {
                    const page = await listingRetentionScheduleModel.listPurgeCandidates({
                        ...input,
                        tx: db
                    });
                    return {
                        ...page,
                        items: page.items.filter((item) => args.mine.has(item.listingId))
                    };
                }
            }
        }
    });
}

async function rows(ownerId: string) {
    return db.select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
}

async function rowState(id: string) {
    const result = await db.execute(sql`SELECT * FROM accommodations WHERE id = ${id}`);
    return result.rows[0];
}

describe('TEST:V9b:10 AC:V9b:10 · TEST:V9b:13 AC:V9b:14 retention pass integration', () => {
    it('sends both prior notices around PB4, with only PB4/PB5 owning the archive notice and no duplicates', async () => {
        const inactiveSince = new Date('2026-01-01T12:00:00.000Z');
        const f = await fixture({ status: Status.UNPUBLISHED_BY_BILLING, inactiveSince });
        const mine = new Set([f.listing.id]);
        const archiveNoticeAt = new Date(inactiveSince.getTime() + 75 * DAY);
        expect((await pass({ now: archiveNoticeAt, mine })).notices).toMatchObject({
            sent: 1,
            enqueued: 1
        });
        const archiveAt = new Date(inactiveSince.getTime() + 90 * DAY);
        const archiver = adapter();
        expect(
            await archiveInactiveListing({
                ...archiver,
                afterCommit,
                vertical,
                listingId: f.listing.id,
                ownerId: f.userId,
                clock: { now: () => archiveAt },
                correlationId: randomUUID()
            })
        ).toMatchObject({ archived: true, transition: 'PB4' });
        await pass({ now: archiveAt, mine });
        let outbox = await rows(f.userId);
        expect(outbox.filter((item) => item.template === LISTING_ARCHIVED_TEMPLATE)).toHaveLength(
            1
        );
        expect(
            outbox.filter((item) => item.template === LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE)
        ).toHaveLength(1);
        const deletionNoticeAt = new Date(archiveAt.getTime() + 165 * DAY);
        await pass({ now: deletionNoticeAt, mine, previousPassStartedAt: archiveNoticeAt });
        await pass({ now: deletionNoticeAt, mine, previousPassStartedAt: deletionNoticeAt });
        outbox = await rows(f.userId);
        expect(
            outbox.filter((item) => item.template === LISTING_RETENTION_BEFORE_DELETION_TEMPLATE)
        ).toHaveLength(1);
        expect(outbox).toHaveLength(3);
    });

    it('uses a new schedule key after coverage returns and archive flow resets the clock', async () => {
        const inactiveSince = new Date('2026-01-01T12:00:00.000Z');
        const prior = await fixture({ status: Status.UNPUBLISHED_BY_BILLING, inactiveSince });
        const priorNoticeAt = new Date(inactiveSince.getTime() + 75 * DAY);
        await pass({ now: priorNoticeAt, mine: new Set([prior.listing.id]) });

        const listing = await fixtures.listing({
            vertical,
            userId: prior.userId,
            destinationId: prior.destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${inactiveSince}, deadlines_version = 1 WHERE id = ${listing.id}`
        );
        const mine = new Set([listing.id]);
        await pass({ now: priorNoticeAt, mine });
        const resetAt = new Date(inactiveSince.getTime() + 90 * DAY);
        const coveredArchive = await archiveInactiveListing({
            ...adapter(true),
            afterCommit,
            vertical,
            listingId: listing.id,
            ownerId: prior.userId,
            clock: { now: () => resetAt },
            correlationId: randomUUID()
        });
        expect(coveredArchive).toEqual({ archived: false, reason: 'COVERED' });
        const secondNoticeAt = new Date(resetAt.getTime() + 75 * DAY);
        await pass({ now: secondNoticeAt, mine });
        const notices = (await rows(prior.userId)).filter(
            (item) =>
                item.template === LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE &&
                item.dedupKey.includes(`listing:${listing.id}:`)
        );
        expect(notices).toHaveLength(2);
        expect(new Set(notices.map((item) => item.dedupKey)).size).toBe(2);
    });

    it('requires the next PB9 pass for missing coverage-loss time and respects retention pause', async () => {
        const dueAt = new Date('2026-01-01T12:00:00.000Z');
        const f = await fixture({
            status: Status.ARCHIVED,
            inactiveSince: new Date(dueAt.getTime() - 180 * DAY),
            deletionAnnouncedAt: dueAt
        });
        const mine = new Set([f.listing.id]);
        const firstStartedAt = new Date(dueAt.getTime() - 1);
        const first = await pass({
            now: dueAt,
            mine,
            previousPassStartedAt: firstStartedAt,
            retention: { stopped: false, pauseEndedAt: null, coverageLostAt: null }
        });
        expect(first.purgeSkipped).toEqual({ FIRST_PASS: 1 });
        const second = await pass({
            now: new Date(dueAt.getTime() + 1),
            mine,
            previousPassStartedAt: dueAt,
            retention: { stopped: false, pauseEndedAt: null, coverageLostAt: null }
        });
        expect(second.purged).toBe(1);
        const paused = await fixture({
            status: Status.ARCHIVED,
            inactiveSince: new Date(dueAt.getTime() - 300 * DAY),
            deletionAnnouncedAt: dueAt
        });
        const pausedResult = await pass({
            now: dueAt,
            mine: new Set([paused.listing.id]),
            previousPassStartedAt: dueAt,
            retention: { stopped: true, pauseEndedAt: null }
        });
        expect(pausedResult.purged).toBe(0);
        expect(pausedResult.purgeSkipped).toEqual({ RETENTION_STOPPED: 1 });
        expect(await rows(paused.userId)).toEqual([]);
    });

    it('does not inspect terminal statuses or mutate their rows', async () => {
        const moderated = await fixture({
            status: Status.MODERATED,
            inactiveSince: new Date('2025-01-01T00:00:00Z')
        });
        const purged = await fixture({
            status: Status.PURGED,
            inactiveSince: new Date('2025-01-01T00:00:00Z')
        });
        const beforeModerated = await rowState(moderated.listing.id);
        const beforePurged = await rowState(purged.listing.id);
        const result = await pass({
            now: new Date('2026-10-17T12:00:00Z'),
            mine: new Set([moderated.listing.id, purged.listing.id]),
            previousPassStartedAt: null
        });
        expect(result.read).toEqual({ notices: 0, purges: 0 });
        expect(await rowState(moderated.listing.id)).toEqual(beforeModerated);
        expect(await rowState(purged.listing.id)).toEqual(beforePurged);
        expect(await rows(moderated.userId)).toEqual([]);
        expect(await rows(purged.userId)).toEqual([]);
    });
});
