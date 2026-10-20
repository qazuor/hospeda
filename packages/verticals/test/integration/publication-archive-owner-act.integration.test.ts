import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, emailOutbox, eq } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { addCalendarMonthsUtc } from '../../src/publication/retention-clock';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 4 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const ownersWithOutbox = new Set<string>();
const DAY = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');
type Vertical = VerticalEnum.ACCOMMODATION | VerticalEnum.GASTRONOMY | VerticalEnum.EXPERIENCE;
const verticals: readonly Vertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
];
const tables: Readonly<Record<Vertical, string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};

afterEach(async () => {
    for (const ownerId of ownersWithOutbox)
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    ownersWithOutbox.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

async function seed(vertical: Vertical, status: Status) {
    const owner = await fixtures.owner();
    ownersWithOutbox.add(owner.userId);
    const listing = await fixtures.listing({
        vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status
    });
    await db.execute(
        sql`UPDATE ${sql.identifier(tables[vertical])} SET publication_status = ${status}, inactive_since = ${new Date(now.getTime() - 200 * DAY)}, deadlines_version = 1 WHERE id = ${listing.id}`
    );
    return { ownerId: owner.userId, listingId: listing.id };
}

async function recordAct(args: {
    vertical: Vertical;
    listingId: string;
    ownerId: string;
    eventType: 'listing.created' | 'listing.edited';
    actorType?: 'owner' | 'admin';
    occurredAt: Date;
}) {
    await domainEventModel.insert({
        eventType: args.eventType,
        entityType: args.vertical,
        entityId: args.listingId,
        actorType: args.actorType ?? 'owner',
        actorId: args.ownerId,
        correlationId: randomUUID(),
        occurredAt: args.occurredAt,
        tx: db
    });
}

async function archive(vertical: Vertical, fixture: Awaited<ReturnType<typeof seed>>) {
    return archiveInactiveListing({
        ...createPublicationTestAdapter({ db, covered: { value: false }, limit: { value: 10 } }),
        afterCommit,
        clock: { now: () => now },
        vertical,
        listingId: fixture.listingId,
        ownerId: fixture.ownerId,
        correlationId: randomUUID()
    });
}

async function row(vertical: Vertical, listingId: string) {
    const result = await db.execute(
        sql`SELECT * FROM ${sql.identifier(tables[vertical])} WHERE id = ${listingId}`
    );
    return result.rows[0] as Record<string, unknown> | undefined;
}

describe.each(verticals)('TEST:1694:2 AC:1694:1 PB4/PB5 read the V9a owner act: %s', (vertical) => {
    it('honors owner edit and create events, ignores admin acts, and archives PB4/PB5 when due', async () => {
        const recent = await seed(vertical, Status.PUBLISHED);
        await recordAct({
            vertical,
            ...recent,
            eventType: 'listing.edited',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        const before = await row(vertical, recent.listingId);
        expect(await archive(vertical, recent)).toEqual({ archived: false, reason: 'NOT_DUE' });
        const after = await row(vertical, recent.listingId);
        const stripUpdatedAt = (value: Record<string, unknown> | undefined) => {
            if (!value) return value;
            const { updated_at: _updatedAt, ...rest } = value;
            return rest;
        };
        expect(stripUpdatedAt(after)).toEqual(stripUpdatedAt(before));
        expect(
            await db
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, recent.ownerId))
        ).toEqual([]);
        const noAct = await seed(vertical, Status.PUBLISHED);
        expect(await archive(vertical, noAct)).toMatchObject({ archived: true, transition: 'PB4' });

        const old = await seed(vertical, Status.PUBLISHED);
        await recordAct({
            vertical,
            ...old,
            eventType: 'listing.edited',
            occurredAt: new Date(now.getTime() - 95 * DAY)
        });
        expect(await archive(vertical, old)).toMatchObject({
            archived: true,
            transition: 'PB4',
            deletionAnnouncedAt: new Date(now.getTime() + 90 * DAY)
        });
        expect(
            (
                await db
                    .select()
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, old.ownerId))
            ).filter((item) => item.template === 'verticals.listing-archived')
        ).toHaveLength(1);

        const admin = await seed(vertical, Status.PUBLISHED);
        await recordAct({
            vertical,
            ...admin,
            eventType: 'listing.edited',
            actorType: 'admin',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        expect(await archive(vertical, admin)).toMatchObject({ archived: true, transition: 'PB4' });
        const created = await seed(vertical, Status.PUBLISHED);
        await recordAct({
            vertical,
            ...created,
            eventType: 'listing.created',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        expect(await archive(vertical, created)).toEqual({ archived: false, reason: 'NOT_DUE' });

        const draftRecent = await seed(vertical, Status.DRAFT);
        await recordAct({
            vertical,
            ...draftRecent,
            eventType: 'listing.edited',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        expect(await archive(vertical, draftRecent)).toEqual({
            archived: false,
            reason: 'NOT_DUE'
        });
        const draftOld = await seed(vertical, Status.DRAFT);
        const act = new Date(now.getTime() - 120 * DAY);
        await recordAct({ vertical, ...draftOld, eventType: 'listing.edited', occurredAt: act });
        const dueAt = addCalendarMonthsUtc({ at: act, months: 3 });
        expect(await archive(vertical, draftOld)).toMatchObject({
            archived: true,
            transition: 'PB5',
            deletionAnnouncedAt: new Date(
                now.getTime() + (act.getTime() + 180 * DAY - dueAt.getTime())
            )
        });
    });
});
