import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    PublicationStatusEnum as Status,
    VerticalDeadlineValuesSchema,
    VerticalEnum
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import {
    type DeadlineListingRef,
    expectDeadlineSourcesUnchanged,
    snapshotDeadlineSources
} from './support/deadline-readonly';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
const tables: Readonly<Record<DeadlineListingRef['vertical'], string>> = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
};
const now = new Date('2026-10-10T12:00:00.000Z');
const afterCommit = {
    emitListingPurged: async () => {},
    deleteRemoteMedia: async () => {},
    revokeCalendarConnection: async () => {}
};
const created: DeadlineListingRef[] = [];

afterEach(async () => {
    await fixtures.cleanup();
    created.length = 0;
});
afterAll(async () => pool.end());

async function listingFor(vertical: DeadlineListingRef['vertical'], status = Status.ARCHIVED) {
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status
    });
    const item = { vertical, listingId: listing.id } as const;
    created.push(item);
    await db.execute(sql`UPDATE ${sql.identifier(tables[vertical])}
        SET inactive_since = ${new Date(now.getTime() - 200 * 86_400_000)}, deadlines_version = 1,
            deletion_announced_at = ${new Date(now.getTime() - 86_400_000)}
        WHERE id = ${listing.id}::uuid`);
    return { ...item, ownerId: owner.userId };
}

function adapter(covered = false, stopped = false) {
    return createPublicationTestAdapter({
        db,
        covered: { value: covered },
        limit: { value: 2 },
        retention: { stopped, pauseEndedAt: null }
    });
}

async function purge(
    item: Awaited<ReturnType<typeof listingFor>>,
    args: { covered?: boolean; stopped?: boolean } = {}
) {
    return purgeInactiveListing({
        ...adapter(args.covered, args.stopped),
        clock: { now: () => now },
        previousPassStartedAt: now,
        vertical: item.vertical,
        listingId: item.listingId,
        ownerId: item.ownerId,
        correlationId: randomUUID(),
        afterCommit
    });
}

describe('TEST:V9b:11 AC:V9b:11 — PB9 reads the versioned deadlines without writes', () => {
    beforeAll(async () => {
        const version = await db.execute(sql<{
            version: number;
            values: { '2': { days: number } };
        }>`
            SELECT version, values FROM vertical_deadline_version WHERE version = 1
        `);
        expect(version.rows).toHaveLength(1);
        expect(version.rows[0]?.version).toBe(1);
    });

    it('calculates dueAt from the version 1 row stored at fixture creation', async () => {
        const item = await listingFor(VerticalEnum.ACCOMMODATION);
        const version = await db.execute(sql<{ values: { '2': { days: number } } }>`
            SELECT values FROM vertical_deadline_version WHERE version = 1
        `);
        const deadlines = VerticalDeadlineValuesSchema.parse(version.rows[0]?.values);
        const days = deadlines['2'].days;
        if (days === undefined) throw new Error('Version 1 deletion deadline is missing');
        await db.execute(sql`UPDATE accommodations SET inactive_since = ${new Date(now.getTime() - days * 86_400_000)},
            deletion_announced_at = ${new Date(now.getTime() - 86_400_000)} WHERE id = ${item.listingId}::uuid`);
        const result = await purge(item);
        expect(result).toMatchObject({
            purged: true,
            dueAt: new Date(now.getTime() - days * 86_400_000 + days * 86_400_000)
        });
    });

    it.each(
        verticals
    )('does not write deadline sources for %s across all PB9 outcomes', async (vertical) => {
        for (const outcome of ['purged', 'NOT_DUE', 'COVERED', 'RETENTION_STOPPED'] as const) {
            const item = await listingFor(vertical);
            if (outcome === 'NOT_DUE') {
                await db.execute(
                    sql`UPDATE ${sql.identifier(tables[vertical])} SET inactive_since = ${now}, deletion_announced_at = NULL WHERE id = ${item.listingId}::uuid`
                );
            }
            const before = await snapshotDeadlineSources({ db, listings: [item] });
            const result = await purge(item, {
                covered: outcome === 'COVERED',
                stopped: outcome === 'RETENTION_STOPPED'
            });
            expect(result.purged ? 'purged' : result.reason).toBe(outcome);
            const after = await snapshotDeadlineSources({ db, listings: [item] });
            if (outcome === 'COVERED') {
                expect({
                    ...after,
                    listings: after.listings.map((row) => ({
                        ...row,
                        inactive_since: new Date(String(row.inactive_since))
                    }))
                }).toEqual({
                    ...before,
                    listings: before.listings.map((row) => ({ ...row, inactive_since: now }))
                });
            } else {
                expectDeadlineSourcesUnchanged({ before, after });
            }
        }
    });

    it('keeps deleted_at absent from trial and append-only domain/outbox tables', async () => {
        const result = await db.execute(sql<{ table_name: string; column_name: string }>`
            SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name IN ('trial', 'domain_event', 'email_outbox')
              AND column_name = 'deleted_at' ORDER BY table_name
        `);
        expect(result.rows).toEqual([]);
    });
});
