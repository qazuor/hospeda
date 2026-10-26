/** TEST:V9b:6 AC:V9b:6 — coverage reset, pause precedence and two PB9 passes. */
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const tables: Readonly<Record<(typeof verticals)[number], string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
const T0 = new Date('2026-03-01T12:00:00.000Z');
const T1 = new Date('2026-10-10T12:00:00.000Z');
const T2 = new Date('2026-10-11T12:00:00.000Z');
const previous = new Date(T1.getTime() - 86_400_000);
const afterCommit = {
    emitListingPurged: async () => {},
    deleteRemoteMedia: async () => {},
    revokeCalendarConnection: async () => {}
};

afterEach(async () => {
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

async function makeListing(vertical: (typeof verticals)[number]) {
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status: Status.ARCHIVED
    });
    const item = { vertical, listingId: listing.id, ownerId: owner.userId };
    await db.execute(sql`UPDATE ${sql.identifier(tables[vertical])}
        SET inactive_since = ${new Date(T1.getTime() - 200 * 86_400_000)}, deadlines_version = 1,
            deletion_announced_at = ${new Date(T1.getTime() - 86_400_000)},
            description = 'retention fixture', summary = 'retention summary'
        WHERE id = ${listing.id}::uuid`);
    return item;
}

async function purge(
    item: Awaited<ReturnType<typeof makeListing>>,
    options: {
        now: Date;
        previousPassStartedAt: Date | null;
        covered?: boolean;
        stopped?: boolean;
    }
) {
    return purgeInactiveListing({
        ...createPublicationTestAdapter({
            db,
            covered: { value: options.covered ?? false },
            limit: { value: 2 },
            retention: {
                stopped: options.stopped ?? false,
                pauseEndedAt: null,
                coverageLostAt: null
            }
        }),
        clock: { now: () => options.now },
        previousPassStartedAt: options.previousPassStartedAt,
        vertical: item.vertical,
        listingId: item.listingId,
        ownerId: item.ownerId,
        correlationId: randomUUID(),
        afterCommit
    });
}

async function readRow(item: { vertical: (typeof verticals)[number]; listingId: string }) {
    const result = await db.execute(
        sql`SELECT * FROM ${sql.identifier(tables[item.vertical])} WHERE id = ${item.listingId}::uuid`
    );
    return result.rows[0];
}

async function eventCount(item: { listingId: string }) {
    const result = await db.execute(
        sql<{
            count: string;
        }>`SELECT count(*)::text AS count FROM domain_event WHERE entity_id = ${item.listingId}`
    );
    return Number(result.rows[0]?.count ?? 0);
}

describe('TEST:V9b:6 AC:V9b:6 — PB9 rereads coverage and pause', () => {
    it('resets the covered accommodation clock without state, event or outbox writes', async () => {
        const item = await makeListing(VerticalEnum.ACCOMMODATION);
        const before = await readRow(item);
        const eventsBefore = await eventCount(item);
        const result = await purge(item, {
            now: T1,
            previousPassStartedAt: previous,
            covered: true
        });
        expect(result).toEqual({ purged: false, reason: 'COVERED' });
        const after = await readRow(item);
        expect(after?.publication_status).toBe('ARCHIVED');
        expect(new Date(String(after?.inactive_since))).toEqual(T1);
        expect(after?.description).toBe(before?.description);
        expect(after?.summary).toBe(before?.summary);
        expect(after?.deletion_announced_at).toEqual(before?.deletion_announced_at);
        expect(await eventCount(item)).toBe(eventsBefore);
        const outbox = await db.execute(
            sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${item.ownerId}::uuid`
        );
        expect(outbox.rows).toEqual([]);
    });

    it('pause prevents all writes even when coverage is present', async () => {
        const item = await makeListing(VerticalEnum.ACCOMMODATION);
        const before = await readRow(item);
        const eventsBefore = await eventCount(item);
        expect(
            await purge(item, {
                now: T1,
                previousPassStartedAt: previous,
                covered: true,
                stopped: true
            })
        ).toEqual({ purged: false, reason: 'RETENTION_STOPPED' });
        expect(await readRow(item)).toEqual(before);
        expect(await eventCount(item)).toBe(eventsBefore);
        const outbox = await db.execute(
            sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${item.ownerId}::uuid`
        );
        expect(outbox.rows).toEqual([]);
    });

    it.each(
        verticals
    )('requires two passes for missing coverage-loss time: %s', async (vertical) => {
        const item = await makeListing(vertical);
        const before = await readRow(item);
        const first = await purge(item, { now: T1, previousPassStartedAt: T0 });
        expect(first).toEqual({ purged: false, reason: 'FIRST_PASS' });
        expect(await readRow(item)).toEqual(before);
        expect(await purge(item, { now: T2, previousPassStartedAt: T1 })).toMatchObject({
            purged: true
        });
        expect(await readRow(item)).toMatchObject({
            publication_status: 'PURGED',
            description: ''
        });
    });

    it('purges on the first pass when coverage loss has a timestamp', async () => {
        const item = await makeListing(VerticalEnum.ACCOMMODATION);
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 },
            retention: {
                stopped: false,
                pauseEndedAt: null,
                coverageLostAt: new Date(T1.getTime() - 250 * 86_400_000)
            }
        });
        const result = await purgeInactiveListing({
            ...adapter,
            clock: { now: () => T1 },
            previousPassStartedAt: null,
            vertical: item.vertical,
            listingId: item.listingId,
            ownerId: item.ownerId,
            correlationId: randomUUID(),
            afterCommit
        });
        expect(result).toMatchObject({ purged: true });
        expect(await readRow(item)).toMatchObject({ publication_status: 'PURGED' });
    });
});
