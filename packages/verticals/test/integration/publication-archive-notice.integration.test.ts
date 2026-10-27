import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { emailOutbox, listingRetentionModel, users } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { LISTING_ARCHIVED_TEMPLATE } from '../../src/publication/archive-notices';
import { runInactivityArchive } from '../../src/publication/inactivity-archive-run';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const at = new Date('2026-10-11T12:00:00.000Z');
const clock = { now: () => new Date(at) };
const overdue = new Date(at.getTime() - 100 * 86_400_000);
const overdueDraft = new Date('2026-05-01T00:00:00Z');
type Vertical = VerticalEnum.ACCOMMODATION | VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;
const tables = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
} as const;
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
const fixtures = createPublicationFixtureTracker(db);

afterEach(() => fixtures.cleanup());
afterAll(async () => {
    await pool.end();
});

function adapter(
    args: {
        covered?: boolean;
        retention?: { stopped: boolean; pauseEndedAt: Date | null };
        afterEnqueueListingNotice?: () => Promise<void>;
    } = {}
) {
    return createPublicationTestAdapter({
        db,
        covered: { value: args.covered ?? false },
        limit: { value: 10 },
        retention: args.retention,
        afterEnqueueListingNotice: args.afterEnqueueListingNotice
    });
}

async function seedDue(args: {
    vertical: Vertical;
    status: PublicationStatusEnum;
    inactiveSince: Date;
}) {
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical: args.vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status: args.status
    });
    await db.execute(
        sql`UPDATE ${sql.identifier(tables[args.vertical])} SET publication_status = ${args.status}, inactive_since = ${args.inactiveSince}, deadlines_version = 1 WHERE id = ${listing.id}`
    );
    const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, owner.userId));
    return { ownerId: owner.userId, ownerEmail: user?.email, listingId: listing.id };
}

async function readListing(vertical: Vertical, listingId: string) {
    const result = await db.execute(
        sql`SELECT publication_status, deletion_announced_at FROM ${sql.identifier(tables[vertical])} WHERE id = ${listingId}`
    );
    const row = result.rows[0];
    return {
        status: String(row?.publication_status),
        deletionAnnouncedAt: row?.deletion_announced_at
            ? new Date(String(row.deletion_announced_at))
            : null
    };
}

async function outboxOf(ownerId: string) {
    return db.select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
}

async function eventCount(listingId: string) {
    const result = await db.execute(
        sql`SELECT count(*)::int AS n FROM domain_event WHERE entity_id = ${listingId}`
    );
    return Number(result.rows[0]?.n);
}

describe('TEST:V6:36 AC:V6:28 the on-archive notice is enqueued in the archive transaction', () => {
    it('TEST:V6:36 PB4 from PUBLISHED leaves exactly one pending notice with the announced deletion', async () => {
        const seeded = await seedDue({
            vertical: VerticalEnum.ACCOMMODATION,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: overdue
        });
        const correlationId = randomUUID();
        const result = await archiveInactiveListing({
            ...adapter(),
            afterCommit,
            clock,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: seeded.listingId,
            ownerId: seeded.ownerId,
            correlationId
        });
        expect(result).toMatchObject({ archived: true, transition: 'PB4' });
        const listing = await readListing(VerticalEnum.ACCOMMODATION, seeded.listingId);
        expect(listing.status).toBe('ARCHIVED');
        const notices = await outboxOf(seeded.ownerId);
        expect(notices).toHaveLength(1);
        const [notice] = notices;
        expect(notice).toMatchObject({
            template: LISTING_ARCHIVED_TEMPLATE,
            status: 'pending',
            recipientEmail: seeded.ownerEmail,
            correlationId
        });
        expect(notice?.payload).toMatchObject({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: seeded.listingId,
            transition: 'PB4'
        });
        expect(listing.deletionAnnouncedAt).not.toBeNull();
        expect(new Date(String(notice?.payload.deletionAnnouncedAt)).getTime()).toBe(
            listing.deletionAnnouncedAt?.getTime()
        );
    });

    it.each([
        {
            vertical: VerticalEnum.VENUE,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            inactiveSince: overdue,
            transition: 'PB4'
        },
        {
            vertical: VerticalEnum.EXPERIENCE,
            status: PublicationStatusEnum.DRAFT,
            inactiveSince: overdueDraft,
            transition: 'PB5'
        }
    ] as const)('TEST:V6:36 $transition from $status in $vertical leaves one notice', async ({
        vertical,
        status,
        inactiveSince,
        transition
    }) => {
        const seeded = await seedDue({ vertical, status, inactiveSince });
        const result = await archiveInactiveListing({
            ...adapter(),
            afterCommit,
            clock,
            vertical,
            listingId: seeded.listingId,
            ownerId: seeded.ownerId,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({ archived: true, transition });
        const notices = await outboxOf(seeded.ownerId);
        expect(notices).toHaveLength(1);
        expect(notices[0]?.template).toBe(LISTING_ARCHIVED_TEMPLATE);
        expect(notices[0]?.payload).toMatchObject({
            vertical,
            listingId: seeded.listingId,
            transition
        });
    });

    it.each([
        { label: 'coverage came back', state: { covered: true }, inactiveSince: overdue },
        {
            label: 'retention stopped',
            state: { retention: { stopped: true, pauseEndedAt: null } },
            inactiveSince: overdue
        },
        { label: 'not due yet', state: {}, inactiveSince: new Date(at.getTime() - 10 * 86_400_000) }
    ])('TEST:V6:36 enqueues nothing when $label', async ({ state, inactiveSince }) => {
        const seeded = await seedDue({
            vertical: VerticalEnum.ACCOMMODATION,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince
        });
        const result = await archiveInactiveListing({
            ...adapter(state),
            afterCommit,
            clock,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: seeded.listingId,
            ownerId: seeded.ownerId,
            correlationId: randomUUID()
        });
        expect(result.archived).toBe(false);
        expect((await readListing(VerticalEnum.ACCOMMODATION, seeded.listingId)).status).toBe(
            'PUBLISHED'
        );
        expect(await outboxOf(seeded.ownerId)).toEqual([]);
    });

    it('TEST:V6:36 a failed archive transaction leaves neither the transition nor the notice', async () => {
        const seeded = await seedDue({
            vertical: VerticalEnum.ACCOMMODATION,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: overdue
        });
        const eventsBefore = await eventCount(seeded.listingId);
        await expect(
            archiveInactiveListing({
                ...adapter({
                    afterEnqueueListingNotice: async () => {
                        throw new Error('boom');
                    }
                }),
                afterCommit,
                clock,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: seeded.listingId,
                ownerId: seeded.ownerId,
                correlationId: randomUUID()
            })
        ).rejects.toThrow('boom');
        expect(await readListing(VerticalEnum.ACCOMMODATION, seeded.listingId)).toEqual({
            status: 'PUBLISHED',
            deletionAnnouncedAt: null
        });
        expect(await eventCount(seeded.listingId)).toBe(eventsBefore);
        expect(await outboxOf(seeded.ownerId)).toEqual([]);
    });

    it('TEST:V6:36 the inactivity run enqueues only the on-archive notice, once', async () => {
        const seeded = await seedDue({
            vertical: VerticalEnum.ACCOMMODATION,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: overdue
        });
        const ports = {
            ...adapter(),
            clock,
            afterCommit,
            population: {
                listDue: (input: {
                    now: Date;
                    after: { vertical: Vertical; listingId: string } | null;
                    limit: number;
                }) =>
                    db.transaction((tx) =>
                        listingRetentionModel.listRetentionCandidates({ ...input, tx })
                    )
            }
        };
        await runInactivityArchive({ ports });
        expect((await readListing(VerticalEnum.ACCOMMODATION, seeded.listingId)).status).toBe(
            'ARCHIVED'
        );
        const first = await outboxOf(seeded.ownerId);
        expect(first.map((row) => row.template)).toEqual([LISTING_ARCHIVED_TEMPLATE]);
        await runInactivityArchive({ ports });
        const second = await outboxOf(seeded.ownerId);
        expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
    });
});
