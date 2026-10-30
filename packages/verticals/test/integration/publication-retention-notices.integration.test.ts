// TEST:V9b:10 AC:V9b:10 — one-listing notice decision with the real outbox.
import { randomUUID } from 'node:crypto';
import type { DrizzleClient, EmailOutboxRow } from '@repo/db';
import { domainEvent, emailOutbox, eq } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
    LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
    retentionNoticeAt,
    retentionNoticeTargetDay
} from '../../src/publication/retention-notices';
import { sendRetentionNotice } from '../../src/publication/send-retention-notice';
import {
    expectDeadlineSourcesUnchanged,
    snapshotDeadlineSources
} from './support/deadline-readonly';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

type TestVertical =
    | typeof VerticalEnum.ACCOMMODATION
    | typeof VerticalEnum.VENUE
    | typeof VerticalEnum.EXPERIENCE;

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 4 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const ownersWithOutbox = new Set<string>();
const day = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');
const noCoverage = { value: false };
const limits = { value: 2 };
const tableOf = (vertical: TestVertical) =>
    vertical === VerticalEnum.VENUE ? 'venues' : `${vertical}s`;

afterEach(async () => {
    for (const ownerId of ownersWithOutbox)
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    ownersWithOutbox.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

async function fixture(args: {
    readonly vertical?: TestVertical;
    readonly status: Status;
    readonly inactiveSince: Date;
    readonly deletionAnnouncedAt?: Date | null;
}) {
    const vertical = args.vertical ?? VerticalEnum.ACCOMMODATION;
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status: args.status
    });
    await db.execute(
        sql`UPDATE ${sql.raw(tableOf(vertical))} SET inactive_since = ${args.inactiveSince}, deadlines_version = 1, deletion_announced_at = ${args.deletionAnnouncedAt ?? null} WHERE id = ${listing.id}`
    );
    ownersWithOutbox.add(owner.userId);
    return { ...owner, listing, vertical };
}

function decide(args: {
    readonly userId: string;
    readonly listingId: string;
    readonly vertical: TestVertical;
    readonly covered?: { value: boolean };
    readonly retention?: { readonly stopped: boolean; readonly pauseEndedAt: Date | null };
    readonly at?: Date;
}) {
    const adapter = createPublicationTestAdapter({
        db,
        covered: args.covered ?? noCoverage,
        limit: limits,
        retention: args.retention
    });
    return sendRetentionNotice({
        ...adapter,
        clock: { now: () => args.at ?? now },
        vertical: args.vertical,
        listingId: args.listingId,
        ownerId: args.userId,
        correlationId: randomUUID()
    });
}

async function rows(ownerId: string, template: string): Promise<EmailOutboxRow[]> {
    return db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, ownerId))
        .then((items) => items.filter((item) => item.template === template));
}

describe('TEST:V9b:10 AC:V9b:10 retention notices integration', () => {
    it('enqueues a schedule occurrence keyed by archive action day, deduplicates, and sends again after a clock reset', async () => {
        const inactiveSince = new Date(now.getTime() - 110 * day);
        const f = await fixture({ status: Status.UNPUBLISHED_BY_BILLING, inactiveSince });
        const before = await snapshotDeadlineSources({
            db,
            listings: [{ vertical: f.vertical, listingId: f.listing.id }]
        });
        const targetAt = new Date(inactiveSince.getTime() + 90 * day);
        const first = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical
        });
        expect(first).toMatchObject({
            sent: true,
            notice: 'BEFORE_ARCHIVE',
            targetAt,
            enqueued: true
        });
        const outbox = await rows(f.userId, LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE);
        expect(outbox).toHaveLength(1);
        expect(outbox[0]?.dedupKey).toContain(
            `listing:${f.listing.id}:ret:-90d:${retentionNoticeTargetDay({ at: targetAt })}`
        );
        expect(outbox[0]?.recipientEmail).toMatch(/^publication-.*@example\.com$/);
        expect(outbox[0]?.payload).toEqual({
            vertical: f.vertical,
            listingId: f.listing.id,
            transition: 'PB4',
            archiveAt: targetAt.toISOString()
        });
        const second = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical
        });
        expect(second).toMatchObject({ sent: true, enqueued: false });
        const nextDay = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical,
            at: new Date(now.getTime() + day)
        });
        expect(nextDay).toMatchObject({ sent: true, enqueued: false });
        expect(await rows(f.userId, LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE)).toHaveLength(1);
        const afterNotice = await snapshotDeadlineSources({
            db,
            listings: [{ vertical: f.vertical, listingId: f.listing.id }]
        });
        expectDeadlineSourcesUnchanged({ before, after: afterNotice });

        const reset = new Date(inactiveSince.getTime() + 30 * day);
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${reset} WHERE id = ${f.listing.id}`
        );
        const resetTarget = new Date(reset.getTime() + 90 * day);
        const resetAt = retentionNoticeAt({ targetAt: resetTarget, daysBefore: 15 });
        const third = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical,
            at: resetAt
        });
        expect(third).toMatchObject({ sent: true, enqueued: true, targetAt: resetTarget });
        const keys = (await rows(f.userId, LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE)).map(
            (item) => item.dedupKey
        );
        expect(keys).toHaveLength(2);
        expect(new Set(keys).size).toBe(2);
    });

    it('waits until the announced deletion date, then keys and payloads that action date', async () => {
        const deletionAt = new Date(now.getTime() + 200 * day);
        const f = await fixture({
            status: Status.ARCHIVED,
            inactiveSince: new Date(now.getTime() - 300 * day),
            deletionAnnouncedAt: deletionAt
        });
        const before = await snapshotDeadlineSources({
            db,
            listings: [{ vertical: f.vertical, listingId: f.listing.id }]
        });
        const noticeAt = retentionNoticeAt({ targetAt: deletionAt, daysBefore: 15 });
        expect(
            await decide({
                userId: f.userId,
                listingId: f.listing.id,
                vertical: f.vertical,
                at: new Date(noticeAt.getTime() - 1)
            })
        ).toEqual({ sent: false, reason: 'NOT_DUE' });
        const result = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical,
            at: noticeAt
        });
        expect(result).toMatchObject({
            sent: true,
            notice: 'BEFORE_DELETION',
            targetAt: deletionAt,
            enqueued: true
        });
        const outbox = await rows(f.userId, LISTING_RETENTION_BEFORE_DELETION_TEMPLATE);
        expect(outbox).toHaveLength(1);
        expect(outbox[0]?.dedupKey).toContain(
            `listing:${f.listing.id}:ret:-180d:${retentionNoticeTargetDay({ at: deletionAt })}`
        );
        expect(outbox[0]?.payload).toEqual({
            vertical: f.vertical,
            listingId: f.listing.id,
            deletionAt: deletionAt.toISOString()
        });
        expectDeadlineSourcesUnchanged({
            before,
            after: await snapshotDeadlineSources({
                db,
                listings: [{ vertical: f.vertical, listingId: f.listing.id }]
            })
        });
    });

    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)('uses the payload vertical %s', async (vertical) => {
        const f = await fixture({
            vertical,
            status: Status.ARCHIVED,
            inactiveSince: new Date(now.getTime() - 300 * day)
        });
        const result = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical
        });
        expect(result).toMatchObject({ sent: true, notice: 'BEFORE_DELETION' });
        const outbox = await rows(f.userId, LISTING_RETENTION_BEFORE_DELETION_TEMPLATE);
        expect(outbox).toHaveLength(1);
        expect(outbox[0]?.payload).toMatchObject({ vertical, listingId: f.listing.id });
    });

    it('does not enqueue on moderated, purged, paused, or covered rows and leaves the complete listing row unchanged', async () => {
        for (const status of [Status.MODERATED, Status.PURGED]) {
            const f = await fixture({ status, inactiveSince: new Date(now.getTime() - 300 * day) });
            const table = tableOf(f.vertical);
            const before = await db.execute(
                sql`SELECT * FROM ${sql.raw(table)} WHERE id = ${f.listing.id}`
            );
            expect(
                await decide({ userId: f.userId, listingId: f.listing.id, vertical: f.vertical })
            ).toMatchObject({ sent: false, reason: 'NO_NOTICE_FOR_STATUS' });
            const after = await db.execute(
                sql`SELECT * FROM ${sql.raw(table)} WHERE id = ${f.listing.id}`
            );
            expect(after.rows).toEqual(before.rows);
            expect(await rows(f.userId, LISTING_RETENTION_BEFORE_DELETION_TEMPLATE)).toEqual([]);
        }
        const paused = await fixture({
            status: Status.ARCHIVED,
            inactiveSince: new Date(now.getTime() - 300 * day)
        });
        expect(
            await decide({
                userId: paused.userId,
                listingId: paused.listing.id,
                vertical: paused.vertical,
                retention: { stopped: true, pauseEndedAt: null }
            })
        ).toMatchObject({ sent: false, reason: 'RETENTION_STOPPED' });
        const covered = await fixture({
            status: Status.ARCHIVED,
            inactiveSince: new Date(now.getTime() - 300 * day)
        });
        const table = tableOf(covered.vertical);
        const before = await db.execute(
            sql`SELECT * FROM ${sql.raw(table)} WHERE id = ${covered.listing.id}`
        );
        expect(
            await decide({
                userId: covered.userId,
                listingId: covered.listing.id,
                vertical: covered.vertical,
                covered: { value: true }
            })
        ).toMatchObject({ sent: false, reason: 'COVERED' });
        const after = await db.execute(
            sql`SELECT * FROM ${sql.raw(table)} WHERE id = ${covered.listing.id}`
        );
        expect(after.rows).toEqual(before.rows);
        expect(await rows(covered.userId, LISTING_RETENTION_BEFORE_DELETION_TEMPLATE)).toEqual([]);
    });

    it('TEST:1694:5 AC:1694:2 owner edits move both the archive notice and the deletion notice', async () => {
        const inactiveSince = new Date(now.getTime() - 110 * day);
        const f = await fixture({ status: Status.PUBLISHED, inactiveSince });
        await db.insert(domainEvent).values({
            eventType: 'listing.edited',
            entityType: f.vertical,
            entityId: f.listing.id,
            actorId: f.userId,
            actorType: 'owner',
            occurredAt: new Date(now.getTime() - 10 * day),
            correlationId: randomUUID(),
            changes: []
        });
        const archive = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical
        });
        expect(archive).toEqual({ sent: false, reason: 'NOT_DUE' });
        expect(await rows(f.userId, LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE)).toEqual([]);
        const archiveTargetAt = new Date(now.getTime() - 10 * day + 90 * day);
        const archiveAt = retentionNoticeAt({ targetAt: archiveTargetAt, daysBefore: 15 });
        expect(
            await decide({
                userId: f.userId,
                listingId: f.listing.id,
                vertical: f.vertical,
                at: archiveAt
            })
        ).toMatchObject({
            sent: true,
            notice: 'BEFORE_ARCHIVE',
            targetAt: archiveTargetAt,
            enqueued: true
        });
        expect(await rows(f.userId, LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE)).toHaveLength(1);
        await db.execute(
            sql`UPDATE accommodations SET publication_status = 'ARCHIVED', deletion_announced_at = NULL WHERE id = ${f.listing.id}`
        );
        const targetAt = new Date(now.getTime() - 10 * day + 180 * day);
        const result = await decide({
            userId: f.userId,
            listingId: f.listing.id,
            vertical: f.vertical,
            at: retentionNoticeAt({ targetAt, daysBefore: 15 })
        });
        expect(result).toMatchObject({ sent: true, notice: 'BEFORE_DELETION', targetAt });
    });
});
